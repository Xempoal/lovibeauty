// GET /api/admin/bookings?date=YYYY-MM-DD  →  bookings for that day (flattened)
//
// Returns every booking on the date (any status) joined with its service option,
// parent service, and customer. The frontend computes the KPIs.

import { json, badRequest, serverError, requireAuth, sb } from '../_lib.js';

const SELECT =
  'id,booking_date,start_time,end_time,status,payment_method,payment_status,' +
  'payment_amount,payment_reference,notes,staff_name,guest_name,guest_email,guest_phone,' +
  'created_at,admin_confirmed_at,' +
  'service_options(name,price,duration_minutes,services(name)),' +
  'customers(full_name,email,phone)';

function flatten(b) {
  const opt = b.service_options || {};
  const svc = opt.services || {};
  const cust = b.customers || {};
  return {
    id: b.id,
    date: b.booking_date,
    start_time: (b.start_time || '').slice(0, 5),
    end_time: (b.end_time || '').slice(0, 5),
    status: b.status,
    payment_method: b.payment_method,
    payment_status: b.payment_status,
    payment_amount: b.payment_amount,
    payment_reference: b.payment_reference,
    notes: b.notes,
    staff_name: b.staff_name,
    created_at: b.created_at,
    admin_confirmed_at: b.admin_confirmed_at,
    service_name: svc.name || null,
    option_name: opt.name || null,
    price: opt.price != null ? Number(opt.price) : null,
    duration_minutes: opt.duration_minutes || null,
    customer_name: cust.full_name || b.guest_name || 'Clienta',
    phone: cust.phone || b.guest_phone || '',
    email: cust.email || b.guest_email || '',
  };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date=YYYY-MM-DD requerido');

  try {
    const rows = await sb(
      env,
      'bookings?select=' + encodeURIComponent(SELECT) +
        '&booking_date=eq.' + date + '&order=start_time.asc'
    );
    return json({ date, bookings: (rows || []).map(flatten) });
  } catch (err) {
    return serverError(err.message);
  }
}
