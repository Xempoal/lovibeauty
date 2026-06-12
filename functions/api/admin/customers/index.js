// GET /api/admin/customers  →  every customer, registered accounts first
//
// Accessible to both roles (admin and staff) — the studio uses it to look up a
// client's data and recover her password when she forgets it. Includes the
// loyalty card (visits) when the client has one.

import { json, serverError, requireAuth, sb } from '../_lib.js';

const SELECT =
  'id,full_name,email,phone,password,registered_at,created_at,' +
  'loyalty_cards(card_code,visits,total_visits)';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  try {
    const rows = await sb(
      env,
      'customers?select=' + encodeURIComponent(SELECT) + '&order=created_at.desc&limit=500'
    );
    const customers = (rows || []).map(function (c) {
      const card = Array.isArray(c.loyalty_cards) ? c.loyalty_cards[0] : c.loyalty_cards;
      return {
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        password: c.password,
        registered: !!c.password,
        registered_at: c.registered_at,
        created_at: c.created_at,
        loyalty_visits: card ? card.visits : null,
        loyalty_code: card ? card.card_code : null,
      };
    });
    // Registered accounts first, then guests, newest first within each group.
    customers.sort(function (a, b) {
      if (a.registered !== b.registered) return a.registered ? -1 : 1;
      return a.created_at < b.created_at ? 1 : -1;
    });
    return json({ customers });
  } catch (err) {
    return serverError(err.message);
  }
}
