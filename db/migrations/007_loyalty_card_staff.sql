-- LoviBeauty — migration 007: tarjeta de lealtad real + quién atiende la cita
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- 1. bookings.staff_name — the admin can write who will attend the appointment.
--    Free text, optional. Exposed to the client via get_booking and
--    get_customer_bookings.
-- 2. loyalty_cards gets a scannable card_code (rendered as a CODE128 barcode in
--    the client dashboard) and a visits counter (0..8). Rewards live in the
--    frontend: visit 3 = 10% off, visit 6 = pedicure + polish $350,
--    visit 8 = free facial. After visit 8 the next scan starts a new cycle.
-- 3. RPCs:
--    * get_or_create_loyalty_card(email, name, phone) — anon. Called from the
--      client dashboard; upserts the customer and returns their card.
--    * loyalty_register_visit(card_code) — service_role ONLY. Called from the
--      admin scanner (Cloudflare Function) to stamp a visit.
--    * get_customer_bookings(email) — anon. Real "Mis citas" for the client
--      dashboard (the email works as the lookup key, same trust model as the
--      booking flow).
--    * get_booking — recreated to include staff_name.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. bookings.staff_name
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bookings add column if not exists staff_name text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. loyalty_cards: card code + visit counters
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.loyalty_cards
  add column if not exists card_code     text,
  add column if not exists visits        int not null default 0,
  add column if not exists total_visits  int not null default 0,
  add column if not exists last_visit_at timestamptz;

create unique index if not exists loyalty_cards_code_idx
  on public.loyalty_cards(card_code);

do $$ begin
  alter table public.loyalty_cards
    add constraint loyalty_cards_visits_range check (visits >= 0 and visits <= 8);
exception when duplicate_object then null; end $$;

-- 10-digit numeric code, unique across cards. Numeric-only keeps the CODE128
-- barcode short and easy to scan with a phone camera.
create or replace function public.lb_new_card_code() returns text
language plpgsql
volatile
as $$
declare
  v_code text;
begin
  loop
    v_code := lpad(floor(random() * 10000000000)::bigint::text, 10, '0');
    exit when not exists (
      select 1 from public.loyalty_cards lc where lc.card_code = v_code
    );
  end loop;
  return v_code;
end;
$$;
revoke all on function public.lb_new_card_code() from public, anon, authenticated;

-- Backfill any pre-existing card rows.
update public.loyalty_cards
   set card_code = public.lb_new_card_code()
 where card_code is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_or_create_loyalty_card(p_email, p_full_name, p_phone)
-- Called by the client dashboard with the anon key. Upserts the customer by
-- email (same matching rule as create_booking) and returns the loyalty card,
-- creating it on first use.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_or_create_loyalty_card(
  p_email     text,
  p_full_name text,
  p_phone     text default null
)
returns table (card_code text, visits int, total_visits int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name        text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone       text := nullif(trim(coalesce(p_phone, '')), '');
  v_customer_id uuid;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'valid email is required' using errcode = '22023';
  end if;

  select c.id into v_customer_id from public.customers c where c.email = v_email;
  if v_customer_id is null then
    insert into public.customers (full_name, email, phone)
    values (coalesce(v_name, 'Clienta'), v_email, v_phone)
    returning id into v_customer_id;
  end if;

  insert into public.loyalty_cards (customer_id, card_code)
  values (v_customer_id, public.lb_new_card_code())
  on conflict (customer_id) do nothing;

  return query
    select lc.card_code, lc.visits, lc.total_visits
      from public.loyalty_cards lc
     where lc.customer_id = v_customer_id;
end;
$$;

revoke all on function public.get_or_create_loyalty_card(text, text, text) from public;
grant execute on function public.get_or_create_loyalty_card(text, text, text)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. loyalty_register_visit(p_card_code)
-- Stamps one visit on the card. After the 8th stamp the next scan starts a new
-- cycle (visits back to 1). ONLY the service_role may call this — it is the
-- admin scanner's endpoint; anon must never be able to self-stamp.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.loyalty_register_visit(p_card_code text)
returns table (
  card_code    text,
  visits       int,
  total_visits int,
  full_name    text,
  new_cycle    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        bigint;
  v_visits    int;
  v_total     int;
  v_new_cycle boolean := false;
begin
  select lc.id, lc.visits, lc.total_visits
    into v_id, v_visits, v_total
    from public.loyalty_cards lc
   where lc.card_code = trim(p_card_code)
     for update;

  if v_id is null then
    raise exception 'loyalty card not found' using errcode = 'P0002';
  end if;

  if v_visits >= 8 then
    v_visits := 1;
    v_new_cycle := true;
  else
    v_visits := v_visits + 1;
  end if;
  v_total := v_total + 1;

  update public.loyalty_cards lc
     set visits = v_visits, total_visits = v_total, last_visit_at = now()
   where lc.id = v_id;

  return query
    select lc.card_code, lc.visits, lc.total_visits, c.full_name, v_new_cycle
      from public.loyalty_cards lc
      join public.customers c on c.id = lc.customer_id
     where lc.id = v_id;
end;
$$;

revoke all on function public.loyalty_register_visit(text) from public, anon, authenticated;
grant execute on function public.loyalty_register_visit(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. get_customer_bookings(p_email)
-- Real "Mis citas" for the client dashboard. Includes staff_name and whether a
-- cancellation request is pending.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_customer_bookings(p_email text)
returns table (
  id                   uuid,
  booking_date         date,
  start_time           time,
  end_time             time,
  status               public.booking_status,
  payment_method       public.payment_method,
  payment_status       public.payment_status,
  service_name         text,
  service_option_name  text,
  price                numeric,
  duration_minutes     int,
  staff_name           text,
  notes                text,
  created_at           timestamptz,
  cancellation_pending boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.booking_date, b.start_time, b.end_time, b.status,
         b.payment_method, b.payment_status,
         s.name  as service_name,
         so.name as service_option_name,
         so.price, so.duration_minutes,
         b.staff_name, b.notes, b.created_at,
         exists (
           select 1 from public.cancellation_requests cr
            where cr.booking_id = b.id and cr.status = 'pending'
         ) as cancellation_pending
    from public.bookings b
    join public.service_options so on so.id = b.service_option_id
    join public.services        s  on s.id  = so.service_id
    join public.customers       c  on c.id  = b.customer_id
   where c.email = lower(trim(p_email))
   order by b.booking_date desc, b.start_time desc
   limit 100;
$$;

revoke all on function public.get_customer_bookings(text) from public;
grant execute on function public.get_customer_bookings(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. get_booking — recreated with staff_name (return type changes → drop first)
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.get_booking(uuid);

create function public.get_booking(p_id uuid)
returns table (
  id                  uuid,
  service_id          bigint,
  service_name        text,
  service_option_id   bigint,
  service_option_name text,
  booking_date        date,
  start_time          time,
  end_time            time,
  duration_minutes    int,
  price               numeric,
  status              public.booking_status,
  payment_method      public.payment_method,
  payment_status      public.payment_status,
  payment_reference   text,
  payment_amount      numeric,
  held_at             timestamptz,
  expires_at          timestamptz,
  admin_confirmed_at  timestamptz,
  full_name           text,
  email               text,
  phone               text,
  staff_name          text,
  notes               text,
  created_at          timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select b.id,
         s.id   as service_id,
         s.name as service_name,
         so.id  as service_option_id,
         so.name as service_option_name,
         b.booking_date, b.start_time, b.end_time,
         so.duration_minutes, so.price,
         b.status, b.payment_method, b.payment_status,
         b.payment_reference, b.payment_amount,
         b.held_at,
         b.held_at + public.hold_window() as expires_at,
         b.admin_confirmed_at,
         coalesce(c.full_name, b.guest_name)  as full_name,
         coalesce(c.email,     b.guest_email) as email,
         coalesce(c.phone,     b.guest_phone) as phone,
         b.staff_name,
         b.notes,
         b.created_at
    from public.bookings b
    join public.service_options so on so.id = b.service_option_id
    join public.services        s  on s.id  = so.service_id
    left join public.customers  c  on c.id  = b.customer_id
   where b.id = p_id;
$$;

revoke all on function public.get_booking(uuid) from public;
grant execute on function public.get_booking(uuid) to anon, authenticated;
