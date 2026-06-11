// GET /api/admin/catalog  →  every service + nested options (including inactive)
//
// Uses the service-role key so the admin sees inactive rows too (the customer
// catalog only ever sees active ones, guarded by RLS + the .eq('active') query).

import { json, serverError, requireAuth, sb } from './_lib.js';

const SELECT =
  'id,slug,name,description,image_url,display_order,active,' +
  'service_options(id,service_id,slug,name,description,price,duration_minutes,display_order,active)';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth) return auth;

  try {
    const rows = await sb(
      env,
      'services?select=' + encodeURIComponent(SELECT) + '&order=display_order.asc,id.asc'
    );
    const services = (rows || []).map(function (s) {
      const opts = (s.service_options || []).slice().sort(function (a, b) {
        return (a.display_order - b.display_order) || (a.id - b.id);
      }).map(function (o) {
        return {
          id: o.id, service_id: o.service_id, slug: o.slug, name: o.name,
          description: o.description, price: o.price != null ? Number(o.price) : null,
          duration_minutes: o.duration_minutes, display_order: o.display_order, active: o.active,
        };
      });
      return {
        id: s.id, slug: s.slug, name: s.name, description: s.description,
        image_url: s.image_url, display_order: s.display_order, active: s.active,
        options: opts,
      };
    });
    return json({ services });
  } catch (err) {
    return serverError(err.message);
  }
}
