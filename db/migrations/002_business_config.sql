-- LoviBeauty — migration 002: business_config
--
-- Apply: paste this whole file in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- Adds a tiny key/value table the admin panel writes (via the service_role key,
-- inside Cloudflare Functions) and the customer frontend reads (anon, RLS-public).
-- Holds the bank details for the "Transfiere aquí" screen, the WhatsApp number
-- for receipts, and the hold window in minutes.

-- ─────────────────────────────────────────────────────────────────────────────
-- business_config
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.business_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.business_config enable row level security;

-- Public read: these values (bank account, WhatsApp, hold window) are shown to
-- customers anyway. Writes never happen through anon — only the service_role
-- key (used from Cloudflare Functions) can mutate, and it bypasses RLS.
grant select on public.business_config to anon, authenticated;

drop policy if exists business_config_read on public.business_config;
create policy business_config_read on public.business_config
  for select to anon, authenticated using (true);

-- Seed the keys the app expects. `do nothing` keeps any value the admin already set.
insert into public.business_config (key, value) values
  ('bank_clabe',      ''),
  ('bank_name',       ''),
  ('bank_holder',     ''),
  ('whatsapp_number', ''),
  ('hold_minutes',    '20')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Make the hold window configurable end-to-end.
-- 001 defined hold_window() as an immutable constant of 20 minutes. Redefine it
-- to read business_config.hold_minutes so changing it from the admin panel takes
-- effect everywhere (get_availability + create_booking both call this helper).
-- Reading a table means it can no longer be `immutable`; `stable` is correct and
-- still callable from the SECURITY DEFINER RPCs (which run as the table owner, so
-- the read bypasses RLS). No index depends on this function, so the redefinition
-- is safe.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.hold_window() returns interval
  language sql
  stable
  parallel safe
  set search_path = public
  as $$
    select (coalesce(nullif((select value from public.business_config
                              where key = 'hold_minutes'), ''), '20'))::int
           * interval '1 minute'
  $$;
