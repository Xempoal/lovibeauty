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
           /@.+\./.test(email[0].trim()) &&
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
        email:           email[0].trim().toLowerCase(),
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
        submitError[1]('Algunos datos no son válidos. Revisa nombre, correo y teléfono.');
      } else {
        submitError[1]('No pudimos completar la reserva. Intenta de nuevo.');
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
  if (confirmed[0]) {
    var booking = confirmed[0].booking;
    var customerFirstName = (name[0].trim().split(' ')[0] || '').trim();
    var whatsHref = 'https://wa.me/' + whatsNumber + '?text=' +
      encodeURIComponent(buildWhatsMessageV(booking.service_option_name, booking.booking_date, booking.start_time, customerFirstName));
    return (
      <div className="lv-booking" data-screen-label="Confirmación">
        <PageTransition k="confirm">
          <div className="lv-confirm">
            <div className="lv-confirm-icon wait">⏳</div>
            <h2>¡Apartamos tu lugar!</h2>
            <p className="lv-confirm-sub">
              Tu cita quedó apartada por <strong>{holdMinutes} minutos</strong>.<br/>
              Tienes <strong><CountdownV
                targetMs={confirmed[0].expiresAtMs}
                onExpire={function() { /* keep showing 0:00 */ }}
              /></strong> para enviar tu comprobante.
            </p>

            <div className="lv-chosen-card">
              <div className="lv-chosen-top">
                <span className="lv-chosen-emoji">📅</span>
                <h2>{fmtDateV(booking.booking_date)}</h2>
                <p className="lv-chosen-time">{fmtTimeV(booking.start_time)}</p>
              </div>
              <div className="lv-chosen-svc">
                <span>{booking.service_option_name}</span>
                <strong>{fmtMoneyV(Number(booking.price))}</strong>
              </div>
            </div>

            <div className="lv-bankbox">
              <div className="lv-bankrow"><em>Banco</em><span>{bankName}</span></div>
              <div className="lv-bankrow"><em>Titular</em><span>{bankHolder}</span></div>
              <div className="lv-bankrow"><em>CLABE</em><span>{bankClabe}</span></div>
              <div className="lv-bankrow"><em>Anticipo</em><span>{fmtMoneyV(DEPOSIT_V2)}</span></div>
            </div>

            <p className="lv-paynote small">
              Después de transferir, envíanos tu comprobante por WhatsApp para confirmar tu cita.
            </p>

            <div className="lv-confirm-actions">
              <GlassBtn kind="whats" full href={whatsHref} target="_blank">
                Enviar comprobante por WhatsApp
              </GlassBtn>
              <GlassBtn kind="soft" full onClick={props.onClose}>Listo</GlassBtn>
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

        {/* step 1: confirm chosen slot */}
        {step[0] === 1 && slot[0] && (
          <div className="lv-step lv-step-center">
            <div className="lv-chosen-card">
              <div className="lv-chosen-top">
                <span className="lv-chosen-emoji">📅</span>
                <h2>{fmtDateV(date[0])}</h2>
                <p className="lv-chosen-time">{fmtTimeV(slot[0].time)}</p>
              </div>
              <div className="lv-chosen-svc">
                <span>{serviceOption.name}</span>
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
              <FieldV label="Correo electrónico" value={email[0]} onChange={email[1]} placeholder="tu@correo.com" type="email" inputMode="email" />
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
                <span>Próximamente</span>
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

            {payMethod[0] === 'card' && (
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
