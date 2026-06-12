// PATCH /api/admin/bookings/:id  →  update status / payment
//
// Accepts any subset of: status, payment_status, payment_reference,
// payment_amount, notes, staff_name. Convenience: when the booking becomes 'confirmed' or
// payment turns 'paid', we stamp admin_confirmed_at (unless caller set it).

import { json, badRequest, serverError, requireAuth, sb, readJson } from '../_lib.js';

const STATUSES = ['pending_payment', 'confirmed', 'cancelled', 'expired', 'completed'];
const PAY_STATUSES = ['pending', 'paid'];

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  const body = await readJson(request);
  const patch = {};

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return badRequest('status inválido');
    patch.status = body.status;
  }
  if (body.payment_status !== undefined) {
    if (!PAY_STATUSES.includes(body.payment_status)) return badRequest('payment_status inválido');
    patch.payment_status = body.payment_status;
  }
  if (body.payment_reference !== undefined) patch.payment_reference = body.payment_reference;
  if (body.payment_amount !== undefined) patch.payment_amount = body.payment_amount;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.staff_name !== undefined) {
    const name = String(body.staff_name || '').trim();
    patch.staff_name = name || null;
  }

  if (Object.keys(patch).length === 0) return badRequest('nada que actualizar');

  if (body.admin_confirmed_at !== undefined) {
    patch.admin_confirmed_at = body.admin_confirmed_at;
  } else if (patch.status === 'confirmed' || patch.payment_status === 'paid') {
    patch.admin_confirmed_at = new Date().toISOString();
  }

  try {
    const rows = await sb(env, 'bookings?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    if (!rows || rows.length === 0) return json({ error: 'cita no encontrada' }, 404);
    return json({ booking: rows[0] });
  } catch (err) {
    return serverError(err.message);
  }
}
