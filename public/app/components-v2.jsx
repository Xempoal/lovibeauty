// LoviBeauty v2 — componentes premium con animaciones

function useReveal(threshold) {
  threshold = threshold || 0.15;
  var ref = _uR(null);
  var vis = _uS(false);
  _uE(function() {
    var el = ref.current; if (!el) return;
    var obs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { vis[1](true); obs.disconnect(); }
    }, { threshold: threshold });
    obs.observe(el);
    return function() { obs.disconnect(); };
  }, []);
  return [ref, vis[0]];
}

function PageTransition(props) {
  var s = _uS(false);
  _uE(function() { var t = setTimeout(function() { s[1](true); }, 30); return function() { clearTimeout(t); }; }, [props.k]);
  return React.createElement('div', { className: 'lv-page-trans' + (s[0] ? ' in' : ''), key: props.k }, props.children);
}

function BadgeV(props) {
  var m = STATUS_META_V[props.status];
  return React.createElement('span', { className: 'lv-badge', style: { color: m.color, background: m.bg } }, m.label);
}

function AvatarV(props) {
  var staff = props.staff, size = props.size || 44;
  return React.createElement('div', {
    className: 'lv-avatar',
    style: { width: size, height: size, fontSize: size * 0.42,
      background: 'oklch(0.93 0.04 ' + staff.hue + ')', color: 'oklch(0.40 0.14 ' + staff.hue + ')' }
  }, staff.name[0]);
}

function GlassBtn(props) {
  var cls = 'lv-btn lv-btn-' + (props.kind || 'primary') + (props.full ? ' lv-full' : '') + (props.small ? ' lv-small' : '') + (props.className ? ' ' + props.className : '');
  if (props.href) return React.createElement('a', { href: props.href, target: props.target, rel: 'noopener', className: cls }, props.children);
  return React.createElement('button', { type: props.type || 'button', className: cls, disabled: props.disabled, onClick: props.onClick }, props.children);
}

function FieldV(props) {
  var f = _uS(false);
  return React.createElement('label', { className: 'lv-field' + (f[0] ? ' focus' : '') + (props.value ? ' filled' : '') },
    React.createElement('span', { className: 'lv-field-label' }, props.label),
    React.createElement('input', {
      type: props.type || 'text', value: props.value, placeholder: props.placeholder,
      autoFocus: props.autoFocus, inputMode: props.inputMode,
      onFocus: function() { f[1](true); }, onBlur: function() { f[1](false); },
      onChange: function(e) { props.onChange(e.target.value); }
    })
  );
}

function SheetV(props) {
  var entered = _uS(false);
  _uE(function() { requestAnimationFrame(function() { entered[1](true); }); }, []);
  _uE(function() {
    var fn = function(e) { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', fn);
    return function() { window.removeEventListener('keydown', fn); };
  }, []);
  return React.createElement('div', {
    className: 'lv-overlay' + (entered[0] ? ' in' : ''),
    onClick: function(e) { if (e.target === e.currentTarget) props.onClose(); }
  },
    React.createElement('div', { className: 'lv-sheet' + (props.wide ? ' wide' : '') },
      React.createElement('div', { className: 'lv-sheet-head' },
        React.createElement('h3', null, props.title),
        React.createElement('button', { className: 'lv-x', onClick: props.onClose, 'aria-label': 'Cerrar' }, '\u2715')
      ),
      React.createElement('div', { className: 'lv-sheet-body' }, props.children)
    )
  );
}

// Premium month-view calendar. Keeps the old DateStripV API:
// { value: 'YYYY-MM-DD' | null, onChange(ds), dates?: ['YYYY-MM-DD', ...] }
// Only days present in `dates` are selectable; the rest render dimmed.
function DateStripV(props) {
  var days = _uM(function() {
    if (props.dates && props.dates.length) return props.dates;
    var out = [], d = todayStrV();
    for (var i = 0; out.length < 21 && i < 30; i++) {
      if (isOpenDayV(d)) out.push(d);
      d = addDaysV(d, 1);
    }
    return out;
  }, [props.dates]);

  var availSet = _uM(function() {
    var s = {};
    for (var i = 0; i < days.length; i++) s[days[i]] = true;
    return s;
  }, [days]);

  // Months spanned by the available range, as { y, m } pairs.
  var months = _uM(function() {
    if (!days.length) return [];
    var out = [];
    var first = fromDateStrV(days[0]);
    var last  = fromDateStrV(days[days.length - 1]);
    var cur = new Date(first.getFullYear(), first.getMonth(), 1);
    var end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cur <= end) {
      out.push({ y: cur.getFullYear(), m: cur.getMonth() });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }, [days]);

  var mi  = _uS(0);  // visible month index
  var dir = _uS(1);  // 1 = forward slide, -1 = back (for the transition)

  // Follow the selected date when it lands in another month (e.g. default pick).
  _uE(function() {
    if (!props.value || !months.length) return;
    var d = fromDateStrV(props.value);
    for (var i = 0; i < months.length; i++) {
      if (months[i].y === d.getFullYear() && months[i].m === d.getMonth()) { mi[1](i); break; }
    }
  }, [props.value, months.length]);

  if (!months.length) return null;
  var safeMi = Math.min(mi[0], months.length - 1);
  var mo = months[safeMi];
  var nDays = new Date(mo.y, mo.m + 1, 0).getDate();
  var lead = (new Date(mo.y, mo.m, 1).getDay() + 6) % 7; // Monday-first offset
  var today = todayStrV();

  var cells = [];
  for (var p = 0; p < lead; p++) cells.push(null);
  for (var d2 = 1; d2 <= nDays; d2++) cells.push(toDateStrV(new Date(mo.y, mo.m, d2)));

  function chevron(dirPath) {
    return React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' },
      React.createElement('path', { d: dirPath, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
    );
  }

  return React.createElement('div', { className: 'lv-cal' },
    React.createElement('div', { className: 'lv-cal-head' },
      React.createElement('button', {
        className: 'lv-cal-nav', disabled: safeMi === 0, 'aria-label': 'Mes anterior',
        onClick: function() { dir[1](-1); mi[1](safeMi - 1); }
      }, chevron('M15 19l-7-7 7-7')),
      React.createElement('div', { className: 'lv-cal-title', key: 'm' + safeMi },
        React.createElement('em', null, MONTHS_V[mo.m]),
        React.createElement('span', null, mo.y)
      ),
      React.createElement('button', {
        className: 'lv-cal-nav', disabled: safeMi >= months.length - 1, 'aria-label': 'Mes siguiente',
        onClick: function() { dir[1](1); mi[1](safeMi + 1); }
      }, chevron('M9 5l7 7-7 7'))
    ),
    React.createElement('div', { className: 'lv-cal-dows' },
      ['lun','mar','mié','jue','vie','sáb','dom'].map(function(d3) {
        return React.createElement('span', { key: d3 }, d3);
      })
    ),
    React.createElement('div', { className: 'lv-cal-grid ' + (dir[0] > 0 ? 'fwd' : 'back'), key: 'g' + safeMi },
      cells.map(function(ds, i) {
        if (!ds) return React.createElement('span', { key: 'pad' + i, className: 'lv-cal-cell pad' });
        var av = !!availSet[ds];
        var sel = props.value === ds;
        return React.createElement('button', {
          key: ds,
          className: 'lv-cal-cell' + (av ? ' av' : '') + (sel ? ' sel' : '') + (ds === today ? ' today' : ''),
          disabled: !av,
          style: { animationDelay: (i * 12) + 'ms' },
          onClick: function() { props.onChange(ds); }
        },
          React.createElement('span', { className: 'lv-cal-num' }, fromDateStrV(ds).getDate()),
          av && React.createElement('span', { className: 'lv-cal-dot' })
        );
      })
    )
  );
}

function SlotGridV(props) {
  // Accepts either an array of strings ['09:00', '09:30', ...] OR an array of
  // { time, staffId? } objects. Strings get normalized into { time } objects.
  var raw = props.slots || [];
  var slots = raw.map(function(s) { return typeof s === 'string' ? { time: s } : s; });
  var value = props.value, onChange = props.onChange;
  if (props.loading) {
    return React.createElement('div', { className: 'lv-slotarea' },
      React.createElement('div', { className: 'lv-skel-row' },
        [0,1,2,3,4,5].map(function(i) {
          return React.createElement('span', { key: i, className: 'lv-skel', style: { animationDelay: (i * 90) + 'ms' } });
        })
      )
    );
  }
  if (!slots.length) {
    return React.createElement('div', { className: 'lv-empty-slots' },
      React.createElement('p', null, 'No hay horarios este d\u00eda'),
      React.createElement('span', null, 'Prueba otra fecha \uD83C\uDF37')
    );
  }
  var am = slots.filter(function(s) { return toMinV(s.time) < 720; });
  var pm = slots.filter(function(s) { return toMinV(s.time) >= 720; });
  function Group(p) {
    if (!p.list.length) return null;
    return React.createElement('div', { className: 'lv-slotgroup' },
      React.createElement('div', { className: 'lv-slotdivider' },
        React.createElement('span', null, p.icon + ' ' + p.label)
      ),
      React.createElement('div', { className: 'lv-slots' },
        p.list.map(function(slot, i) {
          var sel = value && value.time === slot.time;
          var staff = slot.staffId ? staffOfV(slot.staffId) : null;
          return React.createElement('button', {
            key: slot.time, className: 'lv-slot' + (sel ? ' sel' : ''),
            style: { animationDelay: (i * 30) + 'ms' },
            onClick: function() { onChange(slot); }
          },
            React.createElement('span', { className: 'lv-slot-time' }, fmtTimeV(slot.time)),
            staff && React.createElement('span', { className: 'lv-slot-staff' }, 'con ' + staff.name)
          );
        })
      )
    );
  }
  return React.createElement('div', { className: 'lv-slotarea' },
    React.createElement('div', { className: 'lv-slot-counter' },
      React.createElement('span', { className: 'lv-slot-pulse' }),
      slots.length + (slots.length === 1 ? ' horario disponible' : ' horarios disponibles')
    ),
    React.createElement(Group, { label: 'Ma\u00f1ana', list: am, icon: '\u2600\uFE0F' }),
    React.createElement(Group, { label: 'Tarde', list: pm, icon: '\uD83C\uDF19' })
  );
}

function ApptCardV(props) {
  var appt = props.appt, s = svcV(appt.serviceId), st = staffOfV(appt.staffId);
  return React.createElement('div', { className: 'lv-apptcard' + (props.compact ? ' compact' : '') },
    React.createElement('div', { className: 'lv-apptcard-top' },
      React.createElement('div', null,
        React.createElement('strong', null, s.name),
        React.createElement('span', { className: 'lv-apptcard-when' },
          fmtDateShortV(appt.date) + ' \u00b7 ' + fmtTimeV(appt.time) + ' \u00b7 con ' + st.name)
      ),
      React.createElement(BadgeV, { status: appt.status })
    ),
    React.createElement('div', { className: 'lv-apptcard-meta' },
      React.createElement('span', null, 'Folio ' + appt.folio),
      React.createElement('span', null, fmtMoneyV(s.price) + ' \u00b7 anticipo ' + fmtMoneyV(DEPOSIT_V2) +
        (appt.payMethod === 'card' ? ' (tarjeta)' : ' (transferencia)'))
    ),
    props.children
  );
}

// Botón "agregar a calendario" según el dispositivo: iPhone/iPad descarga un
// .ics (Calendario de Apple); Android y desktop abren Google Calendar.
function AddToCalendarBtnV(props) {
  var b = props.booking;
  var label = props.children || '+ Calendario';
  if (isIOSDeviceV()) {
    return React.createElement(GlassBtn, {
      kind: props.kind || 'glass', small: props.small, full: props.full,
      onClick: function() { downloadBookingICSV(b); }
    }, label);
  }
  return React.createElement(GlassBtn, {
    kind: props.kind || 'glass', small: props.small, full: props.full,
    href: googleCalUrlForBookingV(b), target: '_blank'
  }, label);
}

function ToastV(props) {
  if (!props.msg) return null;
  return React.createElement('div', { className: 'lv-toast', key: props.msg.id }, props.msg.text);
}

// Ticking countdown. Re-renders every second until `targetMs` passes. Calls
// onExpire once when it crosses zero. Output is just the M:SS string; wrap it
// in whatever element you need.
function CountdownV(props) {
  var now = _uS(Date.now());
  _uE(function() {
    var id = setInterval(function() {
      var t = Date.now();
      now[1](t);
      if (t >= props.targetMs && props.onExpire) {
        clearInterval(id);
        props.onExpire();
      }
    }, 1000);
    return function() { clearInterval(id); };
  }, [props.targetMs]);
  var remaining = props.targetMs - now[0];
  return fmtCountdownV(remaining);
}

Object.assign(window, {
  useReveal, PageTransition, BadgeV, AvatarV, GlassBtn, FieldV, SheetV,
  DateStripV, SlotGridV, ApptCardV, ToastV, CountdownV, AddToCalendarBtnV,
});
