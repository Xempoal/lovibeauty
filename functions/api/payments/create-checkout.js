// POST /api/payments/create-checkout   body: { bookingId }
//
// Crea un checkout alojado con el proveedor activo y devuelve { url }. El
// navegador redirige a esa URL para cobrar con tarjeta. Tras pagar, el proveedor
// regresa a PUBLIC_SITE_URL/?pago=ok&cita=<id> y, en paralelo, llama al webhook
// (/api/payments/webhook) que es quien confirma la cita de verdad.
//
// Devuelve 503 si los pagos no están configurados (comportamiento por defecto),
// para que el frontend caiga limpiamente a "Próximamente".

import { json, badRequest, serverError, readJson } from '../admin/_lib.js';
import {
  getPaymentConfig, loadBooking, getDepositAmount, amountForBooking,
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  const cfg = getPaymentConfig(env);
  if (!cfg.enabled) return json({ error: 'Pagos con tarjeta no disponibles' }, 503);
  if (!cfg.siteUrl) return serverError('Falta PUBLIC_SITE_URL en el entorno');

  const body = await readJson(request);
  const bookingId = body.bookingId || body.booking_id;
  if (!bookingId) return badRequest('bookingId requerido');

  let booking;
  try {
    booking = await loadBooking(env, bookingId);
  } catch (err) {
    return serverError('No se pudo leer la cita: ' + err.message);
  }
  if (!booking) return json({ error: 'Cita no encontrada' }, 404);
  if (booking.payment_status === 'paid') return json({ error: 'Esta cita ya está pagada' }, 409);

  const deposit = await getDepositAmount(env);
  const amount  = amountForBooking(cfg, booking, deposit);
  const ctx = { env, cfg, booking, amount, bookingId };

  try {
    let url;
    if (cfg.provider === 'stripe')           url = await stripeCheckout(ctx);
    else if (cfg.provider === 'mercadopago') url = await mercadopagoCheckout(ctx);
    else if (cfg.provider === 'paypal')      url = await paypalCheckout(ctx);
    else return json({ error: 'Proveedor no soportado: ' + cfg.provider }, 501);

    if (!url) return serverError('El proveedor no devolvió URL de checkout');
    return json({ url });
  } catch (err) {
    return serverError('Pago (' + cfg.provider + '): ' + err.message);
  }
}

function returnUrls(cfg, bookingId) {
  const q = '/?cita=' + encodeURIComponent(bookingId) + '&pago=';
  return {
    success: cfg.siteUrl + q + 'ok',
    pending: cfg.siteUrl + q + 'pendiente',
    failure: cfg.siteUrl + q + 'cancelado',
  };
}

// ─── Stripe Checkout (REST, sin SDK) ─────────────────────────────────────────
async function stripeCheckout({ env, cfg, booking, amount, bookingId }) {
  const u = returnUrls(cfg, bookingId);
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', u.success);
  form.set('cancel_url', u.failure);
  form.set('client_reference_id', bookingId);
  form.set('metadata[booking_id]', bookingId);
  form.set('payment_intent_data[metadata][booking_id]', bookingId);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', cfg.currency.toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
  form.set('line_items[0][price_data][product_data][name]',
    'LoviBeauty — ' + (booking.service_option_name || 'Cita'));
  if (booking.email) form.set('customer_email', booking.email);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || ('Stripe ' + res.status));
  return data.url;
}

// ─── Mercado Pago Checkout Pro (REST) ────────────────────────────────────────
async function mercadopagoCheckout({ env, cfg, booking, amount, bookingId }) {
  const u = returnUrls(cfg, bookingId);
  const pref = {
    items: [{
      title: 'LoviBeauty — ' + (booking.service_option_name || 'Cita'),
      quantity: 1,
      unit_price: Number(amount),
      currency_id: cfg.currency,
    }],
    external_reference: bookingId,
    back_urls: { success: u.success, pending: u.pending, failure: u.failure },
    auto_return: 'approved',
    notification_url: cfg.siteUrl + '/api/payments/webhook',
  };
  if (booking.email) pref.payer = { email: booking.email };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.MERCADOPAGO_ACCESS_TOKEN,
      'content-type': 'application/json',
    },
    body: JSON.stringify(pref),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || ('Mercado Pago ' + res.status));
  return data.init_point || data.sandbox_init_point;
}

// ─── PayPal Orders v2 (REST) ─────────────────────────────────────────────────
// Nota: PayPal requiere capturar la orden tras la aprobación. Aquí creamos la
// orden y devolvemos el link "approve"; la captura/confirmación se completa en
// el webhook (PAYMENT.CAPTURE.COMPLETED) o tras el retorno. Revisar al activar.
async function paypalCheckout({ env, cfg, booking, amount, bookingId }) {
  const base = (String(env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live')
    ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const u = returnUrls(cfg, bookingId);

  const auth = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET);
  const tokRes = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const tok = await tokRes.json();
  if (!tokRes.ok) throw new Error('PayPal auth ' + tokRes.status);

  const orderRes = await fetch(base + '/v2/checkout/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok.access_token, 'content-type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: bookingId,
        description: 'LoviBeauty — ' + (booking.service_option_name || 'Cita'),
        amount: { currency_code: cfg.currency, value: Number(amount).toFixed(2) },
      }],
      application_context: {
        brand_name: 'LoviBeauty',
        user_action: 'PAY_NOW',
        return_url: u.success,
        cancel_url: u.failure,
      },
    }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) throw new Error(order.message || ('PayPal order ' + orderRes.status));
  const approve = (order.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
  if (!approve) throw new Error('PayPal no devolvió link de aprobación');
  return approve.href;
}
