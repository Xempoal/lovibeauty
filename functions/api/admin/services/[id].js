// PATCH /api/admin/services/:id  →  edit name / description / display_order / active
//
// Deactivating (active=false) is blocked while the service still has bookings in
// pending_payment or confirmed (across any of its options). Completed bookings
// don't block — they're historical and kept intact. Nothing is ever deleted.

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
  if (body.display_order !== undefined) {
    const o = parseInt(body.display_order, 10);
    if (Number.isFinite(o)) patch.display_order = o;
  }
  if (body.active !== undefined) patch.active = !!body.active;

  if (Object.keys(patch).length === 0) return badRequest('nada que actualizar');

  // Guard: block deactivation when active appointments exist.
  if (patch.active === false) {
    try {
      const opts = await sb(env, 'service_options?select=id&service_id=eq.' + encodeURIComponent(id));
      const ids = (opts || []).map(function (o) { return o.id; });
      const count = await activeBookingCount(env, ids);
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
    const rows = await sb(env, 'services?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    if (!rows || rows.length === 0) return json({ error: 'servicio no encontrado' }, 404);
    return json({ service: rows[0] });
  } catch (err) {
    return serverError(err.message);
  }
}
