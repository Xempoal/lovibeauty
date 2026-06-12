// LoviBeauty v2 — store actualizado: staff auto-asignado por disponibilidad
window._uS = React.useState;
window._uE = React.useEffect;
window._uR = React.useRef;
window._uM = React.useMemo;
window._uC = React.useCallback;
const _uS = window._uS, _uE = window._uE, _uR = window._uR, _uM = window._uM, _uC = window._uC;

const CATEGORIES_V2 = [
  { id: 'unas',     name: 'Uñas',     desc: 'Acrílico, gelish y retiros',          img: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1000&q=80', services: ['acrilico', 'gelish', 'retiro-acrilico', 'retiro-polish'] },
  { id: 'makeup',   name: 'Makeup',   desc: 'Social, eventos y novias',            img: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1000&q=80', services: ['makeup-social', 'makeup-novia'] },
  { id: 'pedispa',  name: 'Pedi spa', desc: 'Exfoliación, masaje y esmaltado',     img: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1000&q=80', services: ['pedispa'] },
  { id: 'keratina', name: 'Keratina', desc: 'Alaciado y nutrición profunda',       img: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1000&q=80', services: ['keratina'] },
];

const SPECIAL_CAT_V2 = {
  id: 'especiales', name: 'Servicios especiales', desc: 'Detalles exclusivos del estudio',
  img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=1200&q=80',
  services: ['lifting-pestanas', 'tinte-cejas', 'paquete-novia'],
};

const SERVICES_V2 = [
  { id: 'acrilico',        name: 'Uñas acrílicas',      desc: 'Aplicación completa con diseño a tu gusto', price: 420, dur: 120,
    img: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80', staffIds: ['lovi','karla'] },
  { id: 'gelish',          name: 'Manicure gelish',      desc: 'Esmaltado semipermanente que dura semanas',  price: 280, dur: 60,
    img: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80', staffIds: ['lovi','karla'] },
  { id: 'retiro-acrilico', name: 'Retiro de acrílico',   desc: 'Retiro cuidadoso sin dañar tu uña natural', price: 150, dur: 45,
    img: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&q=80', staffIds: ['lovi','karla'] },
  { id: 'retiro-polish',   name: 'Retiro de polish',     desc: 'Retiro de gelish o semipermanente',         price: 100, dur: 30,
    img: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&q=80', staffIds: ['lovi','karla'] },
  { id: 'makeup-social',   name: 'Makeup social',        desc: 'Maquillaje para evento de día o noche',     price: 550, dur: 75,
    img: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80', staffIds: ['fer'] },
  { id: 'makeup-novia',    name: 'Makeup de novia',      desc: 'Prueba previa + look completo con pestañas', price: 950, dur: 120,
    img: 'https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=800&q=80', staffIds: ['fer'] },
  { id: 'pedispa',         name: 'Pedi spa',             desc: 'Exfoliación, masaje relajante y esmaltado',  price: 380, dur: 75,
    img: 'https://images.unsplash.com/photo-1560750588-73b555dce5d6?w=800&q=80', staffIds: ['karla','fer'] },
  { id: 'keratina',        name: 'Keratina',             desc: 'Alaciado con nutrición profunda',            price: 900, dur: 150,
    img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80', staffIds: ['lovi'] },
  { id: 'lifting-pestanas',name: 'Lifting de pestañas',  desc: 'Curvatura natural sin extensiones',          price: 480, dur: 60,
    img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80', staffIds: ['fer'] },
  { id: 'tinte-cejas',     name: 'Diseño y tinte de cejas', desc: 'Forma, tinte y depilación',              price: 320, dur: 45,
    img: 'https://images.unsplash.com/photo-1583241475880-083f84372725?w=800&q=80', staffIds: ['fer'] },
  { id: 'paquete-novia',   name: 'Paquete novia completo', desc: 'Makeup, uñas y peinado para tu gran día', price: 2400, dur: 240,
    img: 'https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=800&q=80', staffIds: ['lovi','fer'] },
];

const STAFF_V2 = [
  { id: 'lovi',  name: 'Lovi',     role: 'Fundadora', hue: 340 },
  { id: 'karla', name: 'Karla',    role: 'Nail artist', hue: 20 },
  { id: 'fer',   name: 'Fernanda', role: 'Makeup artist', hue: 280 },
];

const HOURS_V2 = { 0: null, 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 18] };
const DEPOSIT_V2 = 100;
const WHATS_NUM_V2 = '5215522334455';
const BANK_V2 = { banco: 'BBVA', titular: 'LoviBeauty Studio', clabe: '0121 8000 1234 5678 90', tarjeta: '4152 3134 5678 9012' };
const ADMIN_EMAIL_V2 = 'admin@lovibeauty.mx';
const ADMIN_PASS_V2 = 'lovi2026';

const pad2v = (n) => String(n).padStart(2, '0');
const toDateStrV = (d) => d.getFullYear() + '-' + pad2v(d.getMonth() + 1) + '-' + pad2v(d.getDate());
const fromDateStrV = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStrV = () => toDateStrV(new Date());
const addDaysV = (s, n) => { const d = fromDateStrV(s); d.setDate(d.getDate() + n); return toDateStrV(d); };
const toMinV = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMMV = (min) => pad2v(Math.floor(min / 60)) + ':' + pad2v(min % 60);
const DOW_V = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DOW_SHORT_V = ['dom','lun','mar','mié','jue','vie','sáb'];
const MONTHS_V = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fmtDateV = (s) => { const d = fromDateStrV(s); return DOW_V[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS_V[d.getMonth()]; };
const fmtDateShortV = (s) => { const d = fromDateStrV(s); return d.getDate() + ' ' + MONTHS_V[d.getMonth()].slice(0,3); };
const fmtDowV = (s) => { const d = fromDateStrV(s); return DOW_SHORT_V[d.getDay()]; };
const fmtTimeV = (t) => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + pad2v(m) + ' ' + ap; };
const fmtMoneyV = (n) => '$' + n.toLocaleString('es-MX');
const isOpenDayV = (ds) => !!HOURS_V2[fromDateStrV(ds).getDay()];

const DB_KEY_V = 'lovibeauty_v2';
const SES_KEY_V = 'lovibeauty_ses_v2';
const uidV = () => Math.random().toString(36).slice(2, 9);
const mkFolioV = (db) => 'LB-' + String(1040 + db.appointments.length + 1);

function seedDBV() {
  const t = todayStrV();
  const users = [{ id: 'u-maria', name: 'María García', phone: '55 1234 5678', email: 'maria@demo.mx', password: 'demo123' }];
  let n = 1000;
  const mk = (sId, stId, date, time, status, pay, cName, cPhone, uId) => {
    const s = SERVICES_V2.find(x => x.id === sId);
    return { id: uidV(), folio: 'LB-' + (++n), serviceId: sId, staffId: stId, date, time, dur: s.dur, price: s.price,
      clientName: cName, clientPhone: cPhone, userId: uId || null, payMethod: pay, status, createdAt: Date.now() };
  };
  const appointments = [
    mk('gelish','karla',addDaysV(t,-21),'11:00','confirmada','card','María García','55 1234 5678','u-maria'),
    mk('pedispa','fer',addDaysV(t,-9),'16:00','confirmada','transfer','María García','55 1234 5678','u-maria'),
    mk('acrilico','lovi',addDaysV(t,-3),'10:00','confirmada','card','Sofía Hernández','55 8765 4321'),
    mk('retiro-acrilico','karla',t,'10:00','confirmada','card','Ana Torres','55 4433 2211'),
    mk('makeup-social','fer',t,'12:30','pendiente','transfer','Lucía Pérez','55 9988 7766'),
    mk('keratina','lovi',t,'15:00','confirmada','transfer','Valeria Ruiz','55 1122 3344'),
    mk('acrilico','lovi',addDaysV(t,1),'11:00','pendiente','transfer','Sofía Hernández','55 8765 4321'),
    mk('gelish','karla',addDaysV(t,1),'13:00','confirmada','card','María García','55 1234 5678','u-maria'),
    mk('pedispa','fer',addDaysV(t,2),'17:00','confirmada','card','Daniela López','55 6677 8899'),
    mk('makeup-novia','fer',addDaysV(t,3),'09:30','cancelacion','transfer','Regina Mota','55 3344 5566'),
    mk('retiro-polish','karla',addDaysV(t,4),'12:00','confirmada','card','Paola Ríos','55 2211 0099'),
  ];
  const blocks = [
    { id: uidV(), date: addDaysV(t,1), start:'14:00', end:'15:00', staffId:'all', reason:'Comida' },
    { id: uidV(), date: addDaysV(t,5), start:'09:00', end:'20:00', staffId:'lovi', reason:'Día personal' },
  ];
  return { users, appointments, blocks };
}

function loadDBV() {
  try { const r = localStorage.getItem(DB_KEY_V); if (r) return JSON.parse(r); } catch(e){}
  const db = seedDBV(); try { localStorage.setItem(DB_KEY_V, JSON.stringify(db)); } catch(e){} return db;
}
const saveDBV = (db) => { try { localStorage.setItem(DB_KEY_V, JSON.stringify(db)); } catch(e){} };
const loadSessionV = () => { try { return JSON.parse(localStorage.getItem(SES_KEY_V)); } catch(e){ return null; } };
const saveSessionV = (s) => { try { s ? localStorage.setItem(SES_KEY_V, JSON.stringify(s)) : localStorage.removeItem(SES_KEY_V); } catch(e){} };

const ACTIVE_V = (a) => a.status !== 'cancelada';

function getSlotsV(db, staffId, dateStr, dur) {
  const d = fromDateStrV(dateStr);
  const hours = HOURS_V2[d.getDay()];
  if (!hours) return [];
  const [open, close] = hours;
  const appts = db.appointments.filter(a => ACTIVE_V(a) && a.staffId === staffId && a.date === dateStr);
  const blocks = db.blocks.filter(b => b.date === dateStr && (b.staffId === 'all' || b.staffId === staffId));
  const now = new Date();
  const isToday = dateStr === toDateStrV(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (let m = open * 60; m + dur <= close * 60; m += 30) {
    if (isToday && m <= nowMin) continue;
    const end = m + dur;
    const clash = appts.some(a => m < toMinV(a.time) + a.dur && end > toMinV(a.time)) ||
                  blocks.some(b => m < toMinV(b.end) && end > toMinV(b.start));
    if (!clash) out.push(toHHMMV(m));
  }
  return out;
}

// Auto-asignar staff: por cada slot devuelve { time, staffId }
function getAutoSlots(db, service, dateStr) {
  const staffIds = service.staffIds;
  const d = fromDateStrV(dateStr);
  const hours = HOURS_V2[d.getDay()];
  if (!hours) return [];
  const [open, close] = hours;
  const now = new Date();
  const isToday = dateStr === toDateStrV(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const map = new Map();
  for (let m = open * 60; m + service.dur <= close * 60; m += 30) {
    if (isToday && m <= nowMin) continue;
    const t = toHHMMV(m);
    for (const sid of staffIds) {
      if (map.has(t)) continue;
      const slots = getSlotsV(db, sid, dateStr, service.dur);
      if (slots.includes(t)) map.set(t, { time: t, staffId: sid });
    }
  }
  return Array.from(map.values()).sort((a,b) => toMinV(a.time) - toMinV(b.time));
}

const STATUS_META_V = {
  pendiente:   { label: 'Anticipo pendiente',     color: '#B8860B', bg: '#FBF3DC' },
  confirmada:  { label: 'Confirmada',             color: '#2E7D52', bg: '#E3F2E9' },
  cancelacion: { label: 'Cancelación solicitada', color: '#C0392B', bg: '#FBE5E1' },
  cancelada:   { label: 'Cancelada',              color: '#8A8A8A', bg: '#EFEDED' },
};

function calDatesV(appt) {
  const d = fromDateStrV(appt.date);
  const [h, m] = appt.time.split(':').map(Number);
  const start = new Date(d); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + appt.dur * 60000);
  const f = (x) => x.getFullYear() + pad2v(x.getMonth()+1) + pad2v(x.getDate()) + 'T' + pad2v(x.getHours()) + pad2v(x.getMinutes()) + '00';
  return { start: f(start), end: f(end) };
}
function googleCalUrlV(appt) {
  const s = SERVICES_V2.find(x => x.id === appt.serviceId);
  const { start, end } = calDatesV(appt);
  const p = new URLSearchParams({ action:'TEMPLATE', text:'LoviBeauty — '+s.name, dates:start+'/'+end,
    details:'Cita en LoviBeauty Studio. Folio '+appt.folio+'.', location:'LoviBeauty Studio' });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function downloadICSV(appt) {
  const s = SERVICES_V2.find(x => x.id === appt.serviceId);
  const { start, end } = calDatesV(appt);
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LoviBeauty//ES','BEGIN:VEVENT',
    'UID:'+appt.folio+'@lovibeauty.mx','DTSTART:'+start,'DTEND:'+end,
    'SUMMARY:LoviBeauty — '+s.name,'DESCRIPTION:Folio '+appt.folio,
    'LOCATION:LoviBeauty Studio','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics],{type:'text/calendar'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'LoviBeauty-'+appt.folio+'.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function whatsAppUrlV(appt) {
  const s = SERVICES_V2.find(x => x.id === appt.serviceId);
  const msg = 'Hola LoviBeauty 💕 Te envío mi comprobante del anticipo de $100.\nFolio: '+appt.folio+
    '\nServicio: '+s.name+'\nFecha: '+fmtDateV(appt.date)+' a las '+fmtTimeV(appt.time)+'\nNombre: '+appt.clientName;
  return 'https://wa.me/'+WHATS_NUM_V2+'?text='+encodeURIComponent(msg);
}

const svcV = (id) => SERVICES_V2.find(s => s.id === id);
const staffOfV = (id) => STAFF_V2.find(s => s.id === id);

// ─── Supabase-aware helpers (used by the real booking flow) ───
// Compute the list of free start times for a given date, given the busy ranges
// returned by the `get_availability` RPC, the business hours map, and the
// service option's duration. Step: 30 minutes.
//
//   busyRanges:    [{ busy_start: 'HH:MM:SS', busy_end: 'HH:MM:SS', source }]
//   businessHours: { 0..6: ['HH:MM','HH:MM'] | null }
//   duration:      minutes (number)
//   dateStr:       'YYYY-MM-DD'  (so we can skip past slots when it's today)
function computeFreeSlotsV(busyRanges, businessHours, duration, dateStr) {
  const d = fromDateStrV(dateStr);
  const hours = businessHours[d.getDay()];
  if (!hours) return [];
  const [open, close] = hours.map(toMinV);
  const ranges = (busyRanges || []).map(b => ({
    start: toMinV((b.busy_start || '').slice(0, 5)),
    end:   toMinV((b.busy_end   || '').slice(0, 5)),
  }));
  const now = new Date();
  const isToday = dateStr === toDateStrV(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (let m = open; m + duration <= close; m += 30) {
    if (isToday && m <= nowMin) continue;
    const end = m + duration;
    const clash = ranges.some(r => m < r.end && end > r.start);
    if (!clash) out.push(toHHMMV(m));
  }
  return out;
}

// Build the list of next N open dates given the business hours map.
function nextOpenDatesV(businessHours, n) {
  n = n || 14;
  const out = [];
  let d = todayStrV();
  for (let i = 0; out.length < n && i < n * 3; i++) {
    const dow = fromDateStrV(d).getDay();
    if (businessHours[dow]) out.push(d);
    d = addDaysV(d, 1);
  }
  return out;
}

// WhatsApp message used when the customer sends the transfer receipt.
function buildWhatsMessageV(serviceOptionName, dateStr, time, customerName) {
  return 'Hola, reservé una cita de ' + serviceOptionName +
    ' para ' + fmtDateV(dateStr) +
    ' a las ' + fmtTimeV(time) + '.' +
    (customerName ? ' Soy ' + customerName + '.' : '') +
    ' Adjunto mi comprobante.';
}
function whatsBookingUrlV(serviceOptionName, dateStr, time, customerName) {
  return 'https://wa.me/' + WHATS_NUM_V2 +
    '?text=' + encodeURIComponent(buildWhatsMessageV(serviceOptionName, dateStr, time, customerName));
}

// ─── Agregar al calendario (reservas reales de Supabase) ───
// b: { booking_date, start_time, end_time, service_option_name }
// En iPhone/iPad se descarga un .ics (abre el Calendario de Apple); en
// Android/desktop se abre Google Calendar.
function isIOSDeviceV() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function bookingCalStampsV(b) {
  const d = b.booking_date.replace(/-/g, '');
  const s = (b.start_time || '').slice(0, 5).replace(':', '') + '00';
  const e = (b.end_time || b.start_time || '').slice(0, 5).replace(':', '') + '00';
  return { start: d + 'T' + s, end: d + 'T' + e };
}
function googleCalUrlForBookingV(b) {
  const t = bookingCalStampsV(b);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'LoviBeauty — ' + b.service_option_name,
    dates: t.start + '/' + t.end,
    details: 'Cita en LoviBeauty Studio.',
    location: 'LoviBeauty Studio',
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function downloadBookingICSV(b) {
  const t = bookingCalStampsV(b);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LoviBeauty//ES', 'BEGIN:VEVENT',
    'UID:' + (b.id || t.start) + '@lovibeauty.mx', 'DTSTART:' + t.start, 'DTEND:' + t.end,
    'SUMMARY:LoviBeauty — ' + b.service_option_name, 'DESCRIPTION:Cita en LoviBeauty Studio.',
    'LOCATION:LoviBeauty Studio', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'LoviBeauty-cita.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Format a millisecond duration as M:SS (minutes:seconds).
function fmtCountdownV(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m + ':' + pad2v(s);
}

Object.assign(window, {
  SERVICES_V2, CATEGORIES_V2, SPECIAL_CAT_V2, STAFF_V2, HOURS_V2, DEPOSIT_V2, BANK_V2, WHATS_NUM_V2, ADMIN_EMAIL_V2, ADMIN_PASS_V2,
  pad2v, toDateStrV, fromDateStrV, todayStrV, addDaysV, toMinV, toHHMMV, fmtDateV, fmtDateShortV, fmtDowV, fmtTimeV, fmtMoneyV,
  DOW_V, DOW_SHORT_V, MONTHS_V, isOpenDayV,
  loadDBV, saveDBV, loadSessionV, saveSessionV, uidV, mkFolioV,
  getSlotsV, getAutoSlots, STATUS_META_V, googleCalUrlV, downloadICSV, whatsAppUrlV, svcV, staffOfV,
  computeFreeSlotsV, nextOpenDatesV, whatsBookingUrlV, fmtCountdownV,
  isIOSDeviceV, googleCalUrlForBookingV, downloadBookingICSV,
});
