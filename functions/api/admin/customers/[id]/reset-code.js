// POST /api/admin/customers/:id/reset-code  →  { code, expires_at }
//
// Private password recovery. Generates a single-use 6-digit code (15 min TTL)
// and stores it on the client's customer_credentials row. The studio gives the
// code to the client; she sets her NEW password herself from her phone via the
// reset_password_with_code RPC. Nobody at the studio ever sees a password.
// Accessible to both roles (admin and staff).

import { json, serverError, requireAuth, sb } from '../../_lib.js';

const TTL_MS = 15 * 60 * 1000;

export async function onRequestPost({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return json({ error: 'id requerido' }, 400);

  try {
    const creds = await sb(
      env,
      'customer_credentials?select=customer_id&customer_id=eq.' + encodeURIComponent(id)
    );
    if (!creds || creds.length === 0) {
      return json({ error: 'Esta clienta no tiene cuenta registrada' }, 404);
    }

    // 6-digit code, crypto-random.
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(buf[0] % 1000000).padStart(6, '0');
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

    await sb(env, 'customer_credentials?customer_id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { reset_code: code, reset_expires_at: expiresAt },
    });

    return json({ code, expires_at: expiresAt });
  } catch (err) {
    return serverError(err.message);
  }
}
