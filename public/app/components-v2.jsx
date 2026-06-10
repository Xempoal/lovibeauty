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

function DateStripV(props) {
  var days = _uM(function() {
    var out = [], d = todayStrV();
    for (var i = 0; out.length < 21 && i < 30; i++) {
      if (isOpenDayV(d)) out.push(d);
      d = addDaysV(d, 1);
    }
    return out;
  }, []);
  return React.createElement('div', { className: 'lv-datestrip' },
    days.map(function(ds, i) {
      var date = fromDateStrV(ds);
      return React.createElement('button', {
        key: ds, className: 'lv-daycard' + (props.value === ds ? ' sel' : ''),
        style: { animationDelay: (i * 40) + 'ms' },
        onClick: function() { props.onChange(ds); }
      },
        React.createElement('span', { className: 'lv-day-dow' }, DOW_SHORT_V[date.getDay()]),
        React.createElement('span', { className: 'lv-day-num' }, date.getDate()),
        React.createElement('span', { className: 'lv-day-mon' }, MONTHS_V[date.getMonth()].slice(0,3))
      );
    })
  );
}

function SlotGridV(props) {
  var slots = props.slots, value = props.value, onChange = props.onChange;
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
      React.createElement('span', { className: 'lv-slotlabel' }, p.icon + ' ' + p.label),
      React.createElement('div', { className: 'lv-slots' },
        p.list.map(function(slot, i) {
          var sel = value && value.time === slot.time;
          return React.createElement('button', {
            key: slot.time, className: 'lv-slot' + (sel ? ' sel' : ''),
            style: { animationDelay: (i * 30) + 'ms' },
            onClick: function() { onChange(slot); }
          },
            React.createElement('span', { className: 'lv-slot-time' }, fmtTimeV(slot.time)),
            React.createElement('span', { className: 'lv-slot-staff' }, 'con ' + staffOfV(slot.staffId).name)
          );
        })
      )
    );
  }
  return React.createElement('div', { className: 'lv-slotarea' },
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

function ToastV(props) {
  if (!props.msg) return null;
  return React.createElement('div', { className: 'lv-toast', key: props.msg.id }, props.msg.text);
}

Object.assign(window, {
  useReveal, PageTransition, BadgeV, AvatarV, GlassBtn, FieldV, SheetV,
  DateStripV, SlotGridV, ApptCardV, ToastV,
});
