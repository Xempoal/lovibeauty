// POST /api/admin/service-options  →  create a sub-service (option) under a service
//   body: { service_id, name, description?, price, duration_minutes, display_order? }

import { json, badRequest, serverError, requireAuth, sb, slugify } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }

  const serviceId = parseInt(body.service_id, 10);
  if (!Number.isFinite(serviceId)) return badRequest('service_id requerido');

  const name = (body.name || '').trim();
  if (!name) return badRequest('El nombre es obligatorio');

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return badRequest('Precio inválido');

  const duration = parseInt(body.duration_minutes, 10);
  if (!Number.isFinite(duration) || duration <= 0) return badRequest('Duración inválida');

  // Confirm the parent exists.
  try {
    const parent = await sb(env, 'services?select=id&id=eq.' + serviceId);
    if (!parent || parent.length === 0) return badRequest('El servicio padre no existe');
  } catch (err) { return serverError(err.message); }

  // Unique slug within (service_id, slug).
  let slug = slugify(name);
  try {
    const existing = await sb(env,
      'service_options?select=id&service_id=eq.' + serviceId + '&slug=eq.' + encodeURIComponent(slug));
    if (existing && existing.length) slug = slug + '-' + (Date.now() % 100000);
  } catch (_) { /* unique constraint is the backstop */ }

  let order = parseInt(body.display_order, 10);
  if (!Number.isFinite(order)) {
    try {
      const top = await sb(env,
        'service_options?select=display_order&service_id=eq.' + serviceId +
        '&order=display_order.desc&limit=1');
      order = top && top.length ? (top[0].display_order || 0) + 1 : 1;
    } catch (_) { order = 1; }
  }

  try {
    const rows = await sb(env, 'service_options', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        service_id: serviceId,
        slug: slug,
        name: name,
        description: (body.description || '').trim() || null,
        price: price,
        duration_minutes: duration,
        display_order: order,
        active: true,
      },
    });
    return json({ option: rows && rows[0] }, 201);
  } catch (err) {
    return serverError(err.message);
  }
}
