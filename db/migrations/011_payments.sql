-- LoviBeauty — migration 011: cimientos para cobros con tarjeta (pasarela de pago)
--
-- Apply: pega este archivo en Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotente: seguro de re-ejecutar.
--
-- Deja todo listo para conectar Stripe, Mercado Pago, PayPal (u otra) más
-- adelante. NO activa nada por sí solo: mientras no existan las llaves del
-- proveedor en las variables de entorno de Cloudflare, el sitio sigue cobrando
-- por transferencia exactamente igual que hoy.
--
-- Qué agrega:
--   1. Valor 'paypal' al enum payment_method (ya tenía transfer/card/mercadopago/stripe).
--   2. Tabla payment_events: bitácora de eventos del webhook + idempotencia
--      (unique provider+event_id) para no procesar dos veces un mismo pago.
--   3. Semilla deposit_amount en business_config (monto del anticipo, $100 por defecto).
--
-- Los secretos del proveedor (Stripe secret key, Mercado Pago access token, etc.)
-- NUNCA van en la base de datos: viven solo en las variables de entorno de las
-- Cloudflare Functions. Ver .env.example y functions/api/payments/_shared.js.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enum payment_method: asegurar 'paypal'
-- ─────────────────────────────────────────────────────────────────────────────
alter type public.payment_method add value if not exists 'paypal';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. payment_events — bitácora + idempotencia de webhooks
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_events (
  id          bigserial primary key,
  booking_id  uuid references public.bookings(id) on delete set null,
  provider    text not null,                 -- 'stripe' | 'mercadopago' | 'paypal' | ...
  event_id    text not null,                 -- id del evento/pago según el proveedor
  status      text,                          -- estado reportado (approved/paid/...)
  amount      numeric(10,2) check (amount is null or amount >= 0),
  raw         jsonb,                          -- payload crudo para auditoría
  created_at  timestamptz not null default now(),
  unique (provider, event_id)                 -- evita procesar el mismo evento 2 veces
);
create index if not exists payment_events_booking_idx on public.payment_events(booking_id);

-- RLS: bloqueada para anon/authenticated. Solo el service_role (Cloudflare
-- Functions / SQL Editor) la escribe y la lee, igual que bookings.
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Semilla de configuración del anticipo (editable luego desde el panel)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.business_config (key, value) values
  ('deposit_amount', '100')
on conflict (key) do nothing;
