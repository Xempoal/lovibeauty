-- LoviBeauty — migration 009: contraseñas privadas + recuperación por código
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run. Requiere haber aplicado la 008 antes.
--
-- Cambio respecto a la 008: la contraseña sale de public.customers (que el
-- panel admin lee) y se muda a public.customer_credentials, una tabla aparte:
--   * RLS sin policies + revoke → ni anon ni authenticated pueden leerla.
--   * Ningún endpoint del panel la devuelve → ni la dueña ni el staff la ven.
--   * Solo quien administra Supabase (SQL Editor / service_role) puede leerla.
--
-- Recuperación privada de contraseña:
--   1. El panel (admin o staff) genera un código de 6 dígitos que vence en
--      15 minutos (escrito por la Cloudflare Function con service_role).
--   2. El estudio le da ese código a la clienta.
--   3. La clienta, desde su teléfono, usa "¿Olvidaste tu contraseña?" →
--      reset_password_with_code(email, código, contraseña nueva).
--   El estudio solo ve el código temporal, nunca la contraseña.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla privada de credenciales
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.customer_credentials (
  customer_id      uuid primary key references public.customers(id) on delete cascade,
  password         text not null,
  reset_code       text,
  reset_expires_at timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.customer_credentials enable row level security;
-- Sin policies: anon/authenticated no pueden tocarla. service_role la bypasea.
revoke all on public.customer_credentials from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Migrar contraseñas existentes y quitar la columna visible
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'customers' and column_name = 'password'
  ) then
    insert into public.customer_credentials (customer_id, password)
    select c.id, c.password from public.customers c
     where c.password is not null
    on conflict (customer_id) do nothing;

    alter table public.customers drop column password;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. register_account — ahora escribe en customer_credentials
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.register_account(
  p_email     text,
  p_full_name text,
  p_phone     text,
  p_password  text
)
returns table (full_name text, email text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name  text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_pass  text := coalesce(p_password, '');
  v_id    uuid;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  if length(v_pass) < 6 then
    raise exception 'password too short' using errcode = '22023';
  end if;

  select c.id into v_id from public.customers c where c.email = v_email;

  if v_id is null then
    insert into public.customers (full_name, email, phone, registered_at)
    values (v_name, v_email, v_phone, now())
    returning id into v_id;
  elsif exists (select 1 from public.customer_credentials cc where cc.customer_id = v_id) then
    raise exception 'account already exists' using errcode = '23505';
  else
    update public.customers c
       set full_name     = v_name,
           phone         = coalesce(v_phone, c.phone),
           registered_at = now()
     where c.id = v_id;
  end if;

  insert into public.customer_credentials (customer_id, password)
  values (v_id, v_pass);

  return query
    select c.full_name, c.email, c.phone
      from public.customers c
     where c.id = v_id;
end;
$$;

revoke all on function public.register_account(text, text, text, text) from public;
grant execute on function public.register_account(text, text, text, text)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. login_account — valida contra customer_credentials
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.login_account(
  p_email    text,
  p_password text
)
returns table (full_name text, email text, phone text)
language sql
security definer
set search_path = public
stable
as $$
  select c.full_name, c.email, c.phone
    from public.customers c
    join public.customer_credentials cc on cc.customer_id = c.id
   where c.email = lower(trim(p_email))
     and cc.password = p_password;
$$;

revoke all on function public.login_account(text, text) from public;
grant execute on function public.login_account(text, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. reset_password_with_code — la clienta crea su contraseña nueva con el
--    código temporal que le dio el estudio. Un solo uso, vence a los 15 min.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reset_password_with_code(
  p_email        text,
  p_code         text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'password too short' using errcode = '22023';
  end if;

  select c.id into v_id
    from public.customers c
    join public.customer_credentials cc on cc.customer_id = c.id
   where c.email = lower(trim(p_email))
     and cc.reset_code is not null
     and cc.reset_code = trim(coalesce(p_code, ''))
     and cc.reset_expires_at > now();

  if v_id is null then
    return false;
  end if;

  update public.customer_credentials cc
     set password = p_new_password,
         reset_code = null,
         reset_expires_at = null,
         updated_at = now()
   where cc.customer_id = v_id;

  return true;
end;
$$;

revoke all on function public.reset_password_with_code(text, text, text) from public;
grant execute on function public.reset_password_with_code(text, text, text)
  to anon, authenticated;
