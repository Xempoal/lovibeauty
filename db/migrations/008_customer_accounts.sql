-- LoviBeauty — migration 008: cuentas de clientas en Supabase
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- Hasta ahora el registro/login de clientas vivía solo en localStorage del
-- navegador, así que el panel admin no podía verlas ni recuperar contraseñas.
-- Esta migración mueve las cuentas a public.customers:
--   * customers.password — contraseña de la cuenta. Se guarda EN CLARO a
--     propósito: la dueña pidió poder leérsela a la clienta que la olvide
--     (estudio chico, riesgo asumido). El anon role NO puede leer la tabla
--     (RLS sin policies); solo los RPCs y el panel admin (service_role).
--   * register_account / login_account — RPCs anon para el flujo de cuenta.

alter table public.customers
  add column if not exists password      text,
  add column if not exists registered_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- register_account(p_email, p_full_name, p_phone, p_password)
-- Crea la cuenta. Si el cliente ya existe (por reservas previas) le agrega la
-- contraseña; si ya tiene cuenta, error 23505.
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
  v_has_password boolean;
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

  select c.id, c.password is not null
    into v_id, v_has_password
    from public.customers c
   where c.email = v_email;

  if v_id is null then
    insert into public.customers (full_name, email, phone, password, registered_at)
    values (v_name, v_email, v_phone, v_pass, now())
    returning id into v_id;
  elsif v_has_password then
    raise exception 'account already exists' using errcode = '23505';
  else
    update public.customers c
       set full_name     = v_name,
           phone         = coalesce(v_phone, c.phone),
           password      = v_pass,
           registered_at = now()
     where c.id = v_id;
  end if;

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
-- login_account(p_email, p_password)
-- Devuelve los datos de la clienta cuando email + contraseña coinciden;
-- cero filas cuando no.
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
   where c.email = lower(trim(p_email))
     and c.password is not null
     and c.password = p_password;
$$;

revoke all on function public.login_account(text, text) from public;
grant execute on function public.login_account(text, text) to anon, authenticated;
