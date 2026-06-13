// GET /api/payments/config
//
// Config pública de pagos que el navegador necesita para saber si mostrar el
// botón "Pagar con tarjeta". Nunca devuelve secretos: solo si está habilitado,
// qué proveedor está activo, la moneda y qué se cobra (anticipo o total).
//
// Mientras no se configuren las llaves del proveedor en Cloudflare, responde
// { enabled: false } y el sitio sigue ofreciendo solo transferencia.

import { json } from '../admin/_lib.js';
import { getPaymentConfig } from './_shared.js';

export function onRequestGet({ env }) {
  const cfg = getPaymentConfig(env);
  return json({
    enabled:  cfg.enabled,
    provider: cfg.enabled ? cfg.provider : null,
    currency: cfg.currency,
    charge:   cfg.charge, // 'deposit' | 'full'
  });
}
