-- LoviBeauty — initial schema
--
-- Apply: paste this whole file in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run on a fresh project (uses `create … if not exists` /
-- `create or replace` where possible). Drop tables manually if you want a hard reset.
--
-- Architecture:
--   * Public catalog (services, service_options, business_hours, blocked_slots) is
--     readable by the anon key (RLS allows SELECT on active rows).
--   * customers / bookings / cancellation_requests / loyalty_cards are RLS-locked.
--     Clients reach them only through SECURITY DEFINER RPCs:
--       - create_booking(...)      → reserve a slot (status=pending_payment, held_at=now())
--       - get_booking(uuid)        → read a booking by its UUID (capability token)
--       - get_availability(...)    → list busy ranges for a date
--       - request_cancellation(..) → log a cancellation request for admin review
--   * The admin panel uses the service_role key, which bypasses RLS.
--
-- Hold window: 20 minutes. A pending_payment booking older than that is treated as
-- expired by every RPC; create_booking flips it to 'expired' lazily before checking
-- conflicts, so no cron is needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.booking_status as enum
    ('pending_payment', 'confirmed', 'cancelled', 'expired', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum
    ('transfer', 'card', 'mercadopago', 'stripe');
exception when duplicate_object then null; end $$;

-- If the enum already existed (e.g. you ran an earlier version of this file),
-- make sure the gateway values are present. `add value if not exists` is a
-- no-op when the label is already there.
alter type public.payment_method add value if not exists 'mercadopago';
alter type public.payment_method add value if not exists 'stripe';

do $$ begin
  create type public.payment_status as enum ('pending', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cancellation_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: hold window (single source of truth)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.hold_window() returns interval
  language sql immutable parallel safe as $$ select interval '20 minutes' $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. services
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.services (
  id            bigserial primary key,
  slug          text not null unique,
  name          text not null,
  description   text,
  image_url     text,
  display_order int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. service_options
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.service_options (
  id               bigserial primary key,
  service_id       bigint not null references public.services(id) on delete cascade,
  slug             text   not null,
  name             text   not null,
  description      text,
  price            numeric(10,2) not null check (price >= 0),
  duration_minutes int not null check (duration_minutes > 0),
  display_order    int not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (service_id, slug)
);
create index if not exists service_options_active_idx
  on public.service_options(service_id) where active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. business_hours
-- ─────────────────────────────────────────────────────────────────────────────
-- day_of_week follows extract(dow): 0 = Sunday, 6 = Saturday.
create table if not exists public.business_hours (
  id           bigserial primary key,
  day_of_week  smallint not null unique check (day_of_week between 0 and 6),
  open_time    time,
  close_time   time,
  is_closed    boolean not null default false,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. blocked_slots
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.blocked_slots (
  id           bigserial primary key,
  blocked_date date not null,
  start_time   time not null,
  end_time     time not null check (end_time > start_time),
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists blocked_slots_date_idx on public.blocked_slots(blocked_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. customers
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text unique,
  phone      text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. bookings
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid    references public.customers(id) on delete set null,
  service_option_id   bigint  not null references public.service_options(id),
  booking_date        date    not null,
  start_time          time    not null,
  end_time            time    not null,
  status              public.booking_status not null default 'pending_payment',
  payment_method      public.payment_method not null default 'transfer',
  payment_status      public.payment_status not null default 'pending',
  -- Gateway integration (Mercado Pago / Stripe). Both NULL until the payment
  -- lands; admin can also fill them in by hand when confirming a transfer.
  payment_reference   text,
  payment_amount      numeric(10,2) check (payment_amount is null or payment_amount >= 0),
  held_at             timestamptz not null default now(),
  admin_confirmed_at  timestamptz,
  guest_name          text,
  guest_email         text,
  guest_phone         text,
  notes               text,
  created_at          timestamptz not null default now(),
  constraint bookings_end_after_start check (end_time > start_time),
  constraint bookings_contact_present check (customer_id is not null or guest_email is not null)
);
-- Safety in case the table was created by an older revision without the
-- gateway columns. No-op on a fresh database.
alter table public.bookings
  add column if not exists payment_reference text,
  add column if not exists payment_amount    numeric(10,2);
do $$ begin
  alter table public.bookings
    add constraint bookings_payment_amount_nonneg
    check (payment_amount is null or payment_amount >= 0);
exception when duplicate_object then null; end $$;

create index if not exists bookings_slot_idx        on public.bookings(booking_date, start_time);
create index if not exists bookings_customer_idx    on public.bookings(customer_id);
create index if not exists bookings_status_idx      on public.bookings(status);
create index if not exists bookings_pending_held_idx
  on public.bookings(held_at) where status = 'pending_payment';
create index if not exists bookings_payment_ref_idx
  on public.bookings(payment_reference) where payment_reference is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. cancellation_requests
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cancellation_requests (
  id           bigserial primary key,
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  reason       text,
  status       public.cancellation_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists cancellation_requests_booking_idx
  on public.cancellation_requests(booking_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. loyalty_cards (placeholder for future)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.loyalty_cards (
  id          bigserial primary key,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  points      int not null default 0 check (points >= 0),
  tier        text not null default 'standard',
  created_at  timestamptz not null default now()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.services             enable row level security;
alter table public.service_options      enable row level security;
alter table public.business_hours       enable row level security;
alter table public.blocked_slots        enable row level security;
alter table public.customers            enable row level security;
alter table public.bookings             enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.loyalty_cards        enable row level security;

-- Catalog: public read.
drop policy if exists services_read on public.services;
create policy services_read on public.services
  for select to anon, authenticated using (active);

drop policy if exists service_options_read on public.service_options;
create policy service_options_read on public.service_options
  for select to anon, authenticated using (active);

drop policy if exists business_hours_read on public.business_hours;
create policy business_hours_read on public.business_hours
  for select to anon, authenticated using (true);

drop policy if exists blocked_slots_read on public.blocked_slots;
create policy blocked_slots_read on public.blocked_slots
  for select to anon, authenticated using (true);

-- customers / bookings / cancellation_requests / loyalty_cards: no policies →
-- the anon and authenticated roles cannot SELECT/INSERT/UPDATE/DELETE directly.
-- They reach those tables only through the SECURITY DEFINER RPCs below.
-- service_role bypasses RLS, so the admin panel keeps full access.

-- Defense in depth: revoke direct table privileges from the public roles.
revoke all on public.customers,            public.bookings,
              public.cancellation_requests, public.loyalty_cards
  from anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- get_availability(p_date, p_service_option_id)
-- Returns busy time ranges for a given date so the frontend can render slots.
-- A range is busy if it's a confirmed booking, an active pending_payment
-- (held within the last 20 minutes), or an admin-defined block.
-- p_service_option_id is currently informational (the studio has one chair so
-- any active booking blocks any service); kept in the signature for future use.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_availability(
  p_date              date,
  p_service_option_id bigint default null
)
returns table (
  busy_start time,
  busy_end   time,
  source     text
)
language sql
security definer
set search_path = public
stable
as $$
  select start_time as busy_start,
         end_time   as busy_end,
         'booking'::text as source
    from public.bookings
   where booking_date = p_date
     and (
       status = 'confirmed'
       or (status = 'pending_payment' and held_at > now() - public.hold_window())
     )
  union all
  select start_time, end_time, 'block'::text
    from public.blocked_slots
   where blocked_date = p_date;
$$;

revoke all on function public.get_availability(date, bigint) from public;
grant execute on function public.get_availability(date, bigint) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_booking(...)
-- Validates business hours, blocked slots, and active reservations. Inserts a
-- pending_payment booking and returns its UUID. The UUID acts as a capability
-- token: keep it secret to keep the booking private.
--
-- Error codes raised:
--   22023 — invalid input (missing fields, unknown option, outside hours)
--   23505 — slot conflict (already booked or blocked)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_booking(
  p_service_option_id bigint,
  p_booking_date      date,
  p_start_time        time,
  p_full_name         text,
  p_email             text,
  p_phone             text,
  p_payment_method    public.payment_method default 'transfer',
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       text := lower(trim(p_email));
  v_full_name   text := trim(p_full_name);
  v_duration    int;
  v_end_time    time;
  v_dow         smallint;
  v_open        time;
  v_close       time;
  v_closed      boolean;
  v_conflict    int;
  v_customer_id uuid;
  v_booking_id  uuid;
begin
  -- Basic input validation
  if v_full_name is null or length(v_full_name) = 0 then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'valid email is required' using errcode = '22023';
  end if;

  -- Lookup duration
  select duration_minutes into v_duration
    from public.service_options
   where id = p_service_option_id and active;
  if v_duration is null then
    raise exception 'service option % not available', p_service_option_id
      using errcode = '22023';
  end if;
  v_end_time := p_start_time + make_interval(mins => v_duration);

  -- Business hours
  v_dow := extract(dow from p_booking_date)::smallint;
  select open_time, close_time, is_closed
    into v_open, v_close, v_closed
    from public.business_hours
   where day_of_week = v_dow;
  if not found or v_closed or v_open is null then
    raise exception 'studio is closed on this day' using errcode = '22023';
  end if;
  if p_start_time < v_open or v_end_time > v_close then
    raise exception 'requested time is outside business hours'
      using errcode = '22023';
  end if;

  -- Serialize concurrent inserts on the same date so two clients can't take
  -- the same slot. xact-scoped, released at commit.
  perform pg_advisory_xact_lock(
    hashtext('booking:' || p_booking_date::text)
  );

  -- Lazy expiry: flip stale pending_payment for this date to 'expired'.
  update public.bookings
     set status = 'expired'
   where booking_date = p_booking_date
     and status = 'pending_payment'
     and held_at <= now() - public.hold_window();

  -- Conflict against active bookings (confirmed or pending_payment within hold).
  select count(*) into v_conflict
    from public.bookings
   where booking_date = p_booking_date
     and status in ('confirmed', 'pending_payment')
     and (start_time, end_time) overlaps (p_start_time, v_end_time);
  if v_conflict > 0 then
    raise exception 'slot already taken' using errcode = '23505';
  end if;

  -- Conflict against admin-defined blocks.
  select count(*) into v_conflict
    from public.blocked_slots
   where blocked_date = p_booking_date
     and (start_time, end_time) overlaps (p_start_time, v_end_time);
  if v_conflict > 0 then
    raise exception 'slot blocked' using errcode = '23505';
  end if;

  -- Upsert customer by email.
  select id into v_customer_id from public.customers where email = v_email;
  if v_customer_id is null then
    insert into public.customers (full_name, email, phone)
    values (v_full_name, v_email, p_phone)
    returning id into v_customer_id;
  else
    update public.customers
       set full_name = v_full_name,
           phone     = coalesce(p_phone, phone)
     where id = v_customer_id;
  end if;

  -- Insert booking.
  insert into public.bookings (
    customer_id, service_option_id,
    booking_date, start_time, end_time,
    status, payment_method, payment_status, held_at,
    guest_name, guest_email, guest_phone, notes
  ) values (
    v_customer_id, p_service_option_id,
    p_booking_date, p_start_time, v_end_time,
    'pending_payment', p_payment_method, 'pending', now(),
    v_full_name, v_email, p_phone, p_notes
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_booking(
  bigint, date, time, text, text, text, public.payment_method, text
) from public;
grant execute on function public.create_booking(
  bigint, date, time, text, text, text, public.payment_method, text
) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_booking(p_id)
-- Reads a booking by its UUID. The UUID is the capability token: anyone who
-- knows it can read; anyone who doesn't, can't.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_booking(p_id uuid)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- request_cancellation(p_booking_id, p_reason)
-- Logs a cancellation request the admin can review later.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.request_cancellation(
  p_booking_id uuid,
  p_reason     text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.booking_status;
  v_id     bigint;
begin
  select status into v_status from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_status in ('cancelled', 'expired', 'completed') then
    raise exception 'booking is already %', v_status using errcode = '22023';
  end if;

  insert into public.cancellation_requests (booking_id, reason)
  values (p_booking_id, p_reason)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.request_cancellation(uuid, text) from public;
grant execute on function public.request_cancellation(uuid, text)
  to anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- Seed data
-- ═════════════════════════════════════════════════════════════════════════════

-- Business hours: Sun closed, Mon–Fri 09:00–20:00, Sat 09:00–18:00
insert into public.business_hours (day_of_week, open_time, close_time, is_closed) values
  (0, null,    null,    true),
  (1, '09:00', '20:00', false),
  (2, '09:00', '20:00', false),
  (3, '09:00', '20:00', false),
  (4, '09:00', '20:00', false),
  (5, '09:00', '20:00', false),
  (6, '09:00', '18:00', false)
on conflict (day_of_week) do update
  set open_time = excluded.open_time,
      close_time = excluded.close_time,
      is_closed = excluded.is_closed;

-- Services
insert into public.services (slug, name, description, display_order, active) values
  ('unas',       'Uñas',                'Acrílico, gelish y retiros',       1, true),
  ('makeup',     'Makeup',              'Social, eventos y novias',         2, true),
  ('pedi-spa',   'Pedi spa',            'Exfoliación, masaje y esmaltado',  3, true),
  ('keratina',   'Keratina',            'Alaciado y nutrición profunda',    4, true),
  ('especiales', 'Servicios especiales','Detalles exclusivos del estudio',  5, true)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      display_order = excluded.display_order,
      active = excluded.active;

-- Service options (idempotent via (service_id, slug) unique)
with svc as (select slug, id from public.services)
insert into public.service_options
  (service_id, slug, name, description, price, duration_minutes, display_order, active)
select s.id, t.slug, t.name, t.description, t.price, t.dur, t.ord, true
from (values
  -- Uñas
  ('unas',       'acrilico',         'Uñas acrílicas',        'Aplicación completa con diseño a tu gusto',  420.00, 120, 1),
  ('unas',       'gelish',           'Manicure gelish',       'Esmaltado semipermanente que dura semanas',  280.00,  60, 2),
  ('unas',       'retiro-acrilico',  'Retiro de acrílico',    'Retiro cuidadoso sin dañar tu uña natural',  150.00,  45, 3),
  ('unas',       'retiro-polish',    'Retiro de polish',      'Retiro de gelish o semipermanente',          100.00,  30, 4),
  -- Makeup
  ('makeup',     'social',           'Maquillaje social',     'Maquillaje para evento de día o noche',      500.00,  60, 1),
  ('makeup',     'novia',            'Maquillaje para novias','Prueba previa + look completo con pestañas', 1200.00, 120, 2),
  ('makeup',     'eventos',          'Maquillaje para eventos','Look completo para eventos especiales',     800.00,  90, 3),
  -- Pedi spa
  ('pedi-spa',   'pedicure-spa',     'Pedicure spa',          'Exfoliación, masaje relajante y esmaltado',  350.00,  60, 1),
  ('pedi-spa',   'esmaltado-pies',   'Esmaltado de pies',     'Limpieza y esmaltado',                       150.00,  30, 2),
  -- Keratina
  ('keratina',   'completa',         'Keratina completa',     'Alaciado profesional con nutrición',         900.00, 120, 1),
  ('keratina',   'nutricion',        'Nutrición profunda',    'Tratamiento de hidratación intensa',         500.00,  60, 2),
  -- Servicios especiales
  ('especiales', 'consulta',         'Consulta personalizada','Sesión de asesoría sin costo',                 0.00,  30, 1)
) as t(svc_slug, slug, name, description, price, dur, ord)
join svc s on s.slug = t.svc_slug
on conflict (service_id, slug) do update
  set name             = excluded.name,
      description      = excluded.description,
      price            = excluded.price,
      duration_minutes = excluded.duration_minutes,
      display_order    = excluded.display_order,
      active           = excluded.active;
