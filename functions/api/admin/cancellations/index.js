// GET /api/admin/cancellations  →  pending cancellation requests (flattened)

import { json, serverError, requireAuth, sb } from '../_lib.js';

const SELECT =
  'id,booking_id,reason,status,requested_at,' +
  'bookings(booking_date,start_time,end_time,status,guest_name,guest_phone,' +
  'service_options(name),customers(full_name,phone))';

function flatten(r) {
  const b = r.bookings || {};
  const opt = b.service_options || {};
  const cust = b.customers || {};
  return {
    id: r.id,
    booking_id: r.booking_id,
    reason: r.reason,
    status: r.status,
    requested_at: r.requested_at,
    booking_status: b.status || null,
    date: b.booking_date || null,
    start_time: (b.start_time || '').slice(0, 5),
    service_name: opt.name || null,
    customer_name: cust.full_name || b.guest_name || 'Clienta',
    phone: cust.phone || b.guest_phone || '',
  };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  try {
    const rows = await sb(
      env,
      'cancellation_requests?select=' + encodeURIComponent(SELECT) +
        '&status=eq.pending&order=requested_at.asc'
    );
    return json({ requests: (rows || []).map(flatten) });
  } catch (err) {
    return serverError(err.message);
  }
}
