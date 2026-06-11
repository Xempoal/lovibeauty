// LoviBeauty v2 — app raíz dentro de iPhone frame
// Flujo: Home (4 cats + 1 especial) → pick category → if 1 svc, go to booking; if N, show sub-services sheet → booking

function CategoryCard(props) {
  var ref = _uR(null);
  var parallax = _uS(0);

  _uE(function() {
    function onScroll() {
      if (!ref.current) return;
      var scroller = ref.current.closest('.lv-scroll-area');
      if (!scroller) return;
      var r = ref.current.getBoundingClientRect();
      var sr = scroller.getBoundingClientRect();
      var center = sr.top + sr.height / 2;
      var dist = r.top + r.height / 2 - center;
      var p = Math.max(-1, Math.min(1, dist / sr.height));
      parallax[1](p * 24);
    }
    var scroller = ref.current ? ref.current.closest('.lv-scroll-area') : null;
    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return function() {
      if (scroller) scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  var c = props.category;
  var big = props.big;
  return (
    <button ref={ref}
      className={'lv-cat-card' + (big ? ' big' : '')}
      onClick={function() { props.onPick(c); }}>
      <div className="lv-cat-img" style={{ backgroundImage: 'url(' + c.img + ')', transform: 'translateY(' + parallax[0] + 'px) scale(1.18)' }}></div>
      <div className="lv-cat-shade"></div>
      <div className="lv-cat-content">
        <div className="lv-cat-titles">
          <h3>{c.name}</h3>
          <p>{c.desc}</p>
        </div>
        <span className="lv-cat-cta">
          Agendar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </div>
    </button>
  );
}

function HomeV(props) {
  return (
    <div className="lv-home" data-screen-label="Inicio">
      <section className="lv-hero">
        <div className="lv-hero-blob" aria-hidden="true">
          <svg viewBox="0 0 400 400" width="100%" height="100%">
            <defs>
              <radialGradient id="lv-grad-a" cx="30%" cy="30%">
                <stop offset="0%" stopColor="#A4365A" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#A4365A" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="lv-grad-b" cx="70%" cy="70%">
                <stop offset="0%" stopColor="#D98E73" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#D98E73" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="140" cy="160" r="160" fill="url(#lv-grad-a)" />
            <circle cx="280" cy="240" r="180" fill="url(#lv-grad-b)" />
          </svg>
        </div>
        <div className="lv-hero-inner">
          <span className="lv-hero-eyebrow">LoviBeauty Studio</span>
          <h1>Tu momento de<br /><em>consentirte</em></h1>
          <p>Elige el servicio que te encanta.<br />Agendar te toma menos de un minuto.</p>
        </div>
      </section>

      <section className="lv-cat-grid">
        {CATEGORIES_V2.map(function(c) {
          return <CategoryCard key={c.id} category={c} onPick={props.onPick} />;
        })}
      </section>

      <section className="lv-cat-special">
        <span className="lv-sec-eyebrow">Especial del estudio</span>
        <CategoryCard category={SPECIAL_CAT_V2} big={true} onPick={props.onPick} />
      </section>

      <section className="lv-foot-section">
        <div className="lv-foot-card">
          <span className="lv-foot-eyebrow">LoviBeauty Studio</span>
          <p>Lun–Vie · 9 am – 8 pm<br />Sábado · 9 am – 6 pm</p>
          <button className="lv-linkbtn" onClick={props.onAdminPrompt}>Acceso del estudio</button>
        </div>
      </section>
    </div>
  );
}

// Sub-services sheet — when a category has multiple services
function SubServicesSheet(props) {
  var cat = props.category;
  var services = cat.services.map(function(id) { return svcV(id); }).filter(Boolean);
  return (
    <SheetV title={cat.name} onClose={props.onClose}>
      <p className="lv-paynote" style={{ textAlign: 'left', marginBottom: 14 }}>Elige el servicio que buscas:</p>
      <div className="lv-svc-pick-list">
        {services.map(function(s, i) {
          return (
            <button key={s.id} className="lv-svc-pick"
              style={{ animationDelay: (i * 50) + 'ms' }}
              onClick={function() { props.onPick(s.id); }}>
              <div className="lv-svc-pick-main">
                <strong>{s.name}</strong>
                <span>{s.desc}</span>
              </div>
              <div className="lv-svc-pick-side">
                <strong>{fmtMoneyV(s.price)}</strong>
                <span>{s.dur >= 60 ? Math.floor(s.dur/60) + 'h' + (s.dur%60 ? ' ' + (s.dur%60) + 'm' : '') : s.dur + ' min'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </SheetV>
  );
}

function AdminLoginV(props) {
  var email = _uS(''), pass = _uS(''), err = _uS('');
  return (
    <SheetV title="Acceso del estudio" onClose={props.onClose}>
      <form className="lv-formcol" onSubmit={function(e) {
        e.preventDefault();
        if (email[0].trim().toLowerCase() === ADMIN_EMAIL_V2 && pass[0] === ADMIN_PASS_V2) {
          props.onLogin(email[0].trim().toLowerCase(), pass[0]);
        } else err[1]('Credenciales incorrectas');
      }} data-screen-label="Login admin">
        <FieldV label="Correo" type="email" value={email[0]} onChange={email[1]} placeholder={ADMIN_EMAIL_V2} autoFocus={true} />
        <FieldV label="Contraseña" type="password" value={pass[0]} onChange={pass[1]} placeholder="••••••" />
        {err[0] && <p className="lv-err">{err[0]}</p>}
        <GlassBtn full type="submit">Entrar al panel</GlassBtn>
        <p className="lv-demo-hint">Demo: <code>{ADMIN_EMAIL_V2}</code> / <code>{ADMIN_PASS_V2}</code></p>
      </form>
    </SheetV>
  );
}

function AppV() {
  var db = _uS(loadDBV);
  var session = _uS(loadSessionV);
  var view = _uS('home'); // home | booking | cuenta | admin
  var pendingService = _uS(null);
  var subCat = _uS(null); // category with multiple services to choose
  var authMode = _uS(null);
  var msg = _uS(null);
  var scrolled = _uS(false);

  _uE(function() {
    var area = document.querySelector('.lv-scroll-area');
    function onScroll() { scrolled[1]((area ? area.scrollTop : window.scrollY) > 24); }
    if (area) area.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return function() {
      if (area) area.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [view[0]]);

  function toast(text) {
    var m = { id: Date.now(), text: text };
    msg[1](m);
    setTimeout(function() { msg[1](function(cur) { return (cur && cur.id === m.id ? null : cur); }); }, 2600);
  }

  function mutate(fn) {
    db[1](function(prev) {
      var next = fn(JSON.parse(JSON.stringify(prev)));
      saveDBV(next);
      return next;
    });
  }

  var user = session[0] && session[0].type === 'user' ? db[0].users.find(function(u) { return u.id === session[0].userId; }) : null;
  var isAdmin = session[0] && session[0].type === 'admin';

  function addAppt(data) {
    var appt = Object.assign({}, data, { id: uidV(), folio: null, createdAt: Date.now() });
    mutate(function(d) { appt.folio = mkFolioV(d); d.appointments.push(appt); return d; });
    return appt;
  }
  function updateAppt(id, patch) {
    mutate(function(d) { var a = d.appointments.find(function(x) { return x.id === id; }); if (a) Object.assign(a, patch); return d; });
  }
  function requestCancel(id) { updateAppt(id, { status: 'cancelacion' }); toast('Solicitud enviada al estudio'); }
  function addBlock(b) { mutate(function(d) { d.blocks.push(Object.assign({}, b, { id: uidV() })); return d; }); }
  function removeBlock(id) { mutate(function(d) { d.blocks = d.blocks.filter(function(b) { return b.id !== id; }); return d; }); }

  function doLogin(email, pass) {
    if (email === ADMIN_EMAIL_V2 && pass === ADMIN_PASS_V2) {
      var s = { type: 'admin' }; session[1](s); saveSessionV(s); authMode[1](null); view[1]('admin'); return null;
    }
    var u = db[0].users.find(function(x) { return x.email === email && x.password === pass; });
    if (!u) return 'Correo o contraseña incorrectos';
    var s2 = { type: 'user', userId: u.id }; session[1](s2); saveSessionV(s2); authMode[1](null);
    view[1]('cuenta');
    toast('¡Bienvenida, ' + u.name.split(' ')[0] + '!');
    return null;
  }
  function doRegister(data) {
    if (db[0].users.some(function(x) { return x.email === data.email; })) return 'Ese correo ya tiene cuenta';
    if (!data.email.includes('@')) return 'Escribe un correo válido';
    var u = Object.assign({}, data, { id: uidV() });
    mutate(function(d) { d.users.push(u); return d; });
    var s = { type: 'user', userId: u.id }; session[1](s); saveSessionV(s); authMode[1](null);
    toast('¡Cuenta creada! 💕');
    return null;
  }
  function logout() { session[1](null); saveSessionV(null); view[1]('home'); }

  function pickCategory(cat) {
    if (cat.services.length === 1) {
      pendingService[1](cat.services[0]);
      view[1]('booking');
    } else {
      subCat[1](cat);
    }
  }
  function pickService(sId) {
    subCat[1](null);
    pendingService[1](sId);
    view[1]('booking');
  }

  return (
    <div className="lv-root">
        <header className={'lv-header' + (scrolled[0] || view[0] !== 'home' ? ' compact' : '')}>
          <button className="lv-brand" onClick={function() { view[1]('home'); }}>
            <img src="assets/logo.png" alt="" />
            <span>LoviBeauty</span>
          </button>
          <nav className="lv-nav">
            {!isAdmin && view[0] !== 'cuenta' && (
              <button className="lv-navlink" onClick={function() { user ? view[1]('cuenta') : authMode[1]('login'); }}>
                {user ? 'Mis citas' : 'Iniciar sesión'}
              </button>
            )}
            {isAdmin && view[0] !== 'admin' && (
              <button className="lv-navlink" onClick={function() { view[1]('admin'); }}>Panel</button>
            )}
          </nav>
        </header>

        <main className="lv-main lv-scroll-area">
          <PageTransition k={view[0]}>
            {view[0] === 'home' && <HomeV onPick={pickCategory} onAdminPrompt={function() { authMode[1]('admin'); }} />}
            {view[0] === 'booking' && pendingService[0] && (
              <BookingV2 db={db[0]} user={user} addAppt={addAppt} toast={toast}
                initialServiceId={pendingService[0]}
                onClose={function() { pendingService[1](null); view[1](user ? 'cuenta' : 'home'); }}
                onGoLogin={function() { authMode[1]('login'); }}
                key={pendingService[0]} />
            )}
            {view[0] === 'cuenta' && user && (
              <MyAppointmentsV db={db[0]} user={user} requestCancel={requestCancel}
                onBook={function() { view[1]('home'); }} onLogout={logout} />
            )}
            {view[0] === 'cuenta' && !user && <HomeV onPick={pickCategory} onAdminPrompt={function() { authMode[1]('admin'); }} />}
            {view[0] === 'admin' && isAdmin && (
              <AdminPanelV db={db[0]} updateAppt={updateAppt} addBlock={addBlock} removeBlock={removeBlock}
                onLogout={logout} toast={toast} />
            )}
          </PageTransition>
        </main>

        {subCat[0] && <SubServicesSheet category={subCat[0]} onPick={pickService} onClose={function() { subCat[1](null); }} />}
        {(authMode[0] === 'login' || authMode[0] === 'register') && (
          <AuthScreenV mode={authMode[0]} onLogin={doLogin} onRegister={doRegister} onClose={function() { authMode[1](null); }} />
        )}
        {authMode[0] === 'admin' && <AdminLoginV onLogin={doLogin} onClose={function() { authMode[1](null); }} />}

        <ToastV msg={msg[0]} />
      </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppV />);
