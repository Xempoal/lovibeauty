// POST /api/admin/banners/:id/image  →  upload the photo for a banner
//   body: { data: <base64, no data-URL prefix>, contentType: 'image/jpeg'|'image/png'|'image/webp' }
//
// Uploads to the service-images bucket under banners/, points banners.image_url
// at the new public URL, and deletes the previous object if it lived in our bucket.

import { json, badRequest, serverError, requireAuth, sb, readJson,
         b64ToBytes, storageUpload, storageDelete, bucketPathFromUrl } from '../../_lib.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequestPost({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const id = params.id;
  if (!id) return badRequest('id requerido');

  const body = await readJson(request);
  const contentType = (body.contentType || '').toLowerCase();
  const data = body.data || '';
  if (!EXT[contentType]) return badRequest('Formato no permitido. Usa JPG, PNG o WEBP.');
  if (!data) return badRequest('Falta la imagen');

  let bytes;
  try { bytes = b64ToBytes(data); } catch (_) { return badRequest('Imagen inválida'); }
  if (bytes.length === 0) return badRequest('Imagen vacía');
  if (bytes.length > MAX_BYTES) return badRequest('La imagen supera 5 MB');

  let current;
  try {
    const rows = await sb(env, 'banners?select=id,image_url&id=eq.' + encodeURIComponent(id));
    if (!rows || rows.length === 0) return json({ error: 'banner no encontrado' }, 404);
    current = rows[0];
  } catch (err) {
    return serverError(err.message);
  }

  const path = 'banners/' + id + '-' + Date.now() + '.' + EXT[contentType];

  let publicUrl;
  try {
    publicUrl = await storageUpload(env, path, bytes, contentType);
  } catch (err) {
    return serverError(err.message);
  }

  try {
    const rows = await sb(env, 'banners?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { image_url: publicUrl },
    });
    const oldPath = bucketPathFromUrl(current.image_url);
    if (oldPath && oldPath !== path) await storageDelete(env, oldPath);
    return json({ banner: rows && rows[0], image_url: publicUrl });
  } catch (err) {
    await storageDelete(env, path);
    return serverError(err.message);
  }
}
