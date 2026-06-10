// LoviBeauty v2 — Admin panel (sin JSX en partes raras)

function ManageSheetV(props) {
  var view = _uS('main');
  var date = _uS(props.appt.date);
  var slot = _uS(null);
  var appt = props.appt;
  var s = svcV(appt.serviceId), st = staffOfV(appt.staffId);
  var autoSlots = view[0] === 'move' ? getAutoSlots(props.db, s, date[0]) : [];

  return (
    <SheetV title={'Cita ' + appt.folio} onClose={props.onClose}>
      <div className="lv-managetop">
        <div>
          <strong>{s.name}</strong>
          <span>{appt.clientName} · {appt.clientPhone}</span>
          <span>{fmtDateV(appt.date)} · {fmtTimeV(appt.time)} · con {st.name}</span>
        </div>
        <BadgeV status={appt.status} />
      </div>

      {view[0] === 'main' && (
        <div className="lv-formcol">
          {appt.status === 'pendiente' && (
            <GlassBtn full onClick={function() { props.updateAppt(appt.id, { status: 'confirmada' }); props.toast('Anticipo recibido ✓'); props.onClose(); }}>
              Marcar anticipo recibido — confirmar cita
            </GlassBtn>
          )}
          {appt.status === 'cancelacion' && (
            <div className="lv-cancelask">
              <span>La clienta solicitó cancelar esta cita.</span>
              <div className="lv-row2">
                <GlassBtn kind="danger" small onClick={function() { props.updateAppt(appt.id, { status: 'cancelada' }); props.toast('Cita cancelada'); props.onClose(); }}>Aprobar cancelación</GlassBtn>
                <GlassBtn kind="glass" small onClick={function() { props.updateAppt(appt.id, { status: 'confirmada' }); props.toast('Solicitud rechazada'); props.onClose(); }}>Rechazar</GlassBtn>
              </div>
            </div>
          )}
          {(appt.status === 'pendiente' || appt.status === 'confirmada') && (
            <GlassBtn kind="soft" full onClick={function() { view[1]('move'); }}>Cambiar fecha / hora</GlassBtn>
          )}
          {(appt.status === 'pendiente' || appt.status === 'confirmada') && (
            <GlassBtn kind="ghostdanger" full onClick={function() { props.updateAppt(appt.id, { status: 'cancelada' }); props.toast('Cita cancelada'); props.onClose(); }}>
              Cancelar cita
            </GlassBtn>
          )}
        </div>
      )}

      {view[0] === 'move' && (
        <div className="lv-formcol">
          <p className="lv-note">Elige nueva fecha y hora:</p>
          <DateStripV value={date[0]} onChange={function(d) { date[1](d); slot[1](null); }} />
          <SlotGridV slots={autoSlots} value={slot[0]} onChange={slot[1]} />
          <div className="lv-row2">
            <GlassBtn kind="glass" onClick={function() { view[1]('main'); }}>Atrás</GlassBtn>
            <GlassBtn disabled={!slot[0]} onClick={function() {
              props.updateAppt(appt.id, { date: date[0], time: slot[0].time, staffId: slot[0].staffId });
              props.toast('Cita movida'); props.onClose();
            }}>Mover</GlassBtn>
          </div>
        </div>
      )}
    </SheetV>
  );
}

function AdminToday(props) {
  var db = props.db;
  var t = todayStrV();
  var todays = db.appointments.filter(function(a) { return a.date === t && a.status !== 'cancelada'; })
    .sort(function(a, b) { return toMinV(a.time) - toMinV(b.time); });
  var income = todays.reduce(function(acc, a) { return acc + a.price; }, 0);
  var pending = db.appointments.filter(function(a) { return a.status === 'pendiente' && a.date >= t; });
  var cancelReqs = db.appointments.filter(function(a) { return a.status === 'cancelacion'; });

  return (
    <div data-screen-label="Admin — Hoy">
      <div className="lv-kpis">
        <div className="lv-kpi"><strong>{todays.length}</strong><span>citas hoy</span></div>
        <div className="lv-kpi"><strong>{fmtMoneyV(income)}</strong><span>ingreso esperado</span></div>
        <div className="lv-kpi"><strong>{pending.length}</strong><span>por confirmar</span></div>
      </div>

      {cancelReqs.length > 0 && (
        <div className="lv-alert">
          <strong>{cancelReqs.length} solicitud{cancelReqs.length > 1 ? 'es' : ''} de cancelación</strong>
          <div className="lv-list" style={{ marginTop: 10 }}>
            {cancelReqs.map(function(a) {
              return <button key={a.id} className="lv-rowbtn" onClick={function() { props.openAppt(a); }}>
                {a.clientName} · {svcV(a.serviceId).name} · {fmtDateShortV(a.date)} {fmtTimeV(a.time)} →
              </button>;
            })}
          </div>
        </div>
      )}

      <h3 className="lv-sec">Agenda de hoy</h3>
      {todays.length === 0 && <p className="lv-empty">Sin citas hoy.</p>}
      <div className="lv-list">
        {todays.map(function(a) {
          return (
            <button key={a.id} className="lv-adminappt" onClick={function() { props.openAppt(a); }}>
              <span className="lv-adminappt-time">{fmtTimeV(a.time)}</span>
              <div className="lv-adminappt-mid">
                <strong>{a.clientName}</strong>
                <span>{svcV(a.serviceId).name} · {staffOfV(a.staffId).name}</span>
              </div>
              <BadgeV status={a.status} />
            </button>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div>
          <h3 className="lv-sec">Anticipos por confirmar</h3>
          <div className="lv-list">
            {pending.map(function(a) {
              return (
                <button key={a.id} className="lv-adminappt" onClick={function() { props.openAppt(a); }}>
                  <span className="lv-adminappt-time">{fmtDateShortV(a.date)}</span>
                  <div className="lv-adminappt-mid">
                    <strong>{a.clientName}</strong>
                    <span>{svcV(a.serviceId).name} · transferencia</span>
                  </div>
                  <BadgeV status={a.status} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminWeek(props) {
  var weekOff = _uS(0);
  var monday = _uM(function() {
    var d = fromDateStrV(todayStrV());
    var dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow + weekOff[0] * 7);
    return toDateStrV(d);
  }, [weekOff[0]]);
  var days = Array.from({ length: 6 }, function(_, i) { return addDaysV(monday, i); });
  var START = 540, END = 1200, PX = 1.0;

  return (
    <div data-screen-label="Admin — Semana">
      <div className="lv-weeknav">
        <GlassBtn kind="glass" small onClick={function() { weekOff[1](weekOff[0] - 1); }}>← Anterior</GlassBtn>
        <strong>{fmtDateShortV(days[0])} — {fmtDateShortV(days[5])}</strong>
        <GlassBtn kind="glass" small onClick={function() { weekOff[1](weekOff[0] + 1); }}>Siguiente →</GlassBtn>
      </div>
      <div className="lv-weekscroll">
        <div className="lv-week" style={{ height: (END - START) * PX + 34 }}>
          <div className="lv-week-times">
            {Array.from({ length: (END - START) / 60 + 1 }, function(_, i) {
              return <span key={i} style={{ top: i * 60 * PX + 34 }}>{fmtTimeV(toHHMMV(START + i * 60))}</span>;
            })}
          </div>
          {days.map(function(ds) {
            var appts = props.db.appointments.filter(function(a) { return a.date === ds && a.status !== 'cancelada'; });
            var blocks = props.db.blocks.filter(function(b) { return b.date === ds; });
            var isToday = ds === todayStrV();
            return (
              <div key={ds} className={'lv-week-col' + (isToday ? ' today' : '')}>
                <div className="lv-week-colhead">{fmtDowV(ds)} {fromDateStrV(ds).getDate()}</div>
                <div className="lv-week-colbody" style={{ height: (END - START) * PX }}>
                  {blocks.map(function(b) {
                    return <div key={b.id} className="lv-week-block" style={{
                      top: (toMinV(b.start) - START) * PX,
                      height: (toMinV(b.end) - toMinV(b.start)) * PX,
                    }}>{b.reason}</div>;
                  })}
                  {appts.map(function(a) {
                    return (
                      <button key={a.id} className={'lv-week-appt s-' + a.status} onClick={function() { props.openAppt(a); }} style={{
                        top: (toMinV(a.time) - START) * PX,
                        height: Math.max(a.dur * PX, 26),
                      }}>
                        <strong>{fmtTimeV(a.time)} {a.clientName.split(' ')[0]}</strong>
                        <span>{svcV(a.serviceId).name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminBlocks(props) {
  var date = _uS(todayStrV());
  var start = _uS('14:00');
  var end = _uS('15:00');
  var who = _uS('all');
  var reason = _uS('');
  var t = todayStrV();
  var upcoming = props.db.blocks.filter(function(b) { return b.date >= t; })
    .sort(function(a, b) { return (a.date + a.start < b.date + b.start ? -1 : 1); });
  var hourOpts = [];
  for (var m = 540; m <= 1200; m += 30) hourOpts.push(toHHMMV(m));

  return (
    <div data-screen-label="Admin — Bloqueos">
      <h3 className="lv-sec">Bloquear horario</h3>
      <div className="lv-blockform">
        <label className="lv-field">
          <span className="lv-field-label">Fecha</span>
          <input type="date" value={date[0]} min={t} onChange={function(e) { date[1](e.target.value); }} />
        </label>
        <div className="lv-row2">
          <label className="lv-field">
            <span className="lv-field-label">Desde</span>
            <select value={start[0]} onChange={function(e) { start[1](e.target.value); }}>
              {hourOpts.map(function(h) { return <option key={h} value={h}>{fmtTimeV(h)}</option>; })}
            </select>
          </label>
          <label className="lv-field">
            <span className="lv-field-label">Hasta</span>
            <select value={end[0]} onChange={function(e) { end[1](e.target.value); }}>
              {hourOpts.map(function(h) { return <option key={h} value={h}>{fmtTimeV(h)}</option>; })}
            </select>
          </label>
        </div>
        <label className="lv-field">
          <span className="lv-field-label">Aplica a</span>
          <select value={who[0]} onChange={function(e) { who[1](e.target.value); }}>
            <option value="all">Todo el estudio</option>
            {STAFF_V2.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
          </select>
        </label>
        <FieldV label="Motivo" value={reason[0]} onChange={reason[1]} placeholder="Comida, festivo, curso…" />
        <GlassBtn full disabled={toMinV(end[0]) <= toMinV(start[0])} onClick={function() {
          props.addBlock({ date: date[0], start: start[0], end: end[0], staffId: who[0], reason: reason[0].trim() || 'Bloqueado' });
          reason[1](''); props.toast('Horario bloqueado');
        }}>Bloquear</GlassBtn>
      </div>

      <h3 className="lv-sec">Próximos bloqueos</h3>
      {upcoming.length === 0 && <p className="lv-empty">Sin bloqueos próximos.</p>}
      <div className="lv-list">
        {upcoming.map(function(b) {
          return (
            <div key={b.id} className="lv-blockrow">
              <div>
                <strong>{fmtDateShortV(b.date)} · {fmtTimeV(b.start)}–{fmtTimeV(b.end)}</strong>
                <span>{b.reason} · {b.staffId === 'all' ? 'todo el estudio' : staffOfV(b.staffId).name}</span>
              </div>
              <GlassBtn kind="ghostdanger" small onClick={function() { props.removeBlock(b.id); }}>Quitar</GlassBtn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminClients(props) {
  var open = _uS(null);
  var groups = _uM(function() {
    var map = {};
    props.db.appointments.forEach(function(a) {
      var k = a.clientPhone;
      if (!map[k]) map[k] = { name: a.clientName, phone: a.clientPhone, appts: [] };
      map[k].appts.push(a);
    });
    return Object.values(map).map(function(g) {
      g.appts.sort(function(a, b) { return (a.date + a.time < b.date + b.time ? 1 : -1); });
      g.visits = g.appts.filter(function(a) { return a.status !== 'cancelada'; }).length;
      return g;
    }).sort(function(a, b) { return b.visits - a.visits; });
  }, [props.db]);

  return (
    <div data-screen-label="Admin — Clientas">
      <h3 className="lv-sec">Clientas ({groups.length})</h3>
      <div className="lv-list">
        {groups.map(function(g) {
          return (
            <div key={g.phone} className="lv-clientcard">
              <button className="lv-clientrow" onClick={function() { open[1](open[0] === g.phone ? null : g.phone); }}>
                <div>
                  <strong>{g.name}</strong>
                  <span>{g.phone} · {g.visits} cita{g.visits !== 1 ? 's' : ''}</span>
                </div>
                <span className="lv-chev">{open[0] === g.phone ? '▴' : '▾'}</span>
              </button>
              {open[0] === g.phone && (
                <div className="lv-clienthist">
                  {g.appts.map(function(a) {
                    return <button key={a.id} className="lv-rowbtn" onClick={function() { props.openAppt(a); }}>
                      {fmtDateShortV(a.date)} · {svcV(a.serviceId).name} · {STATUS_META_V[a.status].label} →
                    </button>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminPanelV(props) {
  var tab = _uS('hoy');
  var managing = _uS(null);
  var appt = managing[0] ? props.db.appointments.find(function(a) { return a.id === managing[0]; }) : null;
  var tabs = [['hoy','Hoy'],['semana','Semana'],['bloqueos','Bloqueos'],['clientas','Clientas']];
  function openAppt(a) { managing[1](a.id); }

  return (
    <div className="lv-page lv-adminpage" data-screen-label="Panel admin">
      <div className="lv-page-head">
        <div>
          <span className="lv-page-eyebrow">Panel del estudio</span>
          <h2>Hola, Lovi 💕</h2>
        </div>
        <button className="lv-linkbtn" onClick={props.onLogout}>Salir</button>
      </div>
      <div className="lv-tabs">
        {tabs.map(function(arr) {
          return <button key={arr[0]} className={'lv-tab' + (tab[0] === arr[0] ? ' sel' : '')} onClick={function() { tab[1](arr[0]); }}>{arr[1]}</button>;
        })}
      </div>
      <PageTransition k={tab[0]}>
        {tab[0] === 'hoy' && <AdminToday db={props.db} openAppt={openAppt} />}
        {tab[0] === 'semana' && <AdminWeek db={props.db} openAppt={openAppt} />}
        {tab[0] === 'bloqueos' && <AdminBlocks db={props.db} addBlock={props.addBlock} removeBlock={props.removeBlock} toast={props.toast} />}
        {tab[0] === 'clientas' && <AdminClients db={props.db} openAppt={openAppt} />}
      </PageTransition>
      {appt && <ManageSheetV db={props.db} appt={appt} updateAppt={props.updateAppt} onClose={function() { managing[1](null); }} toast={props.toast} />}
    </div>
  );
}

Object.assign(window, { AdminPanelV });
