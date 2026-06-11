// POST /api/admin/login  →  { pin }  →  { token, expiresAt }
//
// Single-admin login by 6-digit PIN. The PIN lives in env.ADMIN_PIN (in .env for
// dev, a wrangler secret in prod). On success we mint a 9-hour HMAC token.

import { json, badRequest, unauthorized, signToken, readJson } from './_lib.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const pin = (body.pin == null ? '' : String(body.pin)).trim();

  if (!/^\d{4,8}$/.test(pin)) return badRequest('PIN inválido');

  const expected = String(env.ADMIN_PIN || '');
  if (!expected) return json({ error: 'ADMIN_PIN no configurado en el servidor' }, 500);

  // Constant-ish time compare (lengths usually equal; fine for a single-user PIN).
  if (pin.length !== expected.length) return unauthorized('PIN incorrecto');
  let diff = 0;
  for (let i = 0; i < pin.length; i++) diff |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return unauthorized('PIN incorrecto');

  const { token, expiresAt } = await signToken(env);
  return json({ token, expiresAt });
}
