// GET  /api/admin/banners  →  list all banners (incl. inactive) for the panel
// POST /api/admin/banners  →  create a banner
//   body: { title, subtitle?, service_id?, display_order? }
// image_url is set later via POST /api/admin/banners/:id/image.

import { json, badRequest, serverError, requireAuth, sb } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  try {
    const rows = await sb(env, 'banners?select=*&order=display_order&order=id');
    return json({ banners: rows || [] });
  } catch (err) {
    return serverError(err.message);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }

  const title = (body.title || '').trim();
  if (!title) return badRequest('El título es obligatorio');

  let serviceId = null;
  if (body.service_id != null && body.service_id !== '') {
    serviceId = parseInt(body.service_id, 10);
    if (!Number.isFinite(serviceId)) return badRequest('Servicio inválido');
  }

  // display_order: use provided, else append after the current max.
  let order = parseInt(body.display_order, 10);
  if (!Number.isFinite(order)) {
    try {
      const top = await sb(env, 'banners?select=display_order&order=display_order.desc&limit=1');
      order = top && top.length ? (top[0].display_order || 0) + 1 : 1;
    } catch (_) { order = 1; }
  }

  try {
    const rows = await sb(env, 'banners', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        title: title,
        subtitle: (body.subtitle || '').trim() || null,
        service_id: serviceId,
        display_order: order,
        active: true,
      },
    });
    return json({ banner: rows && rows[0] }, 201);
  } catch (err) {
    return serverError(err.message);
  }
}
