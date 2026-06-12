// LoviBeauty v2 — Auth + Mis citas + Tarjeta de lealtad
//
// "Mis citas" y la tarjeta de lealtad leen de Supabase vía window.lbApi:
//   * getLoyaltyCard(email, name, phone) — crea/lee la tarjeta del cliente
//   * getMyBookings(email)              — citas reales (incluye staff_name)
//   * requestCancellation(id)           — solicitud de cancelación
// La cuenta (registro/login) sigue siendo local; el email es la llave que la
// conecta con el cliente en Supabase.

function AuthScreenV(props) {
  var mode = _uS(props.mode || 'login'); // login | register | reset
  var name = _uS(''), phone = _uS(''), email = _uS(''), pass = _uS('');
  var code = _uS('');
  var err = _uS('');
  var ok = _uS('');
  var busy = _uS(false);

  function switchMode(m) { mode[1](m); err[1](''); ok[1](''); pass[1](''); code[1](''); }

  // onLogin / onRegister hablan con Supabase y devuelven una promesa que
  // resuelve a un mensaje de error (string) o null si todo salió bien.
  function submit(e) {
    e.preventDefault();
    if (busy[0]) return;
    err[1](''); ok[1]('');
    var p;
    if (mode[0] === 'login') {
      p = props.onLogin(email[0].trim().toLowerCase(), pass[0]);
    } else if (mode[0] === 'register') {
      if (!name[0].trim() || phone[0].trim().length < 8) { err[1]('Completa tu nombre y teléfono'); return; }
      if (pass[0].length < 6) { err[1]('La contraseña debe tener al menos 6 caracteres'); return; }
      p = props.onRegister({ name: name[0].trim(), phone: phone[0].trim(), email: email[0].trim().toLowerCase(), password: pass[0] });
    } else {
      // reset: la clienta escribe el código que le dio el estudio + su
      // contraseña NUEVA. Nadie del estudio ve la contraseña.
      if (code[0].trim().length !== 6) { err[1]('El código tiene 6 dígitos. Pídelo en el estudio.'); return; }
      if (pass[0].length < 6) { err[1]('Tu contraseña nueva debe tener al menos 6 caracteres'); return; }
      p = window.lbApi.resetPassword(email[0].trim().toLowerCase(), code[0].trim(), pass[0])
        .then(function(valid) {
          if (!valid) return 'Código incorrecto o vencido. Pide uno nuevo en el estudio.';
          switchMode('login');
          ok[1]('¡Listo! Tu contraseña se actualizó. Inicia sesión con la nueva.');
          return null;
        })
        .catch(function(e2) {
          console.error('[auth] reset', e2);
          return 'No pudimos actualizar tu contraseña. Intenta de nuevo.';
        });
    }
    busy[1](true);
    Promise.resolve(p)
      .then(function(r) { if (r) err[1](r); })
      .finally(function() { busy[1](false); });
  }

  var titles = { login: 'Iniciar sesión', register: 'Crear cuenta', reset: 'Recuperar contraseña' };
  var btnLabels = { login: 'Entrar', register: 'Crear mi cuenta', reset: 'Guardar contraseña nueva' };
  var busyLabels = { login: 'Entrando…', register: 'Creando…', reset: 'Guardando…' };

  return (
    <SheetV title={titles[mode[0]]} onClose={props.onClose}>
      <form className="lv-formcol" onSubmit={submit} data-screen-label={titles[mode[0]]}>
        {mode[0] === 'reset' && (
          <p className="lv-paynote" style={{ textAlign: 'left', margin: 0 }}>
            Pide tu <strong>código de recuperación</strong> en el estudio (te dan 6 dígitos que duran 15 minutos) y crea aquí tu contraseña nueva.
          </p>
        )}
        {mode[0] === 'register' && <FieldV label="Nombre completo" value={name[0]} onChange={name[1]} placeholder="Tu nombre" autoFocus={true} />}
        {mode[0] === 'register' && <FieldV label="WhatsApp" value={phone[0]} onChange={phone[1]} placeholder="55 0000 0000" inputMode="tel" />}
        <FieldV label="Correo electrónico" type="email" value={email[0]} onChange={email[1]} placeholder="tu@correo.com" autoFocus={mode[0] === 'login'} />
        {mode[0] === 'reset' && <FieldV label="Código del estudio" value={code[0]} onChange={code[1]} placeholder="123456" inputMode="numeric" />}
        <FieldV label={mode[0] === 'reset' ? 'Contraseña nueva' : 'Contraseña'} type="password" value={pass[0]} onChange={pass[1]} placeholder="••••••" />
        {err[0] && <p className="lv-err">{err[0]}</p>}
        {ok[0] && <p className="lv-note">{ok[0]}</p>}
        <GlassBtn full type="submit" disabled={busy[0]}>
          {busy[0] ? busyLabels[mode[0]] : btnLabels[mode[0]]}
        </GlassBtn>
        {mode[0] === 'login' && (
          <button type="button" className="lv-linkbtn" onClick={function() { switchMode('reset'); }}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
        <button type="button" className="lv-linkbtn" onClick={function() { switchMode(mode[0] === 'login' ? 'register' : 'login'); }}>
          {mode[0] === 'login' ? '¿No tienes cuenta? Créala aquí' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </SheetV>
  );
}

// ─── Tarjeta de lealtad ───
// 8 visitas por ciclo. Premios: visita 3 = 10% de descuento, visita 6 =
// pedicure + polish $350, visita 8 = facial gratis. Cada visita escaneada por
// el estudio rellena un sello. El código de barras (CODE128) es el card_code.
var LOYALTY_REWARDS_V = {
  3: { tag: '10%',    label: '10% de descuento en tu servicio' },
  6: { tag: '$350',   label: 'Pedicure + polish por $350' },
  8: { tag: 'GRATIS', label: 'Facial gratis' },
};

function LoyaltyCardV(props) {
  var card = props.card;       // { card_code, visits, total_visits } | null
  var loading = props.loading;
  var barRef = _uR(null);

  _uE(function() {
    if (!card || !barRef.current || !window.JsBarcode) return;
    try {
      window.JsBarcode(barRef.current, card.card_code, {
        format: 'CODE128', displayValue: false, margin: 0,
        height: 52, width: 2, background: 'transparent', lineColor: '#2E1A20',
      });
    } catch (e) { console.error('[loyalty] barcode', e); }
  }, [card && card.card_code]);

  var visits = card ? card.visits : 0;

  return (
    <div className="lv-loyalty">
      <div className="lv-loyalty-top">
        <div>
          <strong>LoviBeauty Club</strong>
          <span>¡Qué bueno volver a verte! Cada visita suma un sello</span>
        </div>
        {card && <span className="lv-loyalty-count">{visits}<em>/8</em></span>}
      </div>

      <div className="lv-loy-grid">
        {[1,2,3,4,5,6,7,8].map(function(n) {
          var reward = LOYALTY_REWARDS_V[n];
          var on = n <= visits;
          return (
            <span key={n} className={'lv-loy-stamp' + (reward ? ' reward' : '') + (on ? ' on' : '')}>
              {on && <i className="lv-loy-check" aria-hidden="true">♥</i>}
              <span className="lv-loy-n">{n}</span>
              {reward && <span className="lv-loy-tag">{reward.tag}</span>}
            </span>
          );
        })}
      </div>

      {loading && <p className="lv-loyalty-note">Cargando tu tarjeta…</p>}
      {!loading && !card && <p className="lv-loyalty-note">No pudimos cargar tu tarjeta. Desliza hacia abajo para reintentar más tarde 💕</p>}
      {card && (
        <div className="lv-loy-barwrap">
          <svg ref={barRef} className="lv-loy-barcode" role="img" aria-label={'Código de tarjeta ' + card.card_code}></svg>
          <span className="lv-loy-code">{card.card_code}</span>
          <span className="lv-loy-hint">Muestra este código en el estudio para sumar tu visita</span>
        </div>
      )}
    </div>
  );
}

// Leyenda de premios — va FUERA de la tarjeta, justo debajo, para que la
// tarjeta conserve su proporción rectangular.
function LoyaltyLegendV(props) {
  var visits = props.card ? props.card.visits : 0;
  return (
    <div className="lv-loy-legend">
      {[3,6,8].map(function(n) {
        var unlocked = visits >= n;
        return (
          <div key={n} className={'lv-loy-leg' + (unlocked ? ' on' : '')}>
            <span className="lv-loy-leg-n">Visita {n}</span>
            <span>{LOYALTY_REWARDS_V[n].label}</span>
            {unlocked && <i>✓</i>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Citas reales (filas de get_customer_bookings) ───
var SB_STATUS_META_V = {
  pending_payment: { label: 'Anticipo pendiente', color: '#B8860B', bg: '#FBF3DC' },
  confirmed:       { label: 'Confirmada',         color: '#2E7D52', bg: '#E3F2E9' },
  completed:       { label: 'Completada',         color: '#2563A8', bg: '#E2ECF8' },
  cancelled:       { label: 'Cancelada',          color: '#8A8A8A', bg: '#EFEDED' },
  expired:         { label: 'Expirada',           color: '#8A8A8A', bg: '#EFEDED' },
};

function SbApptCardV(props) {
  var b = props.booking;
  var m = SB_STATUS_META_V[b.status] || SB_STATUS_META_V.expired;
  var time = (b.start_time || '').slice(0, 5);
  return (
    <div className={'lv-apptcard' + (props.compact ? ' compact' : '')}>
      <div className="lv-apptcard-top">
        <div>
          <strong>{b.service_option_name}</strong>
          <span className="lv-apptcard-when">{fmtDateShortV(b.booking_date) + ' · ' + fmtTimeV(time)}</span>
        </div>
        <span className="lv-badge" style={{ color: m.color, background: m.bg }}>{m.label}</span>
      </div>
      <div className="lv-apptcard-meta">
        <span>{b.staff_name ? 'Te atiende ' + b.staff_name + ' 💕' : b.service_name}</span>
        <span>{fmtMoneyV(Number(b.price))}</span>
      </div>
      {props.children}
    </div>
  );
}

function MyAppointmentsV(props) {
  var user = props.user, toast = props.toast;
  var cfg = props.businessConfig || {};
  var whatsNumber = (cfg.whatsapp_number && cfg.whatsapp_number.replace(/\D/g, '')) || WHATS_NUM_V2;

  var card = _uS(null);
  var cardLoading = _uS(true);
  var bookings = _uS(null); // null = cargando
  var confirmId = _uS(null);
  var cancelling = _uS(false);
  var reloadKey = _uS(0);

  _uE(function() {
    var cancelled = false;
    cardLoading[1](true);
    window.lbApi.getLoyaltyCard(user.email, user.name, user.phone)
      .then(function(c) { if (!cancelled) card[1](c); })
      .catch(function(e) { console.error('[account] loyalty', e); })
      .finally(function() { if (!cancelled) cardLoading[1](false); });
    window.lbApi.getMyBookings(user.email)
      .then(function(rows) { if (!cancelled) bookings[1](rows); })
      .catch(function(e) {
        console.error('[account] bookings', e);
        if (!cancelled) { bookings[1]([]); toast && toast('No pudimos cargar tus citas'); }
      });
    return function() { cancelled = true; };
  }, [user.email, reloadKey[0]]);

  function requestCancel(id) {
    if (cancelling[0]) return;
    cancelling[1](true);
    window.lbApi.requestCancellation(id)
      .then(function() {
        toast && toast('Solicitud enviada al estudio');
        confirmId[1](null);
        reloadKey[1](reloadKey[0] + 1);
      })
      .catch(function(e) {
        console.error('[account] cancel', e);
        toast && toast('No pudimos enviar la solicitud');
      })
      .finally(function() { cancelling[1](false); });
  }

  var t = todayStrV();
  var rows = bookings[0] || [];
  var upcoming = rows.filter(function(b) {
    return b.booking_date >= t && (b.status === 'confirmed' || b.status === 'pending_payment');
  }).sort(function(a, b) { return (a.booking_date + a.start_time) < (b.booking_date + b.start_time) ? -1 : 1; });
  var past = rows.filter(function(b) { return upcoming.indexOf(b) === -1; });

  return (
    <div className="lv-page" data-screen-label="Mi cuenta">
      <div className="lv-page-head">
        <div>
          <span className="lv-page-eyebrow">Hola, {user.name.split(' ')[0]} 💕</span>
          <h2>Mi cuenta</h2>
        </div>
        <button className="lv-linkbtn" onClick={props.onLogout}>Cerrar sesión</button>
      </div>

      <h3 className="lv-sec">Mis citas</h3>
      {bookings[0] === null && <div className="lv-emptycard"><p>Cargando tus citas…</p></div>}
      {bookings[0] !== null && upcoming.length === 0 && (
        <div className="lv-emptycard">
          <p>No tienes citas próximas.</p>
          <GlassBtn onClick={props.onBook}>Agendar una cita</GlassBtn>
        </div>
      )}
      <div className="lv-list">
        {upcoming.map(function(b) {
          var time = (b.start_time || '').slice(0, 5);
          return (
            <SbApptCardV key={b.id} booking={b}>
              {b.status === 'pending_payment' && (
                <GlassBtn kind="whats" small
                  href={'https://wa.me/' + whatsNumber + '?text=' + encodeURIComponent(buildWhatsMessageV(b.service_option_name, b.booking_date, time, user.name.split(' ')[0]))}
                  target="_blank">Enviar comprobante</GlassBtn>
              )}
              {b.cancellation_pending && <p className="lv-note">Tu solicitud de cancelación está en revisión.</p>}
              {!b.cancellation_pending && (
                confirmId[0] === b.id ? (
                  <div className="lv-cancelask">
                    <span>¿Solicitar cancelación? El estudio la revisará.</span>
                    <div className="lv-row2">
                      <GlassBtn kind="danger" small disabled={cancelling[0]} onClick={function() { requestCancel(b.id); }}>
                        {cancelling[0] ? 'Enviando…' : 'Sí, solicitar'}
                      </GlassBtn>
                      <GlassBtn kind="glass" small onClick={function() { confirmId[1](null); }}>No</GlassBtn>
                    </div>
                  </div>
                ) : (
                  <div className="lv-row2">
                    <GlassBtn kind="glass" small
                      href={'https://calendar.google.com/calendar/render?' + new URLSearchParams({
                        action: 'TEMPLATE',
                        text: 'LoviBeauty — ' + b.service_option_name,
                        dates: b.booking_date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00/' +
                               b.booking_date.replace(/-/g, '') + 'T' + (b.end_time || time).slice(0, 5).replace(':', '') + '00',
                        details: 'Cita en LoviBeauty Studio.', location: 'LoviBeauty Studio',
                      }).toString()}
                      target="_blank">+ Calendario</GlassBtn>
                    <GlassBtn kind="ghostdanger" small onClick={function() { confirmId[1](b.id); }}>Cancelar</GlassBtn>
                  </div>
                )
              )}
            </SbApptCardV>
          );
        })}
      </div>

      {past.length > 0 && <h3 className="lv-sec">Historial</h3>}
      <div className="lv-list">
        {past.map(function(b) { return <SbApptCardV key={b.id} booking={b} compact />; })}
      </div>

      <h3 className="lv-sec">Tarjeta de lealtad</h3>
      <LoyaltyCardV card={card[0]} loading={cardLoading[0]} />
      <LoyaltyLegendV card={card[0]} />
    </div>
  );
}

Object.assign(window, { AuthScreenV, MyAppointmentsV, LoyaltyCardV, LoyaltyLegendV });
