-- LoviBeauty — migration 003: admin PIN security
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Run AFTER 002. Idempotent: safe to re-run.
--
-- The owner can now change her login PIN from the panel. It's stored *hashed*
-- (SHA-256 + per-PIN salt) in business_config under the key 'admin_pin'.
--
-- business_config is RLS-public for SELECT so the customer site can read the
-- bank details / WhatsApp / hold window. That makes it critical that the anon
-- and authenticated roles can NOT read the admin_pin row. This migration tightens
-- the read policy to exclude that one key. The service_role key (used by the
-- admin Cloudflare Functions) bypasses RLS and still reads/writes it normally.

drop policy if exists business_config_read on public.business_config;
create policy business_config_read on public.business_config
  for select to anon, authenticated using (key <> 'admin_pin');
