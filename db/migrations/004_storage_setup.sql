-- LoviBeauty — migration 004: Storage bucket for service images
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- NOTE: the bucket was already created remotely via the Storage REST API with the
-- service_role key (POST /storage/v1/bucket). This file exists so the setup is
-- reproducible in another project / environment.
--
-- Model:
--   * Public bucket  → anyone can READ objects via the public URL
--       {SUPABASE_URL}/storage/v1/object/public/service-images/<path>
--   * No INSERT/UPDATE/DELETE policy for anon/authenticated → they cannot write.
--   * The admin Cloudflare Functions write with the service_role key, which
--     bypasses RLS, so no write policy is needed for them.

-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  5242880,                                              -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies on storage.objects
-- A public bucket already serves reads through the /object/public/ path, but we
-- add an explicit SELECT policy so the intent is documented. We deliberately add
-- NO write policies: anon/authenticated stay locked out, and the service_role
-- bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "service-images public read" on storage.objects;
create policy "service-images public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'service-images');
