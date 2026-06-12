// POST /api/admin/login  →  { pin }  →  { token, expiresAt, role }
//
// Two PINs, two roles:
//   * Owner PIN — business_config.admin_pin (hashed) or env.ADMIN_PIN fallback.
//     role 'admin': full access.
//   * Staff PIN — env.STAFF_PIN (default 000000). role 'staff': everything
//     except Configuración (bank CLABE, WhatsApp, PIN change).
// On success we mint a 9-hour HMAC token carrying the role.
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

  function constEq(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Prefer the owner-set PIN; fall back to the server env PIN.
  const stored = await getStoredAdminPin(env);
  let ok;
  if (stored) {
    ok = await verifyPin(pin, stored);
  } else {
    const expected = String(env.ADMIN_PIN || '');
    if (!expected) return json({ error: 'ADMIN_PIN no configurado en el servidor' }, 500);
    ok = constEq(pin, expected);
  }

  let role = 'admin';
  if (!ok) {
    // Not the owner — try the staff PIN.
    const staffPin = String(env.STAFF_PIN || '000000');
    if (constEq(pin, staffPin)) { ok = true; role = 'staff'; }
  }

  if (!ok) return fail('PIN incorrecto', 401);

  failures.delete(ip); // clear the IP's strikes on a successful login
  const { token, expiresAt } = await signToken(env, role);
  return json({ token, expiresAt, role });
}
