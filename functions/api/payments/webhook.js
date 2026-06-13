// POST /api/payments/webhook
//
// Recibe la notificación del proveedor y CONFIRMA la cita (status=confirmed,
// payment_status=paid). Es la fuente de verdad del pago. Idempotente: registra
// cada evento en payment_events (unique provider+event_id) y si llega repetido
// lo ignora.
//
// Configura la URL de este webhook en el panel del proveedor:
//   Stripe       → Developers → Webhooks → https://tudominio/api/payments/webhook
//                  (evento: checkout.session.completed)  + STRIPE_WEBHOOK_SECRET
//   Mercado Pago → Notificaciones/IPN → mismo URL (topic payment)
//   PayPal       → Webhooks → mismo URL (PAYMENT.CAPTURE.COMPLETED)

import { json } from '../admin/_lib.js';
import {
  getPaymentConfig, recordPaymentEvent, markBookingPaid,
  timingSafeEqual, hmacSha256Hex,
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  const cfg = getPaymentConfig(env);
  if (!cfg.enabled) return json({ error: 'pagos desactivados' }, 503);

  const rawBody = await request.text();
  try {
    if (cfg.provider === 'stripe')      return await handleStripe(env, request, rawBody);
    if (cfg.provider === 'mercadopago') return await handleMercadoPago(env, request, rawBody);
    if (cfg.provider === 'paypal')      return await handlePayPal(env, request, rawBody);
    return json({ error: 'proveedor no soportado' }, 501);
  } catch (err) {
    // 400 → el proveedor reintentará; útil mientras se afina la integración.
    return json({ error: err.message }, 400);
  }
}

// ─── Stripe ──────────────────────────────────────────────────────────────────
async function handleStripe(env, request, rawBody) {
  // Verifica la firma (Stripe-Signature: t=...,v1=...) con STRIPE_WEBHOOK_SECRET.
  const secret = env.STRIPE_WEBHOOK_SECRET;
  const sigHeader = request.headers.get('stripe-signature') || '';
  if (secret) {
    const ok = await verifyStripeSignature(secret, rawBody, sigHeader);
    if (!ok) return json({ error: 'firma inválida' }, 400);
  }

  const event = JSON.parse(rawBody);
  if (event.type !== 'checkout.session.completed') {
    return json({ received: true, ignored: event.type });
  }
  const session = event.data && event.data.object ? event.data.object : {};
  const bookingId = (session.metadata && session.metadata.booking_id) || session.client_reference_id;
  const paid = session.payment_status === 'paid';
  if (!bookingId || !paid) return json({ received: true });

  const isNew = await recordPaymentEvent(env, {
    bookingId, provider: 'stripe', eventId: event.id,
    status: session.payment_status,
    amount: session.amount_total != null ? session.amount_total / 100 : null,
    raw: event,
  });
  if (isNew) {
    await markBookingPaid(env, bookingId, {
      method: 'stripe',
      reference: session.payment_intent || session.id,
      amount: session.amount_total != null ? session.amount_total / 100 : null,
    });
  }
  return json({ received: true });
}

async function verifyStripeSignature(secret, payload, sigHeader) {
  const parts = {};
  sigHeader.split(',').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > 0) { const k = kv.slice(0, i).trim(); if (!(k in parts)) parts[k] = kv.slice(i + 1).trim(); }
  });
  if (!parts.t || !parts.v1) return false;
  const expected = await hmacSha256Hex(secret, parts.t + '.' + payload);
  return timingSafeEqual(expected, parts.v1);
}

// ─── Mercado Pago ────────────────────────────────────────────────────────────
// MP notifica con { type:'payment', data:{ id } } (o ?topic=payment&id=). Hay que
// consultar el pago para conocer su estado y el external_reference (booking id).
async function handleMercadoPago(env, request, rawBody) {
  let body = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) { /* puede venir por query */ }
  const url = new URL(request.url);
  const type = body.type || body.topic || url.searchParams.get('topic') || url.searchParams.get('type');
  const paymentId = (body.data && body.data.id) || url.searchParams.get('id') ||
    (body.resource && String(body.resource).split('/').pop());
  if (type !== 'payment' || !paymentId) return json({ received: true, ignored: type || 'unknown' });

  const res = await fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
    headers: { Authorization: 'Bearer ' + env.MERCADOPAGO_ACCESS_TOKEN },
  });
  const pay = await res.json();
  if (!res.ok) throw new Error(pay.message || ('Mercado Pago ' + res.status));

  const bookingId = pay.external_reference;
  if (!bookingId) return json({ received: true });
  if (pay.status !== 'approved') {
    await recordPaymentEvent(env, {
      bookingId, provider: 'mercadopago', eventId: String(pay.id),
      status: pay.status, amount: pay.transaction_amount, raw: pay,
    });
    return json({ received: true, status: pay.status });
  }

  const isNew = await recordPaymentEvent(env, {
    bookingId, provider: 'mercadopago', eventId: String(pay.id),
    status: pay.status, amount: pay.transaction_amount, raw: pay,
  });
  if (isNew) {
    await markBookingPaid(env, bookingId, {
      method: 'mercadopago', reference: String(pay.id), amount: pay.transaction_amount,
    });
  }
  return json({ received: true });
}

// ─── PayPal ──────────────────────────────────────────────────────────────────
// Punto de partida: registra el evento y confirma si viene COMPLETED. Para
// producción conviene verificar la firma del webhook de PayPal (verify-webhook-
// signature) y, si la orden quedó solo aprobada, capturarla antes de confirmar.
async function handlePayPal(env, request, rawBody) {
  const event = rawBody ? JSON.parse(rawBody) : {};
  const eventType = event.event_type || '';
  const resource = event.resource || {};
  const bookingId =
    (resource.purchase_units && resource.purchase_units[0] && resource.purchase_units[0].reference_id) ||
    resource.custom_id ||
    (resource.supplementary_data && resource.supplementary_data.related_ids &&
      resource.supplementary_data.related_ids.order_id);

  const completed = eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.COMPLETED';
  if (!bookingId) return json({ received: true });

  const isNew = await recordPaymentEvent(env, {
    bookingId, provider: 'paypal', eventId: event.id || resource.id,
    status: eventType, amount: resource.amount && resource.amount.value ? Number(resource.amount.value) : null,
    raw: event,
  });
  if (isNew && completed) {
    await markBookingPaid(env, bookingId, {
      method: 'paypal', reference: resource.id || event.id,
      amount: resource.amount && resource.amount.value ? Number(resource.amount.value) : null,
    });
  }
  return json({ received: true });
}
