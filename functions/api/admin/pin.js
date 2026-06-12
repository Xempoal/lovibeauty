// POST /api/admin/pin  →  { current_pin, new_pin, confirm_pin }  →  { ok: true }
//
// Lets the owner change her login PIN from the panel. Verifies the current PIN
// (against the stored hash, or env.ADMIN_PIN if none is stored yet), then saves
// the new PIN hashed in business_config.admin_pin. Requires a valid session
// token. Existing tokens stay valid (the token signing key is env-based, not the
// login PIN), so changing the PIN doesn't log the owner out.

import { json, badRequest, unauthorized, serverError, requireAdmin, sb, readJson,
         getStoredAdminPin, verifyPin, hashPin } from './_lib.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth) return auth;

  const body = await readJson(request);
  const current = String(body.current_pin == null ? '' : body.current_pin).trim();
  const next = String(body.new_pin == null ? '' : body.new_pin).trim();
  const confirm = String(body.confirm_pin == null ? '' : body.confirm_pin).trim();

  if (!/^\d{6,8}$/.test(next)) return badRequest('El PIN nuevo debe tener entre 6 y 8 dígitos');
  if (next !== confirm) return badRequest('El PIN nuevo no coincide con la confirmación');

  // Verify the current PIN.
  const stored = await getStoredAdminPin(env);
  let ok;
  if (stored) {
    ok = await verifyPin(current, stored);
  } else {
    const expected = String(env.ADMIN_PIN || '');
    ok = expected.length > 0 && current === expected;
  }
  if (!ok) return unauthorized('El PIN actual es incorrecto');

  const hash = await hashPin(next);
  try {
    await sb(env, 'business_config?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: [{ key: 'admin_pin', value: hash, updated_at: new Date().toISOString() }],
    });
  } catch (err) {
    return serverError(err.message);
  }
  return json({ ok: true });
}
