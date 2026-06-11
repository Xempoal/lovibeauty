// LoviBeauty — shared helpers for the admin API (Cloudflare Pages Functions).
//
// Every admin route runs server-side and talks to Supabase with the
// SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. That key never reaches the
// browser. The browser authenticates each request with a Bearer token minted by
// /api/admin/login after the PIN check; the token is a stateless HMAC blob so we
// don't need a sessions table.

const TOKEN_TTL_MS = 9 * 60 * 60 * 1000; // 9 hours

// ─── JSON responses ──────────────────────────────────────────────────────────
export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function badRequest(msg) { return json({ error: msg || 'bad request' }, 400); }
export function unauthorized(msg) { return json({ error: msg || 'unauthorized' }, 401); }
export function serverError(msg) { return json({ error: msg || 'server error' }, 500); }

// ─── base64url helpers ───────────────────────────────────────────────────────
function b64urlFromString(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function stringFromB64url(b) {
  b = b.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b)));
}
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── token (HMAC-SHA256) ─────────────────────────────────────────────────────
function tokenSecret(env) {
  // Tie the signing key to both the PIN and the service-role key: rotating
  // either invalidates every outstanding token.
  return String(env.ADMIN_PIN || '') + '.' + String(env.SUPABASE_SERVICE_ROLE_KEY || '');
}

async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64urlFromBytes(new Uint8Array(sig));
}

export async function signToken(env) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const body = b64urlFromString(JSON.stringify({ exp: expiresAt }));
  const sig = await hmac(tokenSecret(env), body);
  return { token: body + '.' + sig, expiresAt };
}

async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(tokenSecret(env), body);
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(stringFromB64url(body));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch (_) {
    return false;
  }
}

// Returns null when authorized, or a 401 Response to return immediately.
export async function requireAuth(request, env) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  const ok = m && (await verifyToken(env, m[1]));
  return ok ? null : unauthorized();
}

// ─── Supabase REST (PostgREST) with the service-role key ─────────────────────
export async function sb(env, path, options) {
  options = options || {};
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env vars missing');
  }
  const url = env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
  const headers = Object.assign({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
    'content-type': 'application/json',
  }, options.headers || {});

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (_) { data = text; } }

  if (!res.ok) {
    const err = new Error((data && data.message) || ('Supabase ' + res.status));
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

// ─── PIN hashing (SHA-256 + random per-PIN salt) ─────────────────────────────
// Stored format: "sha256$<saltHex>$<digestHex>". The owner's PIN lives hashed in
// business_config.admin_pin, so even a DB dump never reveals it in plaintext.
function bufToHex(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}
function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return bufToHex(a.buffer);
}

export async function hashPin(pin, salt) {
  salt = salt || randomHex(16);
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + String(pin)));
  return 'sha256$' + salt + '$' + bufToHex(digest);
}

export async function verifyPin(pin, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const recomputed = await hashPin(pin, parts[1]);
  // constant-time-ish compare
  if (recomputed.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < recomputed.length; i++) diff |= recomputed.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

// The owner-set PIN hash, or null when none is stored (or the table doesn't
// exist yet). Read with the service-role key, which bypasses RLS — the anon
// role is blocked from this row by the policy in migration 003.
export async function getStoredAdminPin(env) {
  try {
    const rows = await sb(env, 'business_config?select=value&key=eq.admin_pin');
    return rows && rows[0] && rows[0].value ? rows[0].value : null;
  } catch (_) {
    return null;
  }
}

// Read the request JSON body, tolerating an empty body.
export async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return {};
  }
}
