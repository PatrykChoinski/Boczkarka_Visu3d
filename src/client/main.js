// Strona Visu3D boczkarki: tryb offline (symulator cyklu jak w PLC) i online (wartosci z PLC przez OPC UA,
// serwer VizuApp; adres IP serwera OPC UA wpisywany na stronie - POST /api/connection). Panel obslugi: logowanie
// (poziomy jak w auth.js), tryb reczny (jog / dojazd / wrzeciono) i parametry serwisowe - online przez PLC,
// offline na symulatorze.
import { EdgeView } from './view3d.js';
import { installIcons, icon } from './icons.js';
import {
  DEFAULTS, EDGE_STEPS, STEP, MODES, LEVEL_NAMES, PLC_WRITES, SERVICE_PARAMS, SERVICE_ITEMS, checkParam, fromPlc, endpointFromHost,
} from '../shared/config.js';
import { EdgeSimulator } from '../shared/simulator.js';
import {
  PROFILE_TYPE, PROFILE_NAMES, defaultRecipes, generatePasses, profileFromValues, setProfileDefaults, VALIDATION_TEXT,
} from '../shared/edgeprofile.js';
import { edgeSection, cutState } from '../shared/edgeshape.js';
import { alarmText, activeFromValues } from '../shared/alarms.js';

installIcons();
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—');
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bez pamieci przegladarki */ } },
};

// token logowania (POST /api/login) - do konca sesji przegladarki
const session = {
  get token() { try { return sessionStorage.getItem('vizu.token'); } catch { return null; } },
  set token(t) { try { if (t) sessionStorage.setItem('vizu.token', t); else sessionStorage.removeItem('vizu.token'); } catch { /* bez pamieci */ } },
};
// wersja statyczna (GitHub Pages): logowanie demonstracyjne bez hasla - tylko pokazuje i ukrywa funkcje jak na maszynie
const DEMO_LEVELS = { Operator: 1, Serwis: 2, Admin: 3 };
const demo = {
  get user() { try { return sessionStorage.getItem('vizu.demoUser') || ''; } catch { return ''; } },
  set user(u) { try { if (u) sessionStorage.setItem('vizu.demoUser', u); else sessionStorage.removeItem('vizu.demoUser'); } catch { /* bez pamieci */ } },
};
const post = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function getJson(url, opts = {}) {
  const t = session.token;
  const r = await fetch(url, t ? { ...opts, headers: { ...(opts.headers || {}), authorization: `Bearer ${t}` } } : opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status}`);
  return body;
}

async function loadConfig() {
  try {
    return await getJson('api/config');
  } catch {
    // strona otwarta bez serwera - wartosci domyslne, tylko offline
    return { plc: false, static: true, machine: DEFAULTS.machine, shape: DEFAULTS.shape, offline: DEFAULTS.offline, steps: EDGE_STEPS };
  }
}

const cfg = await loadConfig();
cfg.machine = { ...DEFAULTS.machine, ...cfg.machine };
cfg.shape = { ...DEFAULTS.shape, ...cfg.shape };
cfg.offline = { ...DEFAULTS.offline, ...cfg.offline };
const view = new EdgeView($('view'), cfg);
const sim = new EdgeSimulator({ ...cfg.offline, limits: { xMin: cfg.machine.travelX[0], xMax: cfg.machine.travelX[1] } });

const app = {
  mode: cfg.plc ? store.get('vizu.mode', 'online') : 'offline',
  values: {},			// wartosci z PLC (klucze VARIABLES)
  hmi: {},				// zmienne ogladane przez strone (parametry serwisowe, "GVL.zmienna" -> wartosc PLC)
  user: '',
  connected: false,
  status: cfg.plc ? 'Łączenie…' : 'Serwer bez PLC – tylko offline',
  level: 0,
  freshStone: false,	// online: "Nowy kamien" - bez obrobki do startu nastepnego cyklu
  follow: store.get('vizu.follow', '1') === '1',	// kamera za glowica (domyslnie, jak na filmach)
  tab: store.get('vizu.tab', 'auto'),	// ekran z lewego paska
};

// ---------------------------------------------------------------- receptura (offline)
const recipes = defaultRecipes();
const FIELDS = ['xStart', 'xEnd', 'overtravel', 'feed', 'spindleFrequency', 'repeats', 'angle', 'angleStart', 'angleEnd', 'angleStep'];
let form = { ...recipes[4], xStart: 200, xEnd: 1600 };

function fillForm() {
  $('kind').value = form.kind;
  for (const f of FIELDS) $(f).value = form[f];
  $('bothDirections').checked = form.bothDirections;
  const round = [PROFILE_TYPE.TopQuarterRound, PROFILE_TYPE.BottomQuarterRound, PROFILE_TYPE.HalfRound].includes(form.kind);
  const chamfer = [PROFILE_TYPE.TopChamfer, PROFILE_TYPE.BottomChamfer].includes(form.kind);
  document.querySelectorAll('.round').forEach((e) => e.classList.toggle('hidden', !round));
  document.querySelectorAll('.chamfer').forEach((e) => e.classList.toggle('hidden', !chamfer));
}

function readForm() {
  const f = { ...form, kind: Number($('kind').value), bothDirections: $('bothDirections').checked };
  for (const k of FIELDS) f[k] = Number($(k).value);
  form = f;
}

$('recipe').innerHTML = recipes.map((r, i) => `<option value="${i}">${i + 1}. ${r.name}</option>`).join('');
$('recipe').value = '4';
$('kind').innerHTML = Object.entries(PROFILE_NAMES).filter(([k]) => Number(k) !== PROFILE_TYPE.Custom)
  .map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('recipe').addEventListener('change', () => {
  form = { ...recipes[Number($('recipe').value)], xStart: form.xStart, xEnd: form.xEnd };
  fillForm();
});
$('kind').addEventListener('change', () => { readForm(); form = setProfileDefaults(form, form.kind); fillForm(); });
for (const id of [...FIELDS, 'bothDirections']) $(id).addEventListener('change', readForm);
// obroty na biezaco: zmiana pola dziala od razu na symulator (takze w trakcie cyklu)
$('spindleFrequency').addEventListener('input', () => { readForm(); sim.setSpindleFrequency(form.spindleFrequency); });
fillForm();

$('simStart').addEventListener('click', () => {
  readForm();
  const ok = sim.start({ ...form });
  $('simMsg').textContent = ok || sim.step !== STEP.WaitForCommand ? '' : `Receptura: ${VALIDATION_TEXT[sim.error] ?? sim.error}`;
  $('simMsg').classList.toggle('err', !ok && sim.step === STEP.WaitForCommand);
});
$('simAck').addEventListener('click', () => { sim.acknowledge(); $('simMsg').textContent = ''; });

$('newStone').addEventListener('click', () => {
  if (app.mode === 'offline') {
    if ([STEP.WaitForStart, STEP.WaitForCommand].includes(sim.step)) { sim.passIndex = 0; sim.passes = []; sim.profile = null; }
  } else app.freshStone = true;
});

// ---------------------------------------------------------------- tryb i widoki
function setMode(mode) {
  if (mode === 'online' && !cfg.plc) mode = 'offline';
  app.mode = mode;
  store.set('vizu.mode', mode);
  document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('offlineCard').classList.toggle('hidden', mode !== 'offline');
  $('onlineCard').classList.toggle('hidden', mode !== 'online');
  $('speedBox').hidden = mode !== 'offline';
  $('connOpen').hidden = !cfg.plc || mode !== 'online';
  updateChip();
  applyAccess();
}
document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelector('#mode [data-mode="online"]').disabled = !cfg.plc;
document.querySelectorAll('#viewTools button').forEach((b) => b.addEventListener('click', () => {
  app.follow = b.dataset.view === 'follow';
  store.set('vizu.follow', app.follow ? '1' : '0');
  document.querySelectorAll('#viewTools button').forEach((x) => x.classList.toggle('active', x === b && app.follow));
  view.view(app.follow ? 'iso' : b.dataset.view, current().state.x || 0);
}));

// Ekrany z lewego paska (jak menu HMI): Automat, Reczny, Serwis - tytul panelu z ikona i nazwa
const TABS = { auto: ['auto', 'Automat'], service: ['wrench', 'Serwis – parametry'] };
function showTab(name) {
  const btn = document.querySelector(`#screens [data-tab="${name}"]`);
  if (!btn || btn.hidden) name = 'auto';
  app.tab = name;
  store.set('vizu.tab', name);
  document.querySelectorAll('#screens button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('#panel .tab').forEach((t) => { t.hidden = t.dataset.tab !== name; });
  $('panelTitle').innerHTML = `${icon(TABS[name][0])}<span>${TABS[name][1]}</span>`;
}
document.querySelectorAll('#screens button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// Okno Reczny (jak "Ruchy reczne" w pile): otwierane z paska, przesuwane za naglowek (mysz i dotyk),
// pozycja zapamietana w przegladarce; zamkniecie puszcza jog
const MAN_WIN_KEY = 'vizu.manWin';
function placeManWin(x, y) {
  const win = $('manWin');
  if (x === undefined) {
    try { ({ x, y } = JSON.parse(store.get(MAN_WIN_KEY, '{}'))); } catch { /* domyslne miejsce z CSS */ }
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  win.style.left = `${Math.min(Math.max(0, x), Math.max(0, window.innerWidth - win.offsetWidth))}px`;
  win.style.top = `${Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 40))}px`;
}
function showManWin(open) {
  if (!open) [...jogs.keys()].forEach(jogStop);
  $('manWin').hidden = !open;
  $('manOpen').classList.toggle('active', open);
  if (open) placeManWin();
}
{
  const win = $('manWin');
  const head = $('manHead');
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = win.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => { if (drag) placeManWin(e.clientX - drag.dx, e.clientY - drag.dy); });
  const end = () => {
    if (!drag) return;
    drag = null;
    store.set(MAN_WIN_KEY, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop }));
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  $('manOpen').addEventListener('click', () => showManWin(win.hidden));
  $('manClose').addEventListener('click', () => showManWin(false));
  window.addEventListener('resize', () => { if (!win.hidden) placeManWin(win.offsetLeft, win.offsetTop); });
}

// Okna polaczenia i alarmow (gorny pasek)
$('connOpen').addEventListener('click', () => { $('connWin').hidden = !$('connWin').hidden; if (!$('connWin').hidden) loadConnection(); });
$('connClose').addEventListener('click', () => { $('connWin').hidden = true; });
$('alarmOpen').addEventListener('click', () => { $('alarmWin').hidden = !$('alarmWin').hidden; loadAlarmHistory(); });
$('alarmClose').addEventListener('click', () => { $('alarmWin').hidden = true; });
// Historia alarmow (baza SQLite serwera, alarms.db): zakladka w oknie alarmow, odswiezana przy zmianie (SSE alarmsVersion)
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString('pl-PL') : '—');
async function loadAlarmHistory() {
  if ($('alarmWin').hidden || document.querySelector('[data-apage="history"]').hidden) return;
  if (cfg.static || !cfg.plc) {
    $('alarmHistInfo').textContent = 'Historia alarmów jest zapisywana w bazie serwera VizuApp (alarms.db) przy pracy z PLC.';
    $('alarmHist').innerHTML = '';
    return;
  }
  try {
    const h = await getJson('api/alarms?limit=200');
    $('alarmHistInfo').textContent = `Wpisów: ${h.total}, niepotwierdzonych: ${h.unacked}`;
    $('alarmHist').innerHTML = `<tr><th class="n">Nr</th><th>Alarm</th><th>Wystąpił</th><th>Ustąpił</th><th>Kwit.</th></tr>`
      + h.entries.map((e) => `<tr class="${e.off ? 'off' : 'on'}"><td class="n">${e.n}</td><td>${e.name ?? alarmText(e.n)}</td>`
        + `<td>${fmtTime(e.on)}</td><td>${e.off ? fmtTime(e.off) : 'aktywny'}</td><td>${e.ack ? '✓' : ''}</td></tr>`).join('');
  } catch (err) { $('alarmHistInfo').textContent = `Historia: ${err.message}`; }
}
document.querySelectorAll('#alarmTabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#alarmTabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('#alarmWin [data-apage]').forEach((p) => { p.hidden = p.dataset.apage !== b.dataset.atab; });
  loadAlarmHistory();
}));
$('alarmAck').addEventListener('click', async () => {
  try { await getJson('api/alarms/ack', post({})); } catch (err) { $('alarmHistInfo').textContent = err.message; }
  loadAlarmHistory();
});
$('alarmReset').addEventListener('click', () => (app.mode === 'offline' ? sim.acknowledge() : plcWrite('Alarms.Reset', true)));
// STOP / PAUZA na pasku: offline - symulator, online - PLC (bez logowania, jak przyciski na pulpicie)
$('barStop').addEventListener('click', () => (app.mode === 'offline' ? sim.stop() : plcWrite('EdgeProfile.Stop', true)));
$('barPause').addEventListener('click', () => (app.mode === 'offline' ? sim.pause() : plcWrite('EdgeProfile.Pause', true)));

function updateChip() {
  const chip = $('connChip');
  if (app.mode === 'offline') { chip.textContent = 'Symulacja offline'; chip.className = ''; return; }
  chip.textContent = app.status;
  chip.className = app.connected ? 'ok' : 'bad';
}

// ---------------------------------------------------------------- online: SSE i polaczenie
const cid = Math.random().toString(36).slice(2, 12);
function connectEvents() {
  if (!cfg.plc) return;
  const es = new EventSource(`api/events?cid=${cid}`);
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if ('status' in d) { app.status = d.status; app.connected = d.connected; updateChip(); refreshAccess(); }
    if ('alarmsVersion' in d) loadAlarmHistory();
    if (d.full) { app.values = { ...(d.values || {}) }; app.hmi = { ...(d.hmi || {}) }; } else {
      if (d.values) Object.assign(app.values, d.values);
      if (d.hmi) Object.assign(app.hmi, d.hmi);
    }
  };
  es.onerror = () => { app.connected = false; app.status = 'Brak połączenia z serwerem VizuApp'; updateChip(); };
}

async function loadConnection() {
  if (!cfg.plc) {
    $('connInfo').textContent = cfg.static ? 'Wersja bez serwera – dostępna tylko symulacja offline.' : 'Serwer uruchomiony bez PLC (--no-plc).';
    $('connForm').classList.add('hidden');
    return;
  }
  try {
    const c = await getJson('api/connection');
    const m = /^opc\.tcp:\/\/([^:/]+)(?::(\d+))?/.exec(c.endpoint || '');
    if (m) { $('plcHost').value = m[1]; $('plcPort').value = m[2] || 4840; }
    $('connInfo').textContent = `Adres: ${c.endpoint}${c.endpoint !== c.defaultEndpoint ? ` (domyślny ${c.defaultEndpoint})` : ''}`;
    $('pageUrls').textContent = c.urls?.length ? `Strona w sieci: ${c.urls.join('  ')}` : '';
  } catch (err) { $('connInfo').textContent = `Połączenie: ${err.message}`; }
}

async function setEndpoint(endpoint) {
  $('connInfo').classList.remove('err');
  try {
    const c = await getJson('api/connection', post({ endpoint }));
    $('connInfo').textContent = `Łączenie z ${c.endpoint}…`;
    app.values = {};
  } catch (err) {
    $('connInfo').textContent = err.message;
    $('connInfo').classList.add('err');
  }
}
$('connForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const host = $('plcHost').value.trim();
  if (!host) { $('connInfo').textContent = 'Wpisz adres IP serwera OPC UA (sterownika)'; $('connInfo').classList.add('err'); return; }
  setEndpoint(endpointFromHost(host, Number($('plcPort').value) || 4840));
});
$('connDefault').addEventListener('click', () => setEndpoint('').then(loadConnection));

// ---------------------------------------------------------------- logowanie i poziom dostepu
// Poziom z serwera (GET /api/plc): z logowania (users.json), bez logowania - panel lokalny Admin, z sieci Podglad
async function refreshAccess() {
  if (cfg.static) {
    app.level = DEMO_LEVELS[demo.user] ?? 0;
    app.user = demo.user;
  } else {
    try {
      const a = await getJson('api/plc');
      app.level = a.level;
      app.user = a.level > 0 ? a.user : '';
    } catch { app.level = 0; app.user = ''; }
  }
  applyAccess();
}

// Widocznosc sterowania: online wedlug poziomu (Operator - sterowanie i reczny, Serwis - parametry); offline
// (symulacja) - wszystko
function applyAccess() {
  const online = app.mode === 'online';
  const op = app.connected && app.level >= 1;
  $('plcControls').hidden = !op;
  $('plcModes').hidden = !op;
  $('autoFreqBox').hidden = !op;
  $('plcInfo').textContent = !app.connected ? '' : op ? '' : 'Sterowanie po zalogowaniu (Operator).';
  // Reczny od Operatora, Serwis tylko Serwis i Admin - w obu trybach
  $('manOpen').hidden = app.level < 1;
  if ($('manOpen').hidden && !$('manWin').hidden) showManWin(false);
  document.querySelector('#screens [data-tab="service"]').hidden = app.level < 2;
  showTab(app.tab);
  const loginOn = true;				// zawsze: Operator / Serwis / Admin
  const loggedIn = cfg.static ? Boolean(demo.user) : Boolean(session.token && app.level > 0);
  $('loginBtn').title = loggedIn ? 'Wyloguj' : 'Zaloguj';
  $('loginBtn').innerHTML = icon(loggedIn ? 'logout' : 'login');
  const lvl = LEVEL_NAMES[app.level];
  $('userChip').innerHTML = app.level > 0 ? (app.user === lvl ? `<b>${lvl}</b>` : `<b>${app.user}</b> · ${lvl}`) : loginOn ? 'Niezalogowany' : LEVEL_NAMES[0];
  $('manualInfo').textContent = online
    ? 'Online: jog i dojazdy w trybie Ręczny (przełącznik na ekranie Automat).'
    : 'Offline: osie symulatora, gdy automat stoi.';
  $('serviceInfo').textContent = online
    ? 'Parametry trwałe PLC – zapis po zmianie pola (zakres sprawdzany na stronie i w serwerze).'
    : 'Offline: parametry symulatora (te, które mają odpowiednik w trybie offline).';
  watchService();
}

// okno logowania: haslo niepotrzebne w wersji demonstracyjnej i dla konta bez hasla (bez users.json, tylko lokalnie)
function loginHint() {
  const u = $('loginUser').value;
  const noPass = cfg.static || (cfg.auth?.open && !cfg.auth?.passwords?.[u]);
  $('loginPassRow').hidden = noPass;
  $('loginHint').textContent = cfg.static ? 'Wersja demonstracyjna: wybór konta bez hasła – pokazuje i ukrywa funkcje jak na maszynie.'
    : noPass ? 'Hasła nieustawione (brak users.json) – logowanie bez hasła tylko na komputerze z VizuApp. Hasło: node scripts/users.mjs set ' + u
      : '';
}
$('loginUser').addEventListener('change', loginHint);
$('loginBtn').addEventListener('click', async () => {
  if (cfg.static && demo.user) { demo.user = ''; return refreshAccess(); }
  if (!cfg.static && session.token && app.level > 0) {
    await getJson('api/logout', post({})).catch(() => {});
    session.token = null;
    return refreshAccess();
  }
  $('loginUser').innerHTML = (cfg.static || !cfg.auth?.users?.length ? Object.keys(DEMO_LEVELS) : cfg.auth.users).map((u) => `<option>${u}</option>`).join('');
  $('loginPass').value = '';
  $('loginMsg').textContent = '';
  loginHint();
  $('loginDlg').showModal();
  if (!$('loginPassRow').hidden) $('loginPass').focus();
});
$('loginCancel').addEventListener('click', () => $('loginDlg').close());
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (cfg.static) {
    demo.user = $('loginUser').value;
    $('loginDlg').close();
    return refreshAccess();
  }
  try {
    const s = await getJson('api/login', post({ user: $('loginUser').value, password: $('loginPass').value }));
    session.token = s.token;
    $('loginDlg').close();
    await refreshAccess();
  } catch (err) { $('loginMsg').textContent = err.message === '401' ? 'Złe hasło' : err.message; }
});
// sesja po odswiezeniu strony; wygasla (bezczynnosc) - wylogowanie
async function restoreSession() {
  if (!cfg.auth?.enabled || !session.token) return;
  try { await getJson('api/session'); } catch { session.token = null; }
}

async function plcWrite(v, value) {
  return plcWriteMany([{ v, value }]);
}
async function plcWriteMany(items, msg = 'connInfo') {
  try {
    await getJson('api/plc/write', post({ items }));
    return true;
  } catch (err) {
    $(msg).textContent = err.message;
    $(msg).classList.add('err');
    return false;
  }
}
document.querySelectorAll('[data-write]').forEach((b) => b.addEventListener('click', () => plcWrite(b.dataset.write, true)));
document.querySelectorAll('[data-modereq]').forEach((b) => b.addEventListener('click', () => plcWrite('Machine.ModeRequest', Number(b.dataset.modereq))));

// ---------------------------------------------------------------- tryb reczny
// Jog: przycisk trzymany. Online: POST /api/plc/hold co 200 ms (serwer zdejmuje po utracie strony), offline: symulator
const jogs = new Map();
function manualMsg(text, err = false) { $('manualMsg').textContent = text; $('manualMsg').classList.toggle('err', err); }
function jogStart(btn) {
  const [axis, d] = btn.dataset.jog.split(':');
  const dir = Number(d);
  if (jogs.has(btn)) return;
  btn.classList.add('held');
  if (app.mode === 'offline') {
    if (!sim.jog(axis, dir, $('jogFast').checked)) manualMsg('Automat pracuje – jog po zatrzymaniu', true);
    jogs.set(btn, null);
    return;
  }
  const v = `Manual.Jog${axis.toUpperCase()}${dir > 0 ? 'Positive' : 'Negative'}`;
  const send = (on) => getJson('api/plc/hold', post({ v, on })).catch((err) => manualMsg(err.message, true));
  send(true);
  jogs.set(btn, { v, timer: setInterval(() => send(true), 200), send });
}
function jogStop(btn) {
  if (!jogs.has(btn)) return;
  const j = jogs.get(btn);
  jogs.delete(btn);
  btn.classList.remove('held');
  if (!j) { sim.jog(btn.dataset.jog.split(':')[0], 0); return; }
  clearInterval(j.timer);
  j.send(false);
}
document.querySelectorAll('[data-jog]').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    try { b.setPointerCapture(e.pointerId); } catch { /* bez przechwycenia - puszczenie przez pointerup */ }
    jogStart(b);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => jogStop(b));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
window.addEventListener('blur', () => [...jogs.keys()].forEach(jogStop));
$('jogFast').addEventListener('change', () => { if (app.mode === 'online') plcWriteMany([{ v: 'Manual.JogFast', value: $('jogFast').checked }], 'manualMsg'); });

async function manualCommand(offline, items) {
  manualMsg('');
  if (app.mode === 'offline') { if (offline() === false) manualMsg('Automat pracuje – polecenie po zatrzymaniu', true); return; }
  for (const it of items) {
    const err = checkParam(PLC_WRITES[it.v], it.value);
    if (err) return manualMsg(`${it.v}: ${err}`, true);
  }
  await plcWriteMany(items, 'manualMsg');
}
$('gotoXBtn').addEventListener('click', () => manualCommand(() => sim.goto('x', Number($('gotoX').value)),
  [{ v: 'Manual.GotoXTarget', value: Number($('gotoX').value) }, { v: 'Manual.GotoX', value: true }]));
$('gotoBBtn').addEventListener('click', () => manualCommand(() => sim.goto('b', Number($('gotoB').value)),
  [{ v: 'Manual.GotoBTarget', value: Number($('gotoB').value) }, { v: 'Manual.GotoB', value: true }]));
$('spindleBtn').addEventListener('click', () => manualCommand(() => sim.toggleSpindle(Number($('manFreq').value)),
  [{ v: 'Manual.SpindleFrequency', value: Number($('manFreq').value) }, { v: 'Manual.SpindleToggle', value: true }]));
$('waterBtn').addEventListener('click', () => manualCommand(() => sim.toggleWater(), [{ v: 'Manual.WaterToggle', value: true }]));
$('clampBtn').addEventListener('click', () => manualCommand(() => sim.toggleClamp(), [{ v: 'Manual.ClampToggle', value: true }]));

// Obroty: Reczny (Manual.SpindleFrequency) i Automat (RecipeStore.Active.SpindleFrequency) zapisywane od razu po zmianie
function freqWriter(input, v, msg) {
  let timer = null;
  input.addEventListener('input', () => {
    if (app.mode === 'offline') { if (v === 'Manual.SpindleFrequency') sim.setSpindleFrequency(input.value); return; }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const value = Number(input.value);
      const err = checkParam(PLC_WRITES[v], value);
      if (err) { $(msg).textContent = `Obroty: ${err}`; $(msg).classList.add('err'); return; }
      plcWriteMany([{ v, value }], msg);
    }, 250);
  });
}
freqWriter($('manFreq'), 'Manual.SpindleFrequency', 'manualMsg');
freqWriter($('autoFreq'), 'RecipeStore.Active.SpindleFrequency', 'plcInfo');

function updateManual(s) {
  if (app.mode === 'online' && document.activeElement !== $('autoFreq') && app.values.activeSpindleFrequency !== undefined) {
    const f = String(Math.round(Number(app.values.activeSpindleFrequency) * 10) / 10);
    if ($('autoFreq').value !== f) $('autoFreq').value = f;
  }
  $('spindleBtn').classList.toggle('on', Boolean(s.spindleRunning));
  $('waterBtn').classList.toggle('on', Boolean(s.water));
  $('clampBtn').classList.toggle('on', Boolean(s.clamp));
}

// ---------------------------------------------------------------- parametry serwisowe
const paramInputs = new Map();	// zmienna -> {it, input, row}
$('serviceGroups').innerHTML = SERVICE_PARAMS.map((g, gi) => `<details ${gi === 0 ? 'open' : ''}><summary>${g.group}</summary>${
  g.items.map((it) => {
    const field = it.type === 'bool' ? `<input type="checkbox" data-param="${it.v}">`
      : it.type === 'enum' ? `<select data-param="${it.v}">${Object.entries(it.options).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`
        : `<input type="number" data-param="${it.v}" step="any" min="${it.min}" max="${it.max}">`;
    return `<label class="param" data-row="${it.v}" title="${it.v}${it.min !== undefined ? ` (${it.min} … ${it.max})` : ''}"><span>${it.label}</span>${field}<em>${it.unit}</em></label>`;
  }).join('')}</details>`).join('');
for (const it of SERVICE_ITEMS) {
  paramInputs.set(it.v, { it, input: document.querySelector(`[data-param="${it.v}"]`), row: document.querySelector(`[data-row="${it.v}"]`) });
}
const inputValue = (it, input) => (it.type === 'bool' ? input.checked : input.value === '' ? '' : Number(input.value));

async function saveParam(v) {
  const { it, input, row } = paramInputs.get(v);
  const value = inputValue(it, input);
  const err = checkParam(PLC_WRITES[v], value);
  input.classList.toggle('bad', Boolean(err));
  $('serviceMsg').classList.toggle('err', Boolean(err));
  $('serviceMsg').textContent = err ? `${it.label}: ${err}` : '';
  if (err) return;
  let ok = true;
  if (app.mode === 'offline') sim.setOption(it.sim, value);
  else ok = await plcWriteMany([{ v, value }], 'serviceMsg');
  if (ok) {
    row.classList.add('saved');
    setTimeout(() => row.classList.remove('saved'), 900);
    $('serviceMsg').textContent = `Zapisano: ${it.label} = ${it.type === 'bool' ? (value ? 'TAK' : 'NIE') : value} ${it.unit}`;
  }
}
for (const [v, { input }] of paramInputs) input.addEventListener('change', () => saveParam(v));

// wartosci w polach: offline z symulatora, online ze zmiennych ogladanych (bez nadpisywania edytowanego pola)
function updateService() {
  const online = app.mode === 'online';
  for (const { it, input, row } of paramInputs.values()) {
    row.classList.toggle('hidden', !online && !it.sim);
    if (document.activeElement === input) continue;
    const raw = online ? app.hmi[it.v] : it.sim ? sim.option(it.sim) : undefined;
    const value = online && raw !== undefined ? fromPlc(it, raw) : raw;
    if (it.type === 'bool') input.checked = Boolean(value);
    else {
      const text = value === undefined || value === null ? '' : String(it.type === 'real' ? Math.round(Number(value) * 1000) / 1000 : value);
      if (input.value !== text) input.value = text;
    }
  }
}

// subskrypcja parametrow w PLC, gdy karta Serwis widoczna (odswiezanie przed WATCH_TTL serwera)
let watchTimer = null;
function watchService() {
  const want = cfg.plc && app.mode === 'online' && app.level >= 2;
  if (want && !watchTimer) {
    const send = () => getJson('api/plc/watch', post({ cid, paths: SERVICE_ITEMS.map((it) => it.v) })).catch(() => {});
    send();
    watchTimer = setInterval(send, 10000);
  } else if (!want && watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
    getJson('api/plc/watch', post({ cid, paths: [] })).catch(() => {});
  }
}

// ---------------------------------------------------------------- migawka biezacego trybu
function current() {
  if (app.mode === 'offline') {
    const state = sim.state();
    const profile = sim.profile ?? form;
    const passes = sim.profile ? sim.passes : generatePasses(form).passes;
    return { state, profile, passes, cut: cutState(state, sim.profile ? passes : []) };
  }
  const v = app.values;
  const step = Number(v.step ?? 0);
  if (step !== STEP.WaitForStart) app.freshStone = false;
  const useCycle = Number(v.passIndex ?? 0) > 0 && !app.freshStone;
  const profile = profileFromValues(v, useCycle ? 'cycle' : 'active');
  const passes = generatePasses(profile).passes;
  const left = profile.xStart - profile.overtravel;
  const right = profile.xEnd + profile.overtravel;
  const state = {
    ...v, step, x: Number(v.x ?? 0), b: Number(v.b ?? 0), passIndex: useCycle ? Number(v.passIndex) : 0,
    passFrom: step === STEP.PassX ? (v.directionPositive ? left : right) : null,
  };
  return { state, profile, passes, cut: cutState(state, useCycle ? passes : []) };
}

// ---------------------------------------------------------------- panel stanu i przekroj
function sectionSvg(profile, passes, cut) {
  const T = cfg.machine.stoneThickness;
  const angles = passes.slice(0, cut.done).map((p) => p.angleB);
  const now = edgeSection(profile.kind, cut.partial ? [...angles, cut.partial.angle] : angles, T, cfg.shape, 45);
  const target = edgeSection(profile.kind, passes.map((p) => p.angleB), T, cfg.shape, 45);
  const s = 2.6;
  const P = (poly) => poly.map(([u, v]) => `${(160 + u * s).toFixed(1)},${(100 - v * s).toFixed(1)}`).join(' ');
  return `<rect x="0" y="0" width="220" height="120" fill="none"/>
    <polygon points="${P([[-45, 0], [0, 0], [0, T], [-45, T]])}" fill="none" stroke="#9aa1aa" stroke-dasharray="3 2"/>
    <polygon points="${P(now)}" fill="#a9a39d" stroke="#5c5753" stroke-width="1"/>
    <polygon points="${P(target)}" fill="none" stroke="#1f6fb2" stroke-width="1" stroke-dasharray="4 2"/>
    <text x="6" y="14" font-size="9" fill="#6b7480">${PROFILE_NAMES[profile.kind] ?? ''} · ${cut.done}/${passes.length}</text>`;
}

let lastPanel = 0;
let lastKey = '';
function updatePanel(c) {
  const { state: s, profile, passes, cut } = c;
  $('sStep').textContent = `${EDGE_STEPS[s.step]?.[1] ?? s.step}${app.mode === 'online' ? ` · ${MODES[s.mode] ?? ''}` : ''}`;
  $('sPass').textContent = passes.length && s.passIndex ? `${Math.min(s.passIndex, passes.length)} / ${passes.length}${s.repeatIndex > 1 ? ` (powt. ${s.repeatIndex})` : ''}` : `— / ${passes.length}`;
  $('sX').textContent = `${fmt(s.x)} mm${s.xVelocity ? ` · ${fmt(Math.abs(s.xVelocity) * 0.06, 2)} m/min` : ''}`;
  $('sB').textContent = `${fmt(s.b)} °`;
  $('sSpindle').textContent = `${fmt(s.spindleFrequency)} Hz${s.spindleCurrent ? ` · ${fmt(s.spindleCurrent)} A` : ''}`;
  $('sMedia').textContent = `${s.clamp ? 'docisk' : '—'} / ${s.water ? 'woda' : '—'}`;
  $('sTime').textContent = app.mode === 'online' ? `${fmt(s.timeRemaining, 0)} s pozostało · ${fmt(s.progress, 0)} %` : '—';
  $('sCount').textContent = `${s.cycles ?? 0} cykli · ${fmt(s.metersTotal, 2)} m`;
  const alarms = app.mode === 'online' ? activeFromValues(app.values) : [];
  const simAlarm = app.mode === 'offline' && s.validationError;
  $('alarms').innerHTML = alarms.map((n) => `<div>${n}. ${alarmText(n)}</div>`).join('')
    + (simAlarm ? `<div>14. ${alarmText(14)}: ${VALIDATION_TEXT[s.validationError]}</div>` : '');
  const count = alarms.length + (simAlarm ? 1 : 0);
  $('alarmCount').hidden = !count;
  $('alarmCount').textContent = count;
  $('alarmOpen').classList.toggle('on', count > 0);
  const key = JSON.stringify([profile.kind, passes.map((p) => p.angleB), cut.done, cut.partial?.angle, s.passIndex]);
  if (key !== lastKey) {
    lastKey = key;
    $('section').innerHTML = sectionSvg(profile, passes, cut);
    $('passes').innerHTML = passes.map((p, i) => {
      const cls = i < cut.done ? 'done' : i === s.passIndex - 1 && s.step !== STEP.WaitForStart ? 'cur' : '';
      return `<span class="${cls}">${p.angleB > 0 ? '+' : ''}${fmt(p.angleB, 0)}°</span>`;
    }).join('');
  }
  $('simStartLbl').textContent = sim.step === STEP.Pause ? 'WZNÓW' : 'START';
  updateManual(s);
  updateService();
}

// ---------------------------------------------------------------- petla
let last = performance.now();
let lastRender = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (app.mode === 'offline') sim.tick(dt * Number($('speed').value));
  const c = current();
  // lite: scena co 200 ms (renderowanie programowe zajmuje watek strony), symulator i panel bez zmian
  if (!view.lite || now - lastRender > 200) {
    view.update(c.state, c.profile, c.passes, c.cut, view.lite ? (now - lastRender) / 1000 : dt);
    lastRender = now;
    if (app.follow) {
      const dx = c.state.x - view.controls.target.x;
      view.controls.target.x += dx * 0.08;
      view.camera.position.x += dx * 0.08;
    }
    view.render();
  }
  if (now - lastPanel > 100) { lastPanel = now; updatePanel(c); }
  requestAnimationFrame(frame);
}

setMode(app.mode);
document.querySelector('#viewTools [data-view="follow"]').classList.toggle('active', app.follow);
showTab(app.tab);
view.view('iso', current().state.x || 0);
connectEvents();
loadConnection();
await restoreSession();
refreshAccess();
window.vizu = { app, sim, view, current };		// diagnostyka i testy w przegladarce
requestAnimationFrame(frame);
