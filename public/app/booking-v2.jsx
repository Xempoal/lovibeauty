// LoviBeauty v2 — booking: servicio → calendario → auto-staff → datos → pago → confirmación

function BookingV2({ db, user, addAppt, onClose, onGoLogin, toast, initialServiceId }) {
  var step = _uS(0); // 0=fecha, 1=hora, 2=datos, 3=pago
  var serviceId = _uS(initialServiceId || null);
  var date = _uS(null);
  var slot = _uS(null); // { time, staffId }
  var name = _uS(user ? user.name : '');
  var phone = _uS(user ? user.phone : '');
  var payMethod = _uS(null);
  var card = _uS({ num: '', exp: '', cvv: '' });
  var paying = _uS(false);
  var confirmed = _uS(null);

  var service = serviceId[0] ? svcV(serviceId[0]) : null;

  // init date
  _uE(function() {
    if (!date[0]) {
      var d = todayStrV();
      for (var i = 0; i < 30; i++) {
        if (isOpenDayV(d)) { date[1](d); break; }
        d = addDaysV(d, 1);
      }
    }
  }, []);

  var autoSlots = _uM(function() {
    if (!service || !date[0]) return [];
    return getAutoSlots(db, service, date[0]);
  }, [db, serviceId[0], date[0]]);

  function startBooking(sId) {
    serviceId[1](sId);
    slot[1](null);
    step[1](0);
  }

  function selectDate(d) {
    date[1](d);
    slot[1](null);
  }

  function selectSlot(s) {
    slot[1](s);
    step[1](1);
  }

  function goData() {
    step[1](2);
  }

  function goPayment() {
    if (!name[0].trim() || phone[0].trim().length < 8) return;
    step[1](3);
  }

  function finishPayment(method) {
    paying[1](true);
    setTimeout(function() {
      var appt = addAppt({
        serviceId: serviceId[0], staffId: slot[0].staffId, date: date[0], time: slot[0].time,
        dur: service.dur, price: service.price,
        clientName: name[0].trim(), clientPhone: phone[0].trim(),
        userId: user ? user.id : null, payMethod: method,
        status: method === 'card' ? 'confirmada' : 'pendiente',
      });
      paying[1](false);
      confirmed[1](appt);
    }, 1400);
  }

  function back() {
    if (confirmed[0]) return;
    if (step[0] === 0) { serviceId[1](null); onClose(); return; }
    if (step[0] === 1) { slot[1](null); step[1](0); return; }
    step[1](step[0] - 1);
  }

  // ---- confirmación ----
  if (confirmed[0]) {
    var c = confirmed[0];
    var isCard = c.payMethod === 'card';
    return (
      <div className="lv-booking" data-screen-label="Confirmación">
        <PageTransition k="confirm">
          <div className="lv-confirm">
            <div className={'lv-confirm-icon' + (isCard ? ' ok' : ' wait')}>
              {isCard ? '✓' : '⏳'}
            </div>
            <h2>{isCard ? '¡Cita confirmada!' : 'Casi listo…'}</h2>
            <p className="lv-confirm-sub">
              {isCard
                ? 'Recibimos tu anticipo. ¡Te esperamos!'
                : 'Envía tu comprobante de transferencia por WhatsApp para confirmar al 100%.'}
            </p>
            <ApptCardV appt={c} />
            {!isCard && (
              <div className="lv-bankbox">
                <div className="lv-bankrow"><em>Banco</em><span>{BANK_V2.banco}</span></div>
                <div className="lv-bankrow"><em>Titular</em><span>{BANK_V2.titular}</span></div>
                <div className="lv-bankrow"><em>CLABE</em><span>{BANK_V2.clabe}</span></div>
                <div className="lv-bankrow"><em>Monto</em><span>{fmtMoneyV(DEPOSIT_V2)}</span></div>
              </div>
            )}
            <div className="lv-confirm-actions">
              {!isCard && (
                <GlassBtn kind="whats" full href={whatsAppUrlV(c)} target="_blank">
                  Enviar comprobante por WhatsApp
                </GlassBtn>
              )}
              <div className="lv-row2">
                <GlassBtn kind="glass" href={googleCalUrlV(c)} target="_blank">Google Cal</GlassBtn>
                <GlassBtn kind="glass" onClick={function() { downloadICSV(c); }}>Apple / iCal</GlassBtn>
              </div>
              <GlassBtn kind="soft" full onClick={onClose}>Listo</GlassBtn>
            </div>
          </div>
        </PageTransition>
      </div>
    );
  }

  if (!serviceId[0]) return <div className="lv-empty">Selecciona un servicio</div>;

  var stepLabels = ['Elige fecha', 'Elige horario', 'Tus datos', 'Anticipo'];

  return (
    <div className="lv-booking" data-screen-label={'Reserva — ' + stepLabels[step[0]]}>
      {/* top bar */}
      <div className="lv-booking-topbar">
        <button className="lv-back" onClick={back} aria-label="Atrás">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="lv-booking-svc">
          <strong>{service.name}</strong>
          <span>{fmtMoneyV(service.price)} · {service.dur >= 60 ? Math.floor(service.dur/60) + 'h' + (service.dur%60 ? service.dur%60 + 'min' : '') : service.dur + ' min'}</span>
        </div>
        <div className="lv-stepper">
          {[0,1,2,3].map(function(i) {
            return <span key={i} className={'lv-stepDot' + (i <= step[0] ? ' on' : '')}></span>;
          })}
        </div>
      </div>

      <PageTransition k={'step-' + step[0]}>
        {/* step 0: fecha */}
        {step[0] === 0 && (
          <div className="lv-step">
            <h2 className="lv-step-title">¿Qué día te queda?</h2>
            <DateStripV value={date[0]} onChange={selectDate} />
            <div className="lv-sep"></div>
            <h3 className="lv-sublabel">Horarios disponibles</h3>
            <SlotGridV slots={autoSlots} value={slot[0]} onChange={selectSlot} />
          </div>
        )}

        {/* step 1: confirmación de slot */}
        {step[0] === 1 && slot[0] && (
          <div className="lv-step lv-step-center">
            <div className="lv-chosen-card">
              <div className="lv-chosen-top">
                <span className="lv-chosen-emoji">📅</span>
                <h2>{fmtDateV(date[0])}</h2>
                <p className="lv-chosen-time">{fmtTimeV(slot[0].time)}</p>
              </div>
              <div className="lv-chosen-staff">
                <AvatarV staff={staffOfV(slot[0].staffId)} size={48} />
                <div>
                  <strong>{staffOfV(slot[0].staffId).name}</strong>
                  <span>{staffOfV(slot[0].staffId).role}</span>
                </div>
              </div>
              <div className="lv-chosen-svc">
                <span>{service.name}</span>
                <strong>{fmtMoneyV(service.price)}</strong>
              </div>
            </div>
            <GlassBtn full onClick={goData}>Continuar</GlassBtn>
          </div>
        )}

        {/* step 2: datos */}
        {step[0] === 2 && (
          <div className="lv-step">
            <h2 className="lv-step-title">¿Cómo te contactamos?</h2>
            {!user && (
              <button className="lv-loginhint" onClick={onGoLogin}>
                ¿Ya tienes cuenta? <strong>Inicia sesión</strong>
              </button>
            )}
            <div className="lv-formcol">
              <FieldV label="Nombre completo" value={name[0]} onChange={name[1]} placeholder="Tu nombre" autoFocus={!name[0]} />
              <FieldV label="WhatsApp" value={phone[0]} onChange={phone[1]} placeholder="55 0000 0000" inputMode="tel" />
            </div>
            <GlassBtn full disabled={!name[0].trim() || phone[0].trim().length < 8} onClick={goPayment}>
              Continuar al anticipo
            </GlassBtn>
          </div>
        )}

        {/* step 3: pago */}
        {step[0] === 3 && (
          <div className="lv-step">
            <h2 className="lv-step-title">Anticipo de {fmtMoneyV(DEPOSIT_V2)}</h2>
            <p className="lv-paynote">Se descuenta del total el día de tu cita.</p>
            <div className="lv-paytabs">
              <button className={'lv-paytab' + (payMethod[0] === 'card' ? ' sel' : '')} onClick={function() { payMethod[1]('card'); }}>
                <span className="lv-paytab-icon">💳</span>
                <strong>Tarjeta</strong>
                <span>Al instante</span>
              </button>
              <button className={'lv-paytab' + (payMethod[0] === 'transfer' ? ' sel' : '')} onClick={function() { payMethod[1]('transfer'); }}>
                <span className="lv-paytab-icon">🏦</span>
                <strong>Transferencia</strong>
                <span>Envías comprobante</span>
              </button>
            </div>

            {payMethod[0] === 'card' && (
              <div className="lv-formcol lv-fadein">
                <FieldV label="Número de tarjeta" value={card[0].num} inputMode="numeric" placeholder="0000 0000 0000 0000"
                  onChange={function(v) { card[1](Object.assign({}, card[0], { num: v.replace(/[^\d ]/g,'').slice(0,19) })); }} />
                <div className="lv-row2">
                  <FieldV label="Vence" value={card[0].exp} placeholder="MM/AA" inputMode="numeric"
                    onChange={function(v) { card[1](Object.assign({}, card[0], { exp: v.slice(0,5) })); }} />
                  <FieldV label="CVV" value={card[0].cvv} placeholder="123" inputMode="numeric"
                    onChange={function(v) { card[1](Object.assign({}, card[0], { cvv: v.replace(/\D/g,'').slice(0,4) })); }} />
                </div>
                <GlassBtn full
                  disabled={card[0].num.replace(/\s/g,'').length < 15 || card[0].exp.length < 4 || card[0].cvv.length < 3 || paying[0]}
                  onClick={function() { finishPayment('card'); }}>
                  {paying[0] ? 'Procesando…' : 'Pagar ' + fmtMoneyV(DEPOSIT_V2)}
                </GlassBtn>
              </div>
            )}

            {payMethod[0] === 'transfer' && (
              <div className="lv-formcol lv-fadein">
                <div className="lv-bankbox">
                  <div className="lv-bankrow"><em>Banco</em><span>{BANK_V2.banco}</span></div>
                  <div className="lv-bankrow"><em>Titular</em><span>{BANK_V2.titular}</span></div>
                  <div className="lv-bankrow"><em>CLABE</em><span>{BANK_V2.clabe}</span></div>
                  <div className="lv-bankrow"><em>Monto</em><span>{fmtMoneyV(DEPOSIT_V2)}</span></div>
                </div>
                <p className="lv-paynote small">Tu lugar queda apartado. Envía comprobante por WhatsApp para confirmar.</p>
                <GlassBtn full disabled={paying[0]} onClick={function() { finishPayment('transfer'); }}>
                  {paying[0] ? 'Apartando…' : 'Apartar mi cita'}
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
