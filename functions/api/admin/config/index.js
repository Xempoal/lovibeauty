// Business configuration (bank details, WhatsApp number, hold window).
//
//   GET /api/admin/config            → { config: { key: value, ... } }
//   PUT /api/admin/config            → { bank_clabe?, bank_name?, ... } → upserts
//
// The customer frontend reads these same rows directly with the anon key (the
// table is RLS-public for SELECT). Only this endpoint, with the service-role key,
// can write them.

import { json, badRequest, serverError, requireAdmin, sb, readJson } from '../_lib.js';

const ALLOWED = ['bank_clabe', 'bank_name', 'bank_holder', 'whatsapp_number', 'hold_minutes'];

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  try {
    const rows = await sb(env, 'business_config?select=key,value');
    const config = {};
    (rows || []).forEach(function (r) { if (r.key !== 'admin_pin') config[r.key] = r.value; });
    return json({ config });
  } catch (err) {
    return serverError(err.message);
  }
}

export async function onRequestPut({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  const body = await readJson(request);
  const now = new Date().toISOString();
  const rows = [];

  for (const key of ALLOWED) {
    if (body[key] === undefined) continue;
    let value = body[key] == null ? '' : String(body[key]);
    if (key === 'hold_minutes') {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1 || n > 1440) return badRequest('hold_minutes debe ser 1–1440');
      value = String(n);
    }
    rows.push({ key, value, updated_at: now });
  }

  if (rows.length === 0) return badRequest('nada que actualizar');

  try {
    await sb(env, 'business_config?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: rows,
    });
    const fresh = await sb(env, 'business_config?select=key,value');
    const config = {};
    (fresh || []).forEach(function (r) { config[r.key] = r.value; });
    return json({ config });
  } catch (err) {
    return serverError(err.message);
  }
}
