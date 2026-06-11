-- LoviBeauty — migration 005: promotional banners for the home carousel
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- Model:
--   * The studio owner manages banners from the admin panel (Catálogo → Banners),
--     which writes through the Cloudflare Functions with the service_role key.
--   * The customer home reads active banners directly with the anon key, so the
--     SELECT policy below only exposes active rows.
--   * service_id optionally links the banner to a service: tapping the banner
--     opens that service's booking flow.
--   * Banner images live in the existing public service-images bucket under
--     the banners/ prefix (no new bucket needed).

create table if not exists public.banners (
  id            bigserial primary key,
  title         text not null,
  subtitle      text,
  image_url     text,
  service_id    bigint references public.services(id) on delete set null,
  display_order int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.banners enable row level security;

drop policy if exists banners_read on public.banners;
create policy banners_read on public.banners
  for select to anon, authenticated using (active);

-- Seed a welcome banner so the carousel isn't empty before the owner adds hers.
insert into public.banners (title, subtitle, display_order, active)
select 'Tu momento de consentirte', 'Agenda tu cita en menos de un minuto 💕', 1, true
where not exists (select 1 from public.banners);
