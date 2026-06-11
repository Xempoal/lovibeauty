// LoviBeauty v2 — app root.
//
// Talks to Supabase via window.lbApi for everything customer-facing:
//   * services + service_options for the home grid and the sub-services sheet
//   * business_hours so the date strip skips closed days
//   * create_booking / get_booking / get_availability via RPC inside BookingV2
//
// The admin panel and "Mis citas" still read from the legacy localStorage db
// for now; those move to Supabase in a follow-up session.

// Editorial service card: scroll reveal (clip-path), giant index number,
// alternating tilt + arch mask, with the original scroll parallax on the image.
function CategoryCard(props) {
  var revealed = useReveal(0.12);
  var ref = revealed[0], isIn = revealed[1];
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
      parallax[1](p * 26);
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
  var feature = props.feature;
  var itemCls = 'lv-ed-item'
    + (isIn ? ' is-in' : '')
    + (feature ? ' feature' : (props.index % 2 === 0 ? ' t-l' : ' t-r'));
  return (
    <div ref={ref} className={itemCls}>
      <span className="lv-ed-num" aria-hidden="true">{props.index < 9 ? '0' + (props.index + 1) : props.index + 1}</span>
      <button
        className={'lv-ed-card' + (props.arch ? ' arch' : '') + (feature ? ' feature' : '')}
        onClick={function() { props.onPick(c); }}>
        <div className="lv-ed-clip">
          <div className="lv-ed-imgwrap">
            <div className="lv-ed-img" style={{ backgroundImage: 'url(' + c.image_url + ')', transform: 'translateY(' + parallax[0] + 'px) scale(1.18)' }}></div>
            <div className="lv-ed-shade"></div>
          </div>
          <div className="lv-ed-content">
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <span className="lv-ed-cta">
              Agendar
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </div>
          {feature && <span className="lv-ed-ribbon">Especial</span>}
        </div>
      </button>
    </div>
  );
}

function HomeV(props) {
  var services = props.services || [];
  var loading  = props.loading;
  // Split the catalog into the main grid and the "special" feature row.
  // Convention: the row whose slug is 'especiales' is the feature card.
  var main    = services.filter(function(s) { return s.slug !== 'especiales'; });
  var special = services.find(function(s) { return s.slug === 'especiales'; });
  var ordered = special ? main.concat([special]) : main;

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
        <span className="lv-spark s1" aria-hidden="true">✦</span>
        <span className="lv-spark s2" aria-hidden="true">✦</span>
        <span className="lv-spark s3" aria-hidden="true">✧</span>
        <span className="lv-spark s4" aria-hidden="true">✦</span>
        <div className="lv-hero-inner">
          <span className="lv-hero-eyebrow">LoviBeauty Studio</span>
          <h1>Tu momento de<br /><em>consentirte</em></h1>
          <p>Elige el servicio que te encanta.<br />Agendar te toma menos de un minuto.</p>
        </div>
      </section>

      {!loading && services.length > 0 && (
        <div className="lv-marquee" aria-hidden="true">
          <div className="lv-marquee-track">
            {[0, 1].map(function(seg) {
              return (
                <div className="lv-marquee-seg" key={seg}>
                  {services.map(function(s) {
                    return (
                      <React.Fragment key={s.id}>
                        <span>{s.name}</span>
                        <i>✦</i>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <section className="lv-ed-skel">
          <span className="lv-skel"></span>
          <span className="lv-skel"></span>
        </section>
      )}

      {!loading && ordered.length > 0 && (
        <React.Fragment>
          <div className="lv-ed-head">
            <span className="lv-sec-eyebrow">Nuestros servicios</span>
            <h2>Elige tu <em>ritual</em></h2>
          </div>
          <section className="lv-editorial">
            {ordered.map(function(c, i) {
              var isFeature = special && c.id === special.id;
              return (
                <CategoryCard key={c.id} category={c} index={i}
                  arch={!isFeature && i % 2 === 0}
                  feature={isFeature}
                  onPick={props.onPick} />
              );
            })}
          </section>
        </React.Fragment>
      )}

      <section className="lv-foot-section">
        <div className="lv-foot-card">
          <span className="lv-foot-eyebrow">LoviBeauty Studio</span>
          <p>Lun–Vie · 9 am – 8 pm<br />Sábado · 9 am – 6 pm</p>
          <button className="lv-linkbtn" onClick={props.onAdminPrompt}>Acceso del estudio</button>
        </div>
        <div className="lv-powered">
          <a className="lv-powered-link" href="https://borestudio.com" target="_blank" rel="noopener">
            Powered by <strong>Boren Studio</strong>
          </a>
          <a className="lv-ig" href="https://www.instagram.com/boren.studio" target="_blank" rel="noopener" aria-label="Instagram de Boren Studio">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/>
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}

// Sub-services sheet: rendered when a service has more than one option.
// Receives an object { name, options: [...] } where options come from Supabase.
function SubServicesSheet(props) {
  var svc     = props.service;
  var options = svc.options || [];
  return (
    <SheetV title={svc.name} onClose={props.onClose}>
      <p className="lv-paynote" style={{ textAlign: 'left', marginBottom: 14 }}>Elige el servicio que buscas:</p>
      <div className="lv-svc-pick-list">
        {options.map(function(o, i) {
          var dur = o.duration_minutes >= 60
            ? Math.floor(o.duration_minutes/60) + 'h'
              + (o.duration_minutes % 60 ? ' ' + (o.duration_minutes % 60) + 'm' : '')
            : o.duration_minutes + ' min';
          return (
            <button key={o.id} className="lv-svc-pick"
              style={{ animationDelay: (i * 50) + 'ms' }}
              onClick={function() { props.onPick(o); }}>
              <div className="lv-svc-pick-main">
                <strong>{o.name}</strong>
                <span>{o.description}</span>
              </div>
              <div className="lv-svc-pick-side">
                <strong>{fmtMoneyV(Number(o.price))}</strong>
                <span>{dur}</span>
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
  // Legacy localStorage state — admin panel and "Mis citas" still read from it.
  var db = _uS(loadDBV);
  var session = _uS(loadSessionV);
  var view = _uS('home'); // home | booking | cuenta | admin

  // Real Supabase-backed catalog.
  var services      = _uS([]);
  var servicesLoading = _uS(true);
  var businessHours = _uS(null);
  var businessConfig = _uS(null); // { bank_clabe, bank_name, ... } from Supabase

  // Booking flow state.
  var pendingServiceOption = _uS(null); // service_options row
  var pendingServiceName   = _uS('');
  var subCatService        = _uS(null); // { ...service, options }
  var subCatLoading        = _uS(false);

  var authMode = _uS(null);
  var msg = _uS(null);
  var scrolled = _uS(false);

  // Load catalog once on mount.
  _uE(function() {
    var cancelled = false;
    Promise.all([
      window.lbApi.loadServices(),
      window.lbApi.loadBusinessHours(),
      window.lbApi.loadBusinessConfig(),
    ]).then(function(results) {
      if (cancelled) return;
      services[1](results[0]);
      businessHours[1](results[1]);
      businessConfig[1](results[2]);
      servicesLoading[1](false);
    }).catch(function(err) {
      if (cancelled) return;
      console.error('[app] catalog load', err);
      servicesLoading[1](false);
      toast('No pudimos cargar el catálogo. Recarga la página.');
    });
    return function() { cancelled = true; };
  }, []);

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

  // Legacy helpers kept for the admin panel / "Mis citas".
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

  // ─── Picking a service from the home grid ───
  async function pickService(svc) {
    if (subCatLoading[0]) return;
    subCatLoading[1](true);
    try {
      var options = await window.lbApi.loadServiceOptions(svc.id);
      if (options.length === 0) {
        toast('Este servicio no tiene opciones disponibles');
        return;
      }
      if (options.length === 1) {
        pendingServiceOption[1](options[0]);
        pendingServiceName[1](svc.name);
        view[1]('booking');
      } else {
        subCatService[1](Object.assign({}, svc, { options: options }));
      }
    } catch (err) {
      console.error('[app] loadServiceOptions', err);
      toast('No pudimos cargar las opciones');
    } finally {
      subCatLoading[1](false);
    }
  }

  function pickOption(option) {
    pendingServiceOption[1](option);
    pendingServiceName[1](subCatService[0] ? subCatService[0].name : '');
    subCatService[1](null);
    view[1]('booking');
  }

  function closeBooking() {
    pendingServiceOption[1](null);
    pendingServiceName[1]('');
    view[1](user ? 'cuenta' : 'home');
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
            {view[0] === 'home' && (
              <HomeV
                services={services[0]}
                loading={servicesLoading[0]}
                onPick={pickService}
                onAdminPrompt={function() { window.location.assign('/admin/'); }}
              />
            )}
            {view[0] === 'booking' && pendingServiceOption[0] && (
              <BookingV2
                user={user}
                serviceOption={pendingServiceOption[0]}
                serviceName={pendingServiceName[0]}
                businessHours={businessHours[0]}
                businessConfig={businessConfig[0]}
                toast={toast}
                onClose={closeBooking}
                onGoLogin={function() { authMode[1]('login'); }}
                key={pendingServiceOption[0].id}
              />
            )}
            {view[0] === 'cuenta' && user && (
              <MyAppointmentsV db={db[0]} user={user} requestCancel={requestCancel}
                onBook={function() { view[1]('home'); }} onLogout={logout} />
            )}
            {view[0] === 'cuenta' && !user && (
              <HomeV
                services={services[0]}
                loading={servicesLoading[0]}
                onPick={pickService}
                onAdminPrompt={function() { window.location.assign('/admin/'); }}
              />
            )}
            {view[0] === 'admin' && isAdmin && (
              <AdminPanelV db={db[0]} updateAppt={updateAppt} addBlock={addBlock} removeBlock={removeBlock}
                onLogout={logout} toast={toast} />
            )}
          </PageTransition>
        </main>

        {subCatService[0] && (
          <SubServicesSheet
            service={subCatService[0]}
            onPick={pickOption}
            onClose={function() { subCatService[1](null); }}
          />
        )}
        {(authMode[0] === 'login' || authMode[0] === 'register') && (
          <AuthScreenV mode={authMode[0]} onLogin={doLogin} onRegister={doRegister} onClose={function() { authMode[1](null); }} />
        )}
        {authMode[0] === 'admin' && <AdminLoginV onLogin={doLogin} onClose={function() { authMode[1](null); }} />}

        <ToastV msg={msg[0]} />
      </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppV />);
