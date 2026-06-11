// PATCH /api/admin/service-options/:id  →  edit a sub-service
//   body: { name?, description?, price?, duration_minutes?, display_order?, active? }
//
// Deactivating is blocked while this option has pending_payment/confirmed
// bookings. Completed bookings are kept and don't block. Never deletes.

import { json, badRequest, serverError, requireAuth, sb, readJson, activeBookingCount } from '../_lib.js';

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  const body = await readJson(request);
  const patch = {};
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return badRequest('El nombre no puede quedar vacío');
    patch.name = n;
  }
  if (body.description !== undefined) patch.description = String(body.description).trim() || null;
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0) return badRequest('Precio inválido');
    patch.price = p;
  }
  if (body.duration_minutes !== undefined) {
    const d = parseInt(body.duration_minutes, 10);
    if (!Number.isFinite(d) || d <= 0) return badRequest('Duración inválida');
    patch.duration_minutes = d;
  }
  if (body.display_order !== undefined) {
    const o = parseInt(body.display_order, 10);
    if (Number.isFinite(o)) patch.display_order = o;
  }
  if (body.active !== undefined) patch.active = !!body.active;

  if (Object.keys(patch).length === 0) return badRequest('nada que actualizar');

  if (patch.active === false) {
    try {
      const count = await activeBookingCount(env, [id]);
      if (count > 0) {
        return json({
          error: 'No se puede desactivar. Hay ' + count + ' cita' + (count === 1 ? '' : 's') +
            ' activa' + (count === 1 ? '' : 's') + '. Cancélalas o espera a que se completen.',
          active_bookings: count,
        }, 409);
      }
    } catch (err) {
      return serverError(err.message);
    }
  }

  try {
    const rows = await sb(env, 'service_options?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    if (!rows || rows.length === 0) return json({ error: 'subservicio no encontrado' }, 404);
    return json({ option: rows[0] });
  } catch (err) {
    return serverError(err.message);
  }
}
