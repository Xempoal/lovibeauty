// LoviBeauty v2 — booking flow against the real Supabase backend.
//
// Props:
//   serviceOption  — full row from public.service_options (id, name, description,
//                    price, duration_minutes, service_id)
//   serviceName    — display name of the parent service (e.g. "Uñas")
//   businessHours  — { 0..6: ['HH:MM','HH:MM'] | null } from lbApi.loadBusinessHours()
//   user           — optional localStorage user (for prefill only)
//   toast(text)    — toast helper from the root
//   onClose()      — close back to home / account
//   onGoLogin()    — open the login sheet

function BookingV2(props) {
  var serviceOption = props.serviceOption;
  var serviceName   = props.serviceName || '';
  var businessHours = props.businessHours;
  var user          = props.user;
  var toast         = props.toast;

  // Business config from Supabase (bank details, WhatsApp, hold window). Each
  // value falls back to the legacy constant when the row is empty/missing so the
  // flow still works before the studio fills it in.
  var cfg          = props.businessConfig || {};
  var bankName     = cfg.bank_name   || BANK_V2.banco;
  var bankHolder   = cfg.bank_holder || BANK_V2.titular;
  var bankClabe    = cfg.bank_clabe  || BANK_V2.clabe;
  var whatsNumber  = (cfg.whatsapp_number && cfg.whatsapp_number.replace(/\D/g, '')) || WHATS_NUM_V2;
  var holdMinutes  = parseInt(cfg.hold_minutes, 10) > 0 ? parseInt(cfg.hold_minutes, 10) : 20;

  // Pasarela de pago (off por defecto hasta que el estudio configure llaves).
  var payCfg = props.paymentConfig || { enabled: false };
  var PROVIDER_LABEL_V = { stripe: 'Stripe', mercadopago: 'Mercado Pago', paypal: 'PayPal' };
  var payProviderName = PROVIDER_LABEL_V[payCfg.provider] || 'tarjeta';

  var step      = _uS(0); // 0=date+slot, 1=chosen, 2=data, 3=payment
  var date      = _uS(null);
  var slot      = _uS(null); // { time }
  var slots     = _uS([]);
  var slotsLoading = _uS(false);

  var name      = _uS(user ? user.name  : '');
  var email     = _uS(user ? user.email : '');
  var phone     = _uS(user ? user.phone : '');
  var payMethod = _uS(null);
  var submitting = _uS(false);
  var submitError = _uS(null);
  var confirmed = _uS(null); // { id, expires_at_ms, ... }

  // ─── Dates available: next 14 open days from business_hours ───
  var availableDates = _uM(function() {
    if (!businessHours) return [];
    return nextOpenDatesV(businessHours, 14);
  }, [businessHours]);

  // Default-pick the first open day on mount.
  _uE(function() {
    if (!date[0] && availableDates.length) date[1](availableDates[0]);
  }, [availableDates]);

  // ─── Fetch availability whenever the date changes ───
  _uE(function() {
    if (!date[0] || !serviceOption) return;
    var cancelled = false;
    slotsLoading[1](true);
    slot[1](null);
    window.lbApi.getAvailability(date[0], serviceOption.id)
      .then(function(busy) {
        if (cancelled) return;
        var free = computeFreeSlotsV(busy, businessHours, serviceOption.duration_minutes, date[0]);
        slots[1](free);
      })
      .catch(function(err) {
        if (cancelled) return;
        console.error('[booking] getAvailability', err);
        slots[1]([]);
        toast && toast('No pudimos cargar la disponibilidad');
      })
      .finally(function() { if (!cancelled) slotsLoading[1](false); });
    return function() { cancelled = true; };
  }, [date[0], serviceOption && serviceOption.id]);

  function selectDate(d) { date[1](d); }
  function selectSlot(s) { slot[1](s); step[1](1); }
  function goData()      { step[1](2); }
  function goPayment() {
    if (!isContactValid()) return;
    step[1](3);
  }
  function back() {
    if (confirmed[0]) return;
    if (step[0] === 0) { props.onClose(); return; }
    if (step[0] === 1) { slot[1](null); step[1](0); return; }
    step[1](step[0] - 1);
  }

  function isContactValid() {
    return name[0].trim().length >= 2 &&
           phone[0].trim().length >= 8;
  }

  async function submitTransfer() {
    if (submitting[0]) return;
    submitError[1](null);
    submitting[1](true);
    try {
      var bookingId = await window.lbApi.createBooking({
        serviceOptionId: serviceOption.id,
        date:            date[0],
        startTime:       slot[0].time,
        fullName:        name[0].trim(),
        email:           email[0].trim().toLowerCase() || null,
        phone:           phone[0].trim(),
        paymentMethod:   'transfer',
      });
      var booking = await window.lbApi.getBooking(bookingId);
      var expiresAtMs = booking.expires_at
        ? new Date(booking.expires_at).getTime()
        : Date.now() + holdMinutes * 60 * 1000;
      confirmed[1]({
        id:            booking.id,
        booking:       booking,
        expiresAtMs:   expiresAtMs,
      });
    } catch (err) {
      console.error('[booking] createBooking', err);
      if (err.code === '23505') {
        submitError[1]('Otra clienta acaba de tomar ese horario. Elige otro horario.');
        toast && toast('Horario ya no disponible');
      } else if (err.code === '22023') {
        submitError[1]('Algunos datos no son válidos. Revisa tu nombre y teléfono.');
      } else {
        submitError[1]('No pudimos completar la reserva. Intenta de nuevo.');
      }
    } finally {
      submitting[1](false);
    }
  }

  // Pago con tarjeta: aparta la cita (pending_payment) y redirige a la pasarela.
  // El webhook confirma la cita cuando el proveedor avisa que el pago se acreditó.
  async function submitCard() {
    if (submitting[0]) return;
    submitError[1](null);
    submitting[1](true);
    try {
      var bookingId = await window.lbApi.createBooking({
        serviceOptionId: serviceOption.id,
        date:            date[0],
        startTime:       slot[0].time,
        fullName:        name[0].trim(),
        email:           email[0].trim().toLowerCase() || null,
        phone:           phone[0].trim(),
        paymentMethod:   'card',
      });
      var out = await window.lbApi.createCardCheckout(bookingId);
      if (out && out.url) { window.location.href = out.url; return; }
      submitError[1]('No pudimos iniciar el pago. Intenta de nuevo.');
    } catch (err) {
      console.error('[booking] card checkout', err);
      if (err.code === '23505') {
        submitError[1]('Otra clienta acaba de tomar ese horario. Elige otro horario.');
        toast && toast('Horario ya no disponible');
      } else if (err.code === '22023') {
        submitError[1]('Algunos datos no son válidos. Revisa tu nombre y teléfono.');
      } else if (err.status === 503) {
        submitError[1]('El pago con tarjeta no está disponible ahora. Usa transferencia.');
      } else {
        submitError[1]('No pudimos iniciar el pago. Intenta de nuevo.');
      }
    } finally {
      submitting[1](false);
    }
  }

  function pickAnotherSlot() {
    confirmed[1](null);
    submitError[1](null);
    payMethod[1](null);
    step[1](0);
    slot[1](null);
  }

  // ─── Confirmation screen ───
  // Compacta a propósito: debe caber completa en la pantalla de un celular
  // sin hacer scroll (icono chico, resumen en una tarjeta de una línea y
  // datos bancarios condensados).
  if (confirmed[0]) {
    var booking = confirmed[0].booking;
    var customerFirstName = (name[0].trim().split(' ')[0] || '').trim();
    var whatsHref = 'https://wa.me/' + whatsNumber + '?text=' +
      encodeURIComponent(buildWhatsMessageV(booking.service_option_name, booking.booking_date, booking.start_time, customerFirstName));
    return (
      <div className="lv-booking" data-screen-label="Confirmación">
        <PageTransition k="confirm">
          <div className="lv-confirm compact">
            <div className="lv-confirm-icon wait">⏳</div>
            <h2>¡Apartamos tu lugar!</h2>
            <p className="lv-confirm-sub">
              Transfiere el anticipo y envía tu comprobante.<br/>
              Te quedan <strong><CountdownV
                targetMs={confirmed[0].expiresAtMs}
                onExpire={function() { /* keep showing 0:00 */ }}
              /></strong> minutos.
            </p>

            <div className="lv-mini-resumen">
              <div>
                <strong>{fmtDateV(booking.booking_date)} · {fmtTimeV(booking.start_time)}</strong>
                <span>{booking.service_option_name}</span>
              </div>
              <span className="lv-mini-price">{fmtMoneyV(Number(booking.price))}</span>
            </div>

            <div className="lv-bankbox compact">
              <div className="lv-bankrow"><em>Banco</em><span>{bankName}</span></div>
              <div className="lv-bankrow"><em>Titular</em><span>{bankHolder}</span></div>
              <div className="lv-bankrow"><em>CLABE</em><span>{bankClabe}</span></div>
              <div className="lv-bankrow"><em>Anticipo</em><span>{fmtMoneyV(DEPOSIT_V2)}</span></div>
            </div>

            <div className="lv-confirm-actions">
              <GlassBtn kind="whats" full href={whatsHref} target="_blank">
                Enviar comprobante por WhatsApp
              </GlassBtn>
              <div className="lv-row2">
                <AddToCalendarBtnV booking={booking} kind="glass">📅 A mi calendario</AddToCalendarBtnV>
                <GlassBtn kind="soft" onClick={props.onClose}>Listo</GlassBtn>
              </div>
            </div>
          </div>
        </PageTransition>
      </div>
    );
  }

  if (!serviceOption) return <div className="lv-empty">Selecciona un servicio</div>;

  var stepLabels = ['Elige fecha', 'Elige horario', 'Tus datos', 'Anticipo'];
  var durLabel = serviceOption.duration_minutes >= 60
    ? Math.floor(serviceOption.duration_minutes/60) + 'h'
      + (serviceOption.duration_minutes % 60 ? ' ' + (serviceOption.duration_minutes % 60) + 'min' : '')
    : serviceOption.duration_minutes + ' min';

  return (
    <div className="lv-booking" data-screen-label={'Reserva — ' + stepLabels[step[0]]}>
      {/* top bar */}
      <div className="lv-booking-topbar">
        <button className="lv-back" onClick={back} aria-label="Atrás">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="lv-booking-svc">
          <strong>{serviceOption.name}</strong>
          <span>{fmtMoneyV(Number(serviceOption.price))} · {durLabel}</span>
        </div>
        <div className="lv-stepper">
          {[0,1,2,3].map(function(i) {
            return <span key={i} className={'lv-stepDot' + (i <= step[0] ? ' on' : '')}></span>;
          })}
        </div>
      </div>

      <PageTransition k={'step-' + step[0]}>
        {/* step 0: date + slot */}
        {step[0] === 0 && (
          <div className="lv-step">
            <h2 className="lv-step-title">¿Qué día te queda?</h2>
            <DateStripV value={date[0]} onChange={selectDate} dates={availableDates} />
            <SlotGridV slots={slots[0]} value={slot[0]} onChange={selectSlot} loading={slotsLoading[0]} />
          </div>
        )}

        {/* step 1: confirm chosen slot — review card premium */}
        {step[0] === 1 && slot[0] && (
          <div className="lv-step lv-step-center">
            <div className="lv-review">
              <span className="lv-review-eyebrow">Confirma tu cita</span>
              <h2 className="lv-review-date">{capitalizeFirstV(fmtDateV(date[0]))}</h2>
              <div className="lv-review-rows">
                <div className="lv-review-row">
                  <span className="lv-review-ic">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="lv-review-rc"><em>Hora</em><strong>{fmtTimeV(slot[0].time)}</strong></div>
                </div>
                <div className="lv-review-row">
                  <span className="lv-review-ic">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.7L18.5 9l-3.7 3 1.2 5-4-2.7L8 17l1.2-5L5.5 9l4.7-1.3L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="lv-review-rc"><em>Servicio</em><strong>{serviceOption.name}</strong></div>
                </div>
                <div className="lv-review-row">
                  <span className="lv-review-ic">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="lv-review-rc"><em>Duración</em><strong>{durLabel}</strong></div>
                </div>
              </div>
              <div className="lv-review-total">
                <span>Total del servicio</span>
                <strong>{fmtMoneyV(Number(serviceOption.price))}</strong>
              </div>
            </div>
            <GlassBtn full onClick={goData}>Continuar</GlassBtn>
          </div>
        )}

        {/* step 2: contact data */}
        {step[0] === 2 && (
          <div className="lv-step">
            <h2 className="lv-step-title">¿Cómo te contactamos?</h2>
            {!user && (
              <button className="lv-loginhint" onClick={props.onGoLogin}>
                ¿Ya tienes cuenta? <strong>Inicia sesión</strong>
              </button>
            )}
            <div className="lv-formcol">
              <FieldV label="Nombre completo" value={name[0]} onChange={name[1]} placeholder="Tu nombre" autoFocus={!name[0]} />
              <FieldV label="WhatsApp" value={phone[0]} onChange={phone[1]} placeholder="55 0000 0000" inputMode="tel" />
            </div>
            <GlassBtn full disabled={!isContactValid()} onClick={goPayment}>
              Continuar al anticipo
            </GlassBtn>
          </div>
        )}

        {/* step 3: payment */}
        {step[0] === 3 && (
          <div className="lv-step">
            <h2 className="lv-step-title">Anticipo de {fmtMoneyV(DEPOSIT_V2)}</h2>
            <p className="lv-paynote">Se descuenta del total el día de tu cita.</p>
            <div className="lv-paytabs">
              <button className={'lv-paytab' + (payMethod[0] === 'transfer' ? ' sel' : '')} onClick={function() { payMethod[1]('transfer'); submitError[1](null); }}>
                <span className="lv-paytab-icon">🏦</span>
                <strong>Transferencia</strong>
                <span>Envías comprobante</span>
              </button>
              <button className={'lv-paytab' + (payMethod[0] === 'card' ? ' sel' : '')} onClick={function() { payMethod[1]('card'); submitError[1](null); }}>
                <span className="lv-paytab-icon">💳</span>
                <strong>Tarjeta</strong>
                <span>{payCfg.enabled ? 'Pago seguro' : 'Próximamente'}</span>
              </button>
            </div>

            {payMethod[0] === 'transfer' && (
              <div className="lv-formcol lv-fadein">
                <div className="lv-bankbox">
                  <div className="lv-bankrow"><em>Banco</em><span>{bankName}</span></div>
                  <div className="lv-bankrow"><em>Titular</em><span>{bankHolder}</span></div>
                  <div className="lv-bankrow"><em>CLABE</em><span>{bankClabe}</span></div>
                  <div className="lv-bankrow"><em>Monto</em><span>{fmtMoneyV(DEPOSIT_V2)}</span></div>
                </div>
                <p className="lv-paynote small">
                  Tu lugar queda apartado por {holdMinutes} minutos al confirmar. Envía tu comprobante por WhatsApp después.
                </p>
                {submitError[0] && <p className="lv-err">{submitError[0]}</p>}
                {submitError[0] && submitError[0].indexOf('horario') !== -1 && (
                  <GlassBtn kind="glass" full onClick={pickAnotherSlot}>Elegir otro horario</GlassBtn>
                )}
                <GlassBtn full disabled={submitting[0]} onClick={submitTransfer}>
                  {submitting[0] ? 'Apartando…' : 'Apartar mi cita'}
                </GlassBtn>
              </div>
            )}

            {payMethod[0] === 'card' && payCfg.enabled && (
              <div className="lv-formcol lv-fadein">
                <div className="lv-bankbox" style={{ textAlign: 'center', alignItems: 'center' }}>
                  <p className="lv-paynote" style={{ margin: 0 }}>
                    Pagas el anticipo de <strong>{fmtMoneyV(DEPOSIT_V2)}</strong> de forma segura con tarjeta.
                  </p>
                  <p className="lv-paynote small" style={{ margin: 0 }}>
                    Te llevamos a {payProviderName} para completar el pago. Tu cita se confirma al instante.
                  </p>
                </div>
                {submitError[0] && <p className="lv-err">{submitError[0]}</p>}
                {submitError[0] && submitError[0].indexOf('horario') !== -1 && (
                  <GlassBtn kind="glass" full onClick={pickAnotherSlot}>Elegir otro horario</GlassBtn>
                )}
                <GlassBtn full disabled={submitting[0]} onClick={submitCard}>
                  {submitting[0] ? 'Conectando…' : 'Pagar con tarjeta'}
                </GlassBtn>
              </div>
            )}

            {payMethod[0] === 'card' && !payCfg.enabled && (
              <div className="lv-formcol lv-fadein">
                <div className="lv-bankbox" style={{ textAlign: 'center', alignItems: 'center' }}>
                  <p className="lv-paynote" style={{ margin: 0 }}>
                    El pago con <strong>tarjeta</strong> estará disponible muy pronto.
                  </p>
                  <p className="lv-paynote small" style={{ margin: 0 }}>
                    Mientras tanto, aparta tu cita con transferencia.
                  </p>
                </div>
                <GlassBtn kind="glass" full onClick={function() { payMethod[1]('transfer'); }}>
                  Usar transferencia
                </GlassBtn>
              </div>
            )}
          </div>
        )}
      </PageTransition>
    </div>
  );
}

Object.assign(window, { BookingV2 });
