// LoviBeauty v2 — app root.
//
// Talks to Supabase via window.lbApi for everything customer-facing:
//   * services + service_options for the home grid and the sub-services sheet
//   * business_hours so the date strip skips closed days
//   * create_booking / get_booking / get_availability via RPC inside BookingV2
//
// The admin panel and "Mis citas" still read from the legacy localStorage db
// for now; those move to Supabase in a follow-up session.

// Rotating promo banner carousel (app-style). Auto-advances every 5s, swipeable
// via native scroll-snap, with dot indicators. Banners come from Supabase
// (managed in the admin panel); tapping one with a linked service opens it.
function BannerCarousel(props) {
  var banners = props.banners || [];
  var idx = _uS(0);
  var ref = _uR(null);

  // Auto-advance unless the user is touching the carousel.
  _uE(function() {
    if (banners.length < 2) return;
    var t = setInterval(function() {
      var el = ref.current;
      if (!el || el.dataset.touch === '1') return;
      var w = el.clientWidth;
      if (!w) return;
      var i = Math.round(el.scrollLeft / w);
      var next = (i + 1) % banners.length;
      el.scrollTo({ left: next * w, behavior: 'smooth' });
    }, 5000);
    return function() { clearInterval(t); };
  }, [banners.length]);

  function onScroll() {
    var el = ref.current; if (!el || !el.clientWidth) return;
    var i = Math.max(0, Math.min(banners.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== idx[0]) idx[1](i);
  }
  function pauseTouch() {
    var el = ref.current; if (!el) return;
    el.dataset.touch = '1';
    clearTimeout(el._touchT);
    el._touchT = setTimeout(function() { el.dataset.touch = '0'; }, 4000);
  }
  function goTo(i) {
    var el = ref.current; if (!el) return;
    pauseTouch();
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  if (!banners.length) return null;
  return (
    <section className="lv-bansec">
      <div className="lv-bantrack" ref={ref} onScroll={onScroll}
        onTouchStart={pauseTouch} onMouseDown={pauseTouch}>
        {banners.map(function(b, i) {
          return (
            <div key={b.id} className="lv-banslide">
              <button className="lv-banner" onClick={function() { props.onPickBanner(b); }}>
                {b.image_url
                  ? <div className="lv-banner-img" style={{ backgroundImage: 'url(' + b.image_url + ')' }}></div>
                  : <div className="lv-banner-img lv-banner-grad"></div>}
                <div className="lv-banner-shade"></div>
                <span className="lv-banner-spark" aria-hidden="true">✦</span>
                <div className="lv-banner-body">
                  <h3>{b.title}</h3>
                  {b.subtitle && <p>{b.subtitle}</p>}
                  {b.service_id && (
                    <span className="lv-banner-cta">
                      Reservar
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="lv-bandots">
          {banners.map(function(b, i) {
            return <button key={b.id} className={'lv-bandot' + (i === idx[0] ? ' on' : '')}
              aria-label={'Banner ' + (i + 1)} onClick={function() { goTo(i); }}></button>;
          })}
        </div>
      )}
    </section>
  );
}

// Category as an app-style icon: circular photo bubble with a gradient ring.
function CategoryIcon(props) {
  var c = props.category;
  return (
    <button className="lv-icon-item" style={{ animationDelay: (props.index * 70) + 'ms' }}
      onClick={function() { props.onPick(c); }}>
      <span className="lv-icon-ring">
        <span className="lv-icon-bubble" style={{ backgroundImage: 'url(' + c.image_url + ')' }}></span>
      </span>
      <span className="lv-icon-name">{c.name}</span>
    </button>
  );
}

// Default banner shown until the studio creates its own in the admin panel.
var DEFAULT_BANNERS_V = [{
  id: 'default',
  title: 'Tu momento de consentirte',
  subtitle: 'Agenda tu cita en menos de un minuto 💕',
  image_url: null,
  service_id: null,
}];

function HomeV(props) {
  var services = props.services || [];
  var loading  = props.loading;
  var banners  = (props.banners && props.banners.length) ? props.banners : DEFAULT_BANNERS_V;

  function pickBanner(b) {
    if (!b.service_id) return;
    var svc = services.find(function(s) { return s.id === b.service_id; });
    if (svc) props.onPick(svc);
  }

  return (
    <div className="lv-home" data-screen-label="Inicio">
      <div className="lv-apphead">
        <span className="lv-spark s1" aria-hidden="true">✦</span>
        <span className="lv-spark s2" aria-hidden="true">✧</span>
        <span className="lv-greet">✦ LoviBeauty Studio</span>
        <h1>¿Qué te hacemos <em>hoy</em>?</h1>
      </div>

      {loading && (
        <section className="lv-home-skel">
          <span className="lv-skel lv-skel-banner"></span>
          <div className="lv-skel-iconrow">
            <span className="lv-skel lv-skel-icon"></span>
            <span className="lv-skel lv-skel-icon"></span>
            <span className="lv-skel lv-skel-icon"></span>
            <span className="lv-skel lv-skel-icon"></span>
          </div>
        </section>
      )}

      {!loading && (
        <BannerCarousel banners={banners} onPickBanner={pickBanner} />
      )}

      {!loading && services.length > 0 && (
        <section className="lv-iconsec">
          <div className="lv-iconsec-head">
            <h2>Categorías</h2>
            <span className="lv-iconsec-hint">Toca para agendar</span>
          </div>
          <div className="lv-icon-grid">
            {services.map(function(c, i) {
              return <CategoryIcon key={c.id} category={c} index={i} onPick={props.onPick} />;
            })}
          </div>
        </section>
      )}

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

      <section className="lv-foot-section">
        <div className="lv-foot-card">
          <span className="lv-foot-eyebrow">LoviBeauty Studio</span>
          <p>Lun–Vie · 9 am – 8 pm<br />Sábado · 9 am – 6 pm</p>
          <button className="lv-linkbtn" onClick={props.onAdminPrompt}>Acceso del estudio</button>
        </div>
        <div className="lv-powered">
          <a className="lv-powered-link" href="https://borenstudio.com" target="_blank" rel="noopener">
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
  var banners       = _uS([]);    // home carousel banners (admin-managed)
  var paymentConfig = _uS({ enabled: false }); // pasarela de pago (off por defecto)

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
      window.lbApi.loadBanners(),
      window.lbApi.loadPaymentConfig(),
    ]).then(function(results) {
      if (cancelled) return;
      services[1](results[0]);
      businessHours[1](results[1]);
      businessConfig[1](results[2]);
      banners[1](results[3]);
      paymentConfig[1](results[4] || { enabled: false });
      servicesLoading[1](false);
    }).catch(function(err) {
      if (cancelled) return;
      console.error('[app] catalog load', err);
      servicesLoading[1](false);
      toast('No pudimos cargar el catálogo. Recarga la página.');
    });
    return function() { cancelled = true; };
  }, []);

  // Retorno desde la pasarela de pago: la URL trae ?pago=ok|pendiente|cancelado.
  // El webhook confirma la cita por su cuenta; aquí solo avisamos y limpiamos la
  // URL para que no quede el parámetro al recargar.
  _uE(function() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    var pago = params.get('pago');
    if (!pago) return;
    var MSG = {
      ok:        '¡Pago recibido! Tu cita quedó confirmada 💖',
      pendiente: 'Tu pago está en revisión. Te confirmamos en cuanto se acredite.',
      cancelado: 'El pago no se completó. Puedes intentarlo de nuevo cuando quieras.',
    };
    toast(MSG[pago] || 'Gracias por tu pago.');
    try {
      params.delete('pago'); params.delete('cita');
      var qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
    } catch (e) { /* noop */ }
    if (pago === 'ok' && user) view[1]('cuenta');
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

  // Cuenta de clienta: la sesión guarda el usuario completo (name/email/phone)
  // devuelto por los RPCs de Supabase. Sesiones viejas (userId de localStorage)
  // simplemente quedan deslogueadas.
  var user = session[0] && session[0].type === 'user' ? (session[0].user || null) : null;
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

  async function doLogin(email, pass) {
    if (email === ADMIN_EMAIL_V2 && pass === ADMIN_PASS_V2) {
      var s = { type: 'admin' }; session[1](s); saveSessionV(s); authMode[1](null); view[1]('admin'); return null;
    }
    try {
      var row = await window.lbApi.loginAccount(email, pass);
      if (!row) return 'Correo o contraseña incorrectos';
      var s2 = { type: 'user', user: { name: row.full_name, email: row.email, phone: row.phone || '' } };
      session[1](s2); saveSessionV(s2); authMode[1](null);
      view[1]('cuenta');
      toast('¡Bienvenida, ' + row.full_name.split(' ')[0] + '!');
      return null;
    } catch (err) {
      console.error('[app] login', err);
      return 'No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.';
    }
  }
  async function doRegister(data) {
    if (!data.email.includes('@')) return 'Escribe un correo válido';
    try {
      var row = await window.lbApi.registerAccount(data);
      var s = { type: 'user', user: { name: row.full_name, email: row.email, phone: row.phone || '' } };
      session[1](s); saveSessionV(s); authMode[1](null);
      view[1]('cuenta');
      toast('¡Cuenta creada! 💕');
      return null;
    } catch (err) {
      if (err.code === '23505') return 'Ese correo ya tiene cuenta. Inicia sesión.';
      if (err.code === '22023') return 'Revisa tus datos: correo válido y contraseña de al menos 6 caracteres.';
      console.error('[app] register', err);
      return 'No pudimos crear tu cuenta. Intenta de nuevo.';
    }
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
                {user ? 'Mi cuenta' : 'Iniciar sesión'}
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
                banners={banners[0]}
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
                paymentConfig={paymentConfig[0]}
                toast={toast}
                onClose={closeBooking}
                onGoLogin={function() { authMode[1]('login'); }}
                key={pendingServiceOption[0].id}
              />
            )}
            {view[0] === 'cuenta' && user && (
              <MyAppointmentsV user={user} toast={toast} businessConfig={businessConfig[0]}
                onBook={function() { view[1]('home'); }} onLogout={logout} />
            )}
            {view[0] === 'cuenta' && !user && (
              <HomeV
                services={services[0]}
                banners={banners[0]}
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
