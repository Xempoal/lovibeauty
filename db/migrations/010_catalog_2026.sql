-- LoviBeauty — migration 010: catálogo 2026 (precios, descripciones y tiempos)
--
-- Apply: pega este archivo en Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotente: seguro de re-ejecutar.
--
-- Fuente de datos (entregada por el estudio, jun-2026):
--   * Lista de precios 2026.pdf       → precios
--   * descripcion serv.docx           → descripciones
--   * tiempos de servicios.docx       → duración estimada de cada servicio
--
-- Estrategia:
--   1. Se DESACTIVA todo el catálogo anterior (services + service_options) en vez
--      de borrarlo, para no romper el historial de citas (bookings referencia
--      service_option_id; get_booking funciona aunque la opción esté inactiva).
--   2. Se vuelve a activar (upsert) solo el catálogo 2026.
--   3. Categorías retiradas de la oferta 2026 (Makeup, Servicios especiales)
--      quedan inactivas → desaparecen del sitio sin perder datos. Si el estudio
--      las quiere de vuelta, basta reactivarlas desde el panel /admin/.
--
-- Precios "desde": el sitio muestra el precio base; las variantes (largo de uña,
-- largo de cabello, etc.) y los extras se detallan en la descripción y se
-- cotizan en la cita. El anticipo sigue siendo fijo ($100).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Desactivar el catálogo anterior (no se borra: conserva historial de citas)
-- ─────────────────────────────────────────────────────────────────────────────
update public.service_options set active = false;
update public.services        set active = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Categorías (services) 2026
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.services (slug, name, description, display_order, active) values
  ('unas',      'Uñas',                'Esmaltado, acrílico, acrimano y acripie',     1, true),
  ('mani-pedi', 'Manicura y pedicura', 'Manicura, pedicura spa y paquetes',           2, true),
  ('pestanas',  'Pestañas y cejas',    'Extensiones, lifting y laminado de cejas',    3, true),
  ('keratina',  'Alaciados',           'Keratinas: cioccolato, nanoplastia y más',    4, true),
  ('retiros',   'Retiros y retoques',  'Retiros y retoques de tus uñas',              5, true)
on conflict (slug) do update
  set name          = excluded.name,
      description   = excluded.description,
      display_order = excluded.display_order,
      active        = excluded.active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Servicios (service_options) 2026
-- ─────────────────────────────────────────────────────────────────────────────
with svc as (select slug, id from public.services)
insert into public.service_options
  (service_id, slug, name, description, price, duration_minutes, display_order, active)
select s.id, t.slug, t.name, t.description, t.price, t.dur, t.ord, true
from (values
  -- ── Uñas ──────────────────────────────────────────────────────────────────
  ('unas', 'polish',    'Esmaltado (polish)',        'Esmaltado semipermanente en manos o pies, 1 tono. Dura de 2 a 3 semanas. Más de 400 tonos disponibles.',                                    150.00,  40, 1),
  ('unas', 'rubber',    'Rubber (niveladora)',       'Base niveladora que da volumen, fuerza y resistencia a uñas frágiles o quebradizas (hasta largo #2). Dura de 2 a 3 semanas.',               250.00,  60, 2),
  ('unas', 'acrilico',  'Uñas acrílicas',            'Extensión de uña con acrílico, 1 tono, en el largo y forma que elijas. Precio por largo: #1 $330 · #2 $350 · #3 $370 · #4 $390 · #5 $410.', 330.00, 120, 3),
  ('unas', 'acrimano',  'Acrimano (baño acrílico)',  'Baño de acrílico sobre tu uña natural para darle fuerza mientras crece, 1 tono. Mini $280 · Largo (1–2) $300.',                              280.00,  90, 4),
  ('unas', 'acripie',   'Acripie',                   'Acrílico en los pies, 1 tono. 2 dedos $200 · Completo $300.',                                                                               200.00,  90, 5),

  -- ── Manicura y pedicura ─────────────────────────────────────────────────────
  ('mani-pedi', 'manicura-clasica', 'Manicura clásica spa', 'Corte de cutícula y uñas, exfoliación e hidratación con masaje.',                          150.00,  40, 1),
  ('mani-pedi', 'manicura-rusa',    'Manicura rusa',        'Manicura en seco con drill: acabado limpio y preciso, mayor durabilidad del esmaltado.',  200.00,  60, 2),
  ('mani-pedi', 'manicura-expres',  'Manicura exprés',      'En seco: corte de cutícula y uñas + hidratación.',                                          50.00,  20, 3),
  ('mani-pedi', 'pedicura-spa',     'Pedicura spa',         'Corte de cutícula y uñas, limado de callosidades, sales, exfoliación, masaje e hidratación.', 300.00,  60, 4),
  ('mani-pedi', 'pedicura-expres',  'Pedicura exprés',      'En seco: corte de cutícula y uñas.',                                                         50.00,  20, 5),
  ('mani-pedi', 'paq-pedi-polish',  'Pedi + polish',        'Pedicura spa + esmaltado semipermanente, 1 tono.',                                          400.00,  90, 6),
  ('mani-pedi', 'paq-pedi-acrilico','Pedi + acrílico',      'Pedicura spa + acrílico en los pies.',                                                      500.00, 120, 7),

  -- ── Pestañas y cejas ────────────────────────────────────────────────────────
  ('pestanas', 'clasicas',       'Pestañas clásicas',      'Una extensión por cada pestaña natural, look definido y natural.',           300.00,  90, 1),
  ('pestanas', 'clasicas-rimel', 'Clásicas efecto rímel',  'Espigas más delgadas de 2 a 4 pelitos: efecto de máscara de pestañas.',      350.00,  90, 2),
  ('pestanas', 'hibridas',       'Pestañas híbridas',      'Combinación de técnica clásica + volumen.',                                  400.00, 120, 3),
  ('pestanas', 'volumen-natural','Volumen natural',        'Abanicos de 2 a 4 extensiones por cada pestaña natural.',                    450.00, 120, 4),
  ('pestanas', 'volumen-tupido', 'Volumen tupido',         'Abanicos de 3 a 6 extensiones por cada pestaña natural.',                    500.00, 150, 5),
  ('pestanas', 'wispy',          'Efecto wispy',           'Combinación de técnicas con volumen y textura para un aspecto natural.',     650.00, 150, 6),
  ('pestanas', 'lifting',        'Lifting de pestañas',    'Levantamiento de la pestaña natural + botox para fortalecer.',               300.00,  60, 7),
  ('pestanas', 'laminado-cejas', 'Laminado de cejas',      'Diseño, depilación, planchado con keratina y pigmentación.',                 300.00,  45, 8),

  -- ── Alaciados / Keratinas ───────────────────────────────────────────────────
  ('keratina', 'cioccolato',  'Keratina Cioccolato', 'Para cabello procesado, con volumen o quebrado: hidrata, da brillo y quita el frizz. Alacia 60–70%. Dura 4–5 meses. Por largo: corto $700 · medio $800 · largo $850 · extra largo $900.', 700.00, 180, 1),
  ('keratina', 'nanoplastia', 'Nanoplastia',         'Regenera la hebra capilar con acabado espejo y brillo. Alacia hasta 80%. Dura 4–5 meses. Por largo: $800 · $850 · $900 · $950.',                                                  800.00, 180, 2),
  ('keratina', 'colageno',    'Keratina Colágeno',   'Orgánica: restaura, da brillo y suavidad, apta para todo cuero cabelludo. Alacia 90%. Dura 4–5 meses. Por largo: $850 · $950 · $1,100 · $1,200.',                              850.00, 180, 3),
  ('keratina', 'lamishine',   'Lamishine',           'Repara, hidrata y alacia el cabello más rebelde, sin tiempo de pose. Alacia 99%. Dura 4–5 meses. Por largo: $900 · $1,000 · $1,200 · $1,300.',                            900.00, 180, 4),

  -- ── Retiros y retoques ──────────────────────────────────────────────────────
  ('retiros', 'retiro-polish',   'Retiro de polish o rubber', 'Retiro de esmaltado semipermanente o rubber.',                  50.00,  15, 1),
  ('retiros', 'retiro-acrilico', 'Retiro de acrílico',        'Retiro cuidadoso de acrílico sin dañar tu uña natural.',       100.00,  40, 2),
  ('retiros', 'retoque-acrilico','Retoque de acrílico',       'Retoque de acrílico a los 15–21 días, 1 tono.',                280.00,  90, 3),
  ('retiros', 'retoque-acrimano','Retoque de acrimano',       'Retoque de acrimano a los 15–21 días, 1 tono.',                250.00,  90, 4)
) as t(svc_slug, slug, name, description, price, dur, ord)
join svc s on s.slug = t.svc_slug
on conflict (service_id, slug) do update
  set name             = excluded.name,
      description      = excluded.description,
      price            = excluded.price,
      duration_minutes = excluded.duration_minutes,
      display_order    = excluded.display_order,
      active           = excluded.active;
