// LoviBeauty v2 — Auth + Mis citas

function AuthScreenV(props) {
  var mode = _uS(props.mode || 'login');
  var name = _uS(''), phone = _uS(''), email = _uS(''), pass = _uS('');
  var err = _uS('');

  function submit(e) {
    e.preventDefault();
    err[1]('');
    if (mode[0] === 'login') {
      var r = props.onLogin(email[0].trim().toLowerCase(), pass[0]);
      if (r) err[1](r);
    } else {
      if (!name[0].trim() || phone[0].trim().length < 8) { err[1]('Completa tu nombre y teléfono'); return; }
      if (pass[0].length < 6) { err[1]('La contraseña debe tener al menos 6 caracteres'); return; }
      var r2 = props.onRegister({ name: name[0].trim(), phone: phone[0].trim(), email: email[0].trim().toLowerCase(), password: pass[0] });
      if (r2) err[1](r2);
    }
  }

  return (
    <SheetV title={mode[0] === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} onClose={props.onClose}>
      <form className="lv-formcol" onSubmit={submit} data-screen-label={mode[0] === 'login' ? 'Login' : 'Registro'}>
        {mode[0] === 'register' && <FieldV label="Nombre completo" value={name[0]} onChange={name[1]} placeholder="Tu nombre" autoFocus={true} />}
        {mode[0] === 'register' && <FieldV label="WhatsApp" value={phone[0]} onChange={phone[1]} placeholder="55 0000 0000" inputMode="tel" />}
        <FieldV label="Correo electrónico" type="email" value={email[0]} onChange={email[1]} placeholder="tu@correo.com" autoFocus={mode[0] === 'login'} />
        <FieldV label="Contraseña" type="password" value={pass[0]} onChange={pass[1]} placeholder="••••••" />
        {err[0] && <p className="lv-err">{err[0]}</p>}
        <GlassBtn full type="submit">{mode[0] === 'login' ? 'Entrar' : 'Crear mi cuenta'}</GlassBtn>
        <button type="button" className="lv-linkbtn" onClick={function() { mode[1](mode[0] === 'login' ? 'register' : 'login'); err[1](''); }}>
          {mode[0] === 'login' ? '¿No tienes cuenta? Créala aquí' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </SheetV>
  );
}

function MyAppointmentsV(props) {
  var db = props.db, user = props.user;
  var mine = db.appointments
    .filter(function(a) { return a.userId === user.id; })
    .sort(function(a, b) { return (a.date + a.time < b.date + b.time ? -1 : 1); });
  var t = todayStrV();
  var upcoming = mine.filter(function(a) { return a.date >= t && a.status !== 'cancelada'; });
  var past = mine.filter(function(a) { return a.date < t || a.status === 'cancelada'; }).reverse();
  var confirmId = _uS(null);

  return (
    <div className="lv-page" data-screen-label="Mis citas">
      <div className="lv-page-head">
        <div>
          <span className="lv-page-eyebrow">Hola, {user.name.split(' ')[0]} 💕</span>
          <h2>Mis citas</h2>
        </div>
        <button className="lv-linkbtn" onClick={props.onLogout}>Cerrar sesión</button>
      </div>

      <h3 className="lv-sec">Tarjeta de lealtad</h3>
      <div className="lv-loyalty">
        <div className="lv-loyalty-top">
          <div>
            <strong>LoviBeauty Club</strong>
            <span>Junta sellos con cada visita y gana premios</span>
          </div>
          <span className="lv-loyalty-soon">Muy pronto</span>
        </div>
        <div className="lv-loyalty-stamps" aria-hidden="true">
          {[0,1,2,3,4,5,6,7].map(function(i) {
            return <span key={i} className="lv-loyalty-stamp">{i === 7 ? '🎁' : '♥'}</span>;
          })}
        </div>
        <p className="lv-loyalty-note">Estamos preparando tu tarjeta. Tus visitas ya cuentan 💕</p>
      </div>

      <h3 className="lv-sec">Próximas</h3>
      {upcoming.length === 0 && (
        <div className="lv-emptycard">
          <p>No tienes citas próximas.</p>
          <GlassBtn onClick={props.onBook}>Agendar una cita</GlassBtn>
        </div>
      )}
      <div className="lv-list">
        {upcoming.map(function(a) {
          return (
            <ApptCardV key={a.id} appt={a}>
              {a.status === 'pendiente' && (
                <GlassBtn kind="whats" small href={whatsAppUrlV(a)} target="_blank">Enviar comprobante</GlassBtn>
              )}
              {(a.status === 'confirmada' || a.status === 'pendiente') && (
                confirmId[0] === a.id ? (
                  <div className="lv-cancelask">
                    <span>¿Solicitar cancelación? El estudio la revisará.</span>
                    <div className="lv-row2">
                      <GlassBtn kind="danger" small onClick={function() { props.requestCancel(a.id); confirmId[1](null); }}>Sí, solicitar</GlassBtn>
                      <GlassBtn kind="glass" small onClick={function() { confirmId[1](null); }}>No</GlassBtn>
                    </div>
                  </div>
                ) : (
                  <div className="lv-row2">
                    <GlassBtn kind="glass" small href={googleCalUrlV(a)} target="_blank">+ Calendario</GlassBtn>
                    <GlassBtn kind="ghostdanger" small onClick={function() { confirmId[1](a.id); }}>Cancelar</GlassBtn>
                  </div>
                )
              )}
              {a.status === 'cancelacion' && <p className="lv-note">Tu solicitud está en revisión.</p>}
            </ApptCardV>
          );
        })}
      </div>

      {past.length > 0 && <h3 className="lv-sec">Historial</h3>}
      <div className="lv-list">
        {past.map(function(a) { return <ApptCardV key={a.id} appt={a} compact />; })}
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreenV, MyAppointmentsV });
