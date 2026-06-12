// LoviBeauty — Supabase client (anon, browser).
//
// SUPABASE_URL and SUPABASE_ANON_KEY are public credentials: the anon role
// only sees what the RLS policies expose (the catalog) and can only mutate
// bookings/customers through the SECURITY DEFINER RPCs declared in
// db/migrations/001_init.sql. The service_role key MUST NEVER ship to the
// browser — it bypasses RLS and is only used from Cloudflare Functions.

(function () {
  const SUPABASE_URL = 'https://wugejvrksywwrzwnjodg.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1Z2VqdnJrc3l3d3J6d25qb2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzk1MDUsImV4cCI6MjA5NjcxNTUwNX0' +
    '.eZBCI51fwOvTpwVNdxBwXc1xpYsFBryHarqos2VCzEY';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[lovibeauty] supabase-js no se cargó antes de supabase-client.js');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  window.lbSupabase = sb;

  // Fallback images for service categories in case the DB row has no image_url.
  // Keyed by service slug. Updating the row in Supabase wins automatically.
  const SERVICE_IMG_FALLBACK = {
    'unas':       'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1000&q=80',
    'makeup':     'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1000&q=80',
    'pedi-spa':   'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1000&q=80',
    'keratina':   'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1000&q=80',
    'especiales': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=1200&q=80',
  };

  function withFallbackImage(svc) {
    return Object.assign({}, svc, {
      image_url: svc.image_url || SERVICE_IMG_FALLBACK[svc.slug] || SERVICE_IMG_FALLBACK['especiales'],
    });
  }

  // Wraps Supabase responses so callers get plain promises that throw on error.
  async function unwrap(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  window.lbApi = {
    async loadServices() {
      const rows = await unwrap(
        sb.from('services')
          .select('id, slug, name, description, image_url, display_order')
          .eq('active', true)
          .order('display_order')
      );
      return rows.map(withFallbackImage);
    },

    async loadBanners() {
      // Home carousel banners. Never throws — a missing table (pre-migration)
      // or an RLS hiccup must not break the home, the UI falls back to a
      // default welcome banner.
      try {
        const rows = await unwrap(
          sb.from('banners')
            .select('id, title, subtitle, image_url, service_id, display_order')
            .eq('active', true)
            .order('display_order')
        );
        return rows || [];
      } catch (e) {
        console.warn('[lovibeauty] banners no disponibles aún', e && e.message);
        return [];
      }
    },

    async loadServiceOptions(serviceId) {
      return unwrap(
        sb.from('service_options')
          .select('id, service_id, slug, name, description, price, duration_minutes, display_order')
          .eq('service_id', serviceId)
          .eq('active', true)
          .order('display_order')
      );
    },

    async loadBusinessConfig() {
      // Public key/value config (bank details, WhatsApp, hold window). The table
      // is RLS-public for SELECT; the admin panel writes it via service_role.
      // Returns a plain { key: value } map. Never throws — falls back to {} so a
      // missing table (pre-migration) doesn't break the booking flow.
      // Only ask for the public keys — never the admin_pin row. RLS also blocks
      // anon from reading admin_pin (migration 003), this is defense in depth.
      const PUBLIC_KEYS = ['bank_clabe', 'bank_name', 'bank_holder', 'whatsapp_number', 'hold_minutes'];
      try {
        const rows = await unwrap(
          sb.from('business_config').select('key, value').in('key', PUBLIC_KEYS)
        );
        const map = {};
        (rows || []).forEach((r) => { map[r.key] = r.value; });
        return map;
      } catch (e) {
        console.warn('[lovibeauty] business_config no disponible aún', e && e.message);
        return {};
      }
    },

    async loadBusinessHours() {
      const rows = await unwrap(
        sb.from('business_hours')
          .select('day_of_week, open_time, close_time, is_closed')
      );
      // Normalize into a { 0..6: [openHHMM, closeHHMM] | null } map.
      const map = {};
      for (let i = 0; i < 7; i++) map[i] = null;
      for (const r of rows) {
        if (r.is_closed || !r.open_time || !r.close_time) {
          map[r.day_of_week] = null;
        } else {
          map[r.day_of_week] = [r.open_time.slice(0, 5), r.close_time.slice(0, 5)];
        }
      }
      return map;
    },

    async getAvailability(date, serviceOptionId) {
      const { data, error } = await sb.rpc('get_availability', {
        p_date: date,
        p_service_option_id: serviceOptionId,
      });
      if (error) throw error;
      return data; // [{ busy_start, busy_end, source }]
    },

    async createBooking(params) {
      const { data, error } = await sb.rpc('create_booking', {
        p_service_option_id: params.serviceOptionId,
        p_booking_date:      params.date,
        p_start_time:        params.startTime,
        p_full_name:         params.fullName,
        p_email:             params.email || null,
        p_phone:             params.phone,
        p_payment_method:    params.paymentMethod || 'transfer',
        p_notes:             params.notes || null,
      });
      if (error) {
        // Surface Postgres SQLSTATE so the UI can react: 23505 = conflict.
        const e = new Error(error.message);
        e.code = error.code;
        throw e;
      }
      return data; // booking UUID
    },

    async getBooking(id) {
      const { data, error } = await sb.rpc('get_booking', { p_id: id });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },

    async requestCancellation(bookingId, reason) {
      const { data, error } = await sb.rpc('request_cancellation', {
        p_booking_id: bookingId,
        p_reason: reason || null,
      });
      if (error) throw error;
      return data;
    },

    // Loyalty card for a registered user. Upserts the customer by email and
    // returns { card_code, visits, total_visits } (creates the card on first use).
    async getLoyaltyCard(email, fullName, phone) {
      const { data, error } = await sb.rpc('get_or_create_loyalty_card', {
        p_email: email,
        p_full_name: fullName || null,
        p_phone: phone || null,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },

    // Real "Mis citas": every booking tied to this email, newest first.
    // Each row includes staff_name (who will attend) when the admin set it.
    async getMyBookings(email) {
      const { data, error } = await sb.rpc('get_customer_bookings', {
        p_email: email,
      });
      if (error) throw error;
      return data || [];
    },
  };
})();
