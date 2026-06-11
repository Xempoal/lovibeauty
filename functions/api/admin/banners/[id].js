// PATCH  /api/admin/banners/:id  →  edit title / subtitle / service_id / display_order / active
// DELETE /api/admin/banners/:id  →  remove the banner (and its image in our bucket)

import { json, badRequest, serverError, requireAuth, sb, readJson,
         storageDelete, bucketPathFromUrl } from '../_lib.js';

export async function onRequestPatch({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  const body = await readJson(request);
  const patch = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return badRequest('El título no puede quedar vacío');
    patch.title = t;
  }
  if (body.subtitle !== undefined) patch.subtitle = String(body.subtitle).trim() || null;
  if (body.service_id !== undefined) {
    if (body.service_id === null || body.service_id === '') {
      patch.service_id = null;
    } else {
      const s = parseInt(body.service_id, 10);
      if (!Number.isFinite(s)) return badRequest('Servicio inválido');
      patch.service_id = s;
    }
  }
  if (body.display_order !== undefined) {
    const o = parseInt(body.display_order, 10);
    if (Number.isFinite(o)) patch.display_order = o;
  }
  if (body.active !== undefined) patch.active = !!body.active;

  if (Object.keys(patch).length === 0) return badRequest('nada que actualizar');

  try {
    const rows = await sb(env, 'banners?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: patch,
    });
    if (!rows || rows.length === 0) return json({ error: 'banner no encontrado' }, 404);
    return json({ banner: rows[0] });
  } catch (err) {
    return serverError(err.message);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  try {
    const rows = await sb(env, 'banners?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!rows || rows.length === 0) return json({ error: 'banner no encontrado' }, 404);
    // Best-effort cleanup of the image if it lives in our bucket.
    const oldPath = bucketPathFromUrl(rows[0].image_url);
    if (oldPath) await storageDelete(env, oldPath);
    return json({ ok: true });
  } catch (err) {
    return serverError(err.message);
  }
}
