// POST /api/admin/loyalty/scan  { code }  →  stamp one visit on a loyalty card
//
// Calls the service_role-only RPC loyalty_register_visit. Returns the updated
// card joined with the customer name so the admin sees who just got stamped:
//   { card: { card_code, visits, total_visits, full_name, new_cycle } }

import { json, badRequest, serverError, requireAuth, sb, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await readJson(request);
  const code = String(body.code || '').trim();
  if (!code) return badRequest('code requerido');

  try {
    const rows = await sb(env, 'rpc/loyalty_register_visit', {
      method: 'POST',
      body: { p_card_code: code },
    });
    const card = Array.isArray(rows) ? rows[0] : rows;
    if (!card) return json({ error: 'Tarjeta no encontrada' }, 404);
    return json({ card });
  } catch (err) {
    if (err.details && err.details.code === 'P0002') {
      return json({ error: 'Tarjeta no encontrada. Revisa el código.' }, 404);
    }
    return serverError(err.message);
  }
}
