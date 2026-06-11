// POST /api/admin/login  →  { pin }  →  { token, expiresAt }
//
// Single-admin login by 6-digit PIN. The effective PIN is the one the owner set
// from the panel (business_config.admin_pin, hashed); if none is stored we fall
// back to env.ADMIN_PIN (dev/.env or a wrangler secret). On success we mint a
// 9-hour HMAC token.
//
// Rate limit: at most 3 failed attempts per minute per IP. The window self-cleans
// (old timestamps are dropped on access), so no cron is needed. State is an
// in-memory Map — adequate for a single low-traffic studio admin.

import { json, signToken, readJson, getStoredAdminPin, verifyPin } from './_lib.js';

const WINDOW_MS = 60 * 1000;
const MAX_FAILS = 3;
const failures = new Map(); // ip -> [timestamps of recent failed attempts]

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

// Recent failures within the window, pruning anything older.
function recentFails(ip, now) {
  const arr = (failures.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length) failures.set(ip, arr); else failures.delete(ip);
  return arr;
}

export async function onRequestPost({ request, env }) {
  const ip = clientIp(request);
  const now = Date.now();

  if (recentFails(ip, now).length >= MAX_FAILS) {
    return json({ error: 'Demasiados intentos, espera 1 minuto' }, 429);
  }

  function fail(msg, status) {
    const arr = recentFails(ip, now);
    arr.push(now);
    failures.set(ip, arr);
    return json({ error: msg }, status || 401);
  }

  const body = await readJson(request);
  const pin = (body.pin == null ? '' : String(body.pin)).trim();
  if (!/^\d{4,8}$/.test(pin)) return fail('PIN inválido', 400);

  // Prefer the owner-set PIN; fall back to the server env PIN.
  const stored = await getStoredAdminPin(env);
  let ok;
  if (stored) {
    ok = await verifyPin(pin, stored);
  } else {
    const expected = String(env.ADMIN_PIN || '');
    if (!expected) return json({ error: 'ADMIN_PIN no configurado en el servidor' }, 500);
    if (pin.length !== expected.length) ok = false;
    else {
      let diff = 0;
      for (let i = 0; i < pin.length; i++) diff |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
      ok = diff === 0;
    }
  }

  if (!ok) return fail('PIN incorrecto', 401);

  failures.delete(ip); // clear the IP's strikes on a successful login
  const { token, expiresAt } = await signToken(env);
  return json({ token, expiresAt });
}
