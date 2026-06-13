// LoviBeauty — capa de pagos agnóstica al proveedor (Cloudflare Pages Functions).
//
// Objetivo: tener TODA la plomería lista para que el estudio conecte Stripe,
// Mercado Pago, PayPal (u otra pasarela) configurando solo variables de entorno,
// sin tocar más código.
//
// Diseño:
//   * Un proveedor activo a la vez, elegido por env PAYMENT_PROVIDER.
//   * Los SECRETOS viven solo en variables de entorno de Cloudflare (nunca en la
//     base de datos ni en el navegador).
//   * Modelo "checkout alojado": el backend crea el checkout y devuelve una URL;
//     el navegador solo redirige ahí. Por eso ni siquiera hace falta la llave
//     pública en el navegador.
//   * El WEBHOOK es la fuente de verdad: marca la cita como pagada/confirmada y
//     es idempotente gracias a payment_events (unique provider+event_id).
//
// Cómo conectar un proveedor real (ejemplo, una sola vez):
//   wrangler pages secret put PAYMENT_PROVIDER          # stripe | mercadopago | paypal
//   wrangler pages secret put PUBLIC_SITE_URL           # https://tudominio.com
//   wrangler pages secret put STRIPE_SECRET_KEY         # (o el secreto del proveedor)
//   wrangler pages secret put STRIPE_WEBHOOK_SECRET
//   # …y apuntar el webhook del proveedor a  /api/payments/webhook
//   En cuanto exista el secreto, el botón "Pagar con tarjeta" se activa solo.

import { sb } from '../admin/_lib.js';

// ─── Config derivada del entorno ─────────────────────────────────────────────
export function getPaymentConfig(env) {
  const provider = String(env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  const currency = String(env.PAYMENT_CURRENCY || 'MXN').trim().toUpperCase();
  const charge   = String(env.PAYMENT_CHARGE || 'deposit').trim().toLowerCase() === 'full'
    ? 'full' : 'deposit';
  const siteUrl  = String(env.PUBLIC_SITE_URL || '').replace(/\/$/, '');

  // "Habilitado" = hay un proveedor elegido Y su secreto está presente.
  let secretPresent = false;
  if (provider === 'stripe')          secretPresent = !!env.STRIPE_SECRET_KEY;
  else if (provider === 'mercadopago') secretPresent = !!env.MERCADOPAGO_ACCESS_TOKEN;
  else if (provider === 'paypal')      secretPresent = !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);

  return { provider, currency, charge, siteUrl, enabled: !!provider && secretPresent };
}

// Monto del anticipo (business_config.deposit_amount), con respaldo $100.
export async function getDepositAmount(env) {
  try {
    const rows = await sb(env, 'business_config?select=value&key=eq.deposit_amount');
    const v = rows && rows[0] ? parseFloat(rows[0].value) : NaN;
    return v > 0 ? v : 100;
  } catch (_) {
    return 100;
  }
}

// Lee una reserva por su UUID vía el RPC get_booking (incluye price + nombres).
export async function loadBooking(env, id) {
  const rows = await sb(env, 'rpc/get_booking', { method: 'POST', body: { p_id: id } });
  return Array.isArray(rows) ? rows[0] : rows;
}

// Cuánto cobrar: total del servicio o anticipo, según PAYMENT_CHARGE.
export function amountForBooking(cfg, booking, deposit) {
  if (cfg.charge === 'full') return Number(booking.price);
  return Number(deposit);
}

// Registra el evento del webhook. Devuelve true si es nuevo, false si ya existía
// (idempotencia: el proveedor reintenta el mismo evento y no lo procesamos dos veces).
export async function recordPaymentEvent(env, ev) {
  try {
    await sb(env, 'payment_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: {
        booking_id: ev.bookingId || null,
        provider:   ev.provider,
        event_id:   String(ev.eventId),
        status:     ev.status || null,
        amount:     ev.amount != null ? ev.amount : null,
        raw:        ev.raw || null,
      },
    });
    return true;
  } catch (err) {
    if (err.status === 409) return false; // unique violation → ya procesado
    throw err;
  }
}

// Marca la cita como pagada y confirmada (lo llama el webhook con service_role).
export async function markBookingPaid(env, bookingId, info) {
  const patch = {
    status: 'confirmed',
    payment_status: 'paid',
    payment_method: info.method || 'card',
    admin_confirmed_at: new Date().toISOString(),
  };
  if (info.reference != null) patch.payment_reference = info.reference;
  if (info.amount != null)    patch.payment_amount = info.amount;
  const rows = await sb(env, 'bookings?id=eq.' + encodeURIComponent(bookingId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: patch,
  });
  return rows && rows[0];
}

// Comparación de strings en tiempo ~constante (para verificar firmas de webhook).
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bytesToHex(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

export async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bytesToHex(sig);
}
