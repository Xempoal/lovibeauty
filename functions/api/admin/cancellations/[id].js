// PATCH /api/admin/cancellations/:id  →  { action: 'approve' | 'reject' }
//
// approve → request becomes 'approved' and the booking is cancelled.
// reject  → request becomes 'rejected'; the booking is left untouched.

import { json, badRequest, serverError, requireAuth, sb, readJson } from '../_lib.js';

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  const body = await readJson(request);
  const action = body.action;
  if (action !== 'approve' && action !== 'reject') return badRequest('action debe ser approve o reject');

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  try {
    const rows = await sb(env, 'cancellation_requests?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { status: newStatus, resolved_at: new Date().toISOString() },
    });
    if (!rows || rows.length === 0) return json({ error: 'solicitud no encontrada' }, 404);

    const req = rows[0];
    if (action === 'approve' && req.booking_id) {
      await sb(env, 'bookings?id=eq.' + encodeURIComponent(req.booking_id), {
        method: 'PATCH',
        body: { status: 'cancelled' },
      });
    }
    return json({ request: req });
  } catch (err) {
    return serverError(err.message);
  }
}
