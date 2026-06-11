// POST /api/admin/services  →  create a service (category)
//   body: { name, description?, display_order? }
// image_url is set later via POST /api/admin/services/:id/image.

import { json, badRequest, serverError, requireAuth, sb, slugify } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  let body;
  try { body = await request.json(); } catch (_) { body = {}; }

  const name = (body.name || '').trim();
  if (!name) return badRequest('El nombre es obligatorio');

  // Unique slug: base from name, with a suffix if it already exists.
  let slug = slugify(name);
  try {
    const existing = await sb(env, 'services?select=id&slug=eq.' + encodeURIComponent(slug));
    if (existing && existing.length) slug = slug + '-' + (Date.now() % 100000);
  } catch (_) { /* fall through; unique constraint is the backstop */ }

  // display_order: use provided, else append after the current max.
  let order = parseInt(body.display_order, 10);
  if (!Number.isFinite(order)) {
    try {
      const top = await sb(env, 'services?select=display_order&order=display_order.desc&limit=1');
      order = top && top.length ? (top[0].display_order || 0) + 1 : 1;
    } catch (_) { order = 1; }
  }

  try {
    const rows = await sb(env, 'services', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        slug: slug,
        name: name,
        description: (body.description || '').trim() || null,
        display_order: order,
        active: true,
      },
    });
    return json({ service: rows && rows[0] }, 201);
  } catch (err) {
    return serverError(err.message);
  }
}
