// Manage admin date/time blocks. The customer calendar already respects these
// through get_availability().
//
//   GET    /api/admin/blocked-slots            → upcoming blocks
//   POST   /api/admin/blocked-slots            → { blocked_date, start_time?, end_time?, reason? }
//   DELETE /api/admin/blocked-slots?id=123     → remove a block
//
// A block with no start/end is a full-day block (stored as 00:00–23:59, since the
// table requires both times and end > start).

import { json, badRequest, serverError, requireAuth, sb, readJson } from '../_lib.js';

const FULL_DAY_START = '00:00:00';
const FULL_DAY_END = '23:59:00';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const rows = await sb(
      env,
      'blocked_slots?select=id,blocked_date,start_time,end_time,reason' +
        '&blocked_date=gte.' + today +
        '&order=blocked_date.asc,start_time.asc'
    );
    const blocks = (rows || []).map(function (b) {
      const start = (b.start_time || '').slice(0, 5);
      const end = (b.end_time || '').slice(0, 5);
      return {
        id: b.id,
        blocked_date: b.blocked_date,
        start_time: start,
        end_time: end,
        reason: b.reason || '',
        full_day: start === '00:00' && end === '23:59',
      };
    });
    return json({ blocks });
  } catch (err) {
    return serverError(err.message);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const body = await readJson(request);
  const date = (body.blocked_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('blocked_date=YYYY-MM-DD requerido');

  let start = (body.start_time || '').trim();
  let end = (body.end_time || '').trim();

  if (!start && !end) {
    start = FULL_DAY_START;
    end = FULL_DAY_END;
  } else {
    if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) {
      return badRequest('start_time y end_time deben ser HH:MM');
    }
    if (end <= start) return badRequest('end_time debe ser mayor que start_time');
  }

  try {
    const rows = await sb(env, 'blocked_slots', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: { blocked_date: date, start_time: start, end_time: end, reason: (body.reason || '').trim() || null },
    });
    return json({ block: rows && rows[0] }, 201);
  } catch (err) {
    return serverError(err.message);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return badRequest('id requerido');

  try {
    await sb(env, 'blocked_slots?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
    return json({ ok: true });
  } catch (err) {
    return serverError(err.message);
  }
}
