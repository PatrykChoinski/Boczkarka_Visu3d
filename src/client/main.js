// Strona Visu3D boczkarki: tryb offline (symulator cyklu jak w PLC) i online (wartosci z PLC przez OPC UA,
// serwer VizuApp; adres IP serwera OPC UA wpisywany na stronie - POST /api/connection).
import { EdgeView } from './view3d.js';
import { DEFAULTS, EDGE_STEPS, STEP, MODES, endpointFromHost } from '../shared/config.js';
import { EdgeSimulator } from '../shared/simulator.js';
import {
  PROFILE_TYPE, PROFILE_NAMES, defaultRecipes, generatePasses, profileFromValues, setProfileDefaults, VALIDATION_TEXT,
} from '../shared/edgeprofile.js';
import { edgeSection, cutState } from '../shared/edgeshape.js';
import { alarmText, activeFromValues } from '../shared/alarms.js';

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—');
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bez pamieci przegladarki */ } },
};

async function getJson(url, opts) {
  const r = await fetch(url, opts);
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
  connected: false,
  status: cfg.plc ? 'Łączenie…' : 'Serwer bez PLC – tylko offline',
  level: 0,
  freshStone: false,	// online: "Nowy kamien" - bez obrobki do startu nastepnego cyklu
  follow: store.get('vizu.follow', '1') === '1',	// kamera za glowica (domyslnie, jak na filmach)
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
fillForm();

$('simStart').addEventListener('click', () => {
  readForm();
  const ok = sim.start({ ...form });
  $('simMsg').textContent = ok || sim.step !== STEP.WaitForCommand ? '' : `Receptura: ${VALIDATION_TEXT[sim.error] ?? sim.error}`;
  $('simMsg').classList.toggle('err', !ok && sim.step === STEP.WaitForCommand);
});
$('simPause').addEventListener('click', () => sim.pause());
$('simStop').addEventListener('click', () => sim.stop());
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
  document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('offlineCard').classList.toggle('hidden', mode !== 'offline');
  $('onlineCard').classList.toggle('hidden', mode !== 'online');
  updateChip();
}
document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelector('#mode [data-mode="online"]').disabled = !cfg.plc;
document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => {
  app.follow = b.dataset.view === 'follow';
  store.set('vizu.follow', app.follow ? '1' : '0');
  document.querySelectorAll('#views button').forEach((x) => x.classList.toggle('on', x === b && app.follow));
  view.view(app.follow ? 'iso' : b.dataset.view, current().state.x || 0);
}));

function updateChip() {
  const chip = $('connChip');
  if (app.mode === 'offline') { chip.textContent = 'Symulacja offline'; chip.className = 'chip'; return; }
  chip.textContent = app.status;
  chip.className = `chip ${app.connected ? 'ok' : 'bad'}`;
}

// ---------------------------------------------------------------- online: SSE i polaczenie
const cid = Math.random().toString(36).slice(2, 12);
function connectEvents() {
  if (!cfg.plc) return;
  const es = new EventSource(`api/events?cid=${cid}`);
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if ('status' in d) { app.status = d.status; app.connected = d.connected; updateChip(); refreshAccess(); }
    if (d.full) app.values = { ...(d.values || {}) };
    else if (d.values) Object.assign(app.values, d.values);
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
    const c = await getJson('api/connection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint }) });
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

async function refreshAccess() {
  if (!cfg.plc) return;
  try { app.level = (await getJson('api/plc')).level; } catch { app.level = 0; }
  const show = app.connected && app.level >= 1;
  $('plcControls').hidden = !show;
  $('plcModes').hidden = !show;
}
async function plcWrite(v, value) {
  try {
    await getJson('api/plc/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ v, value }] }) });
  } catch (err) { $('connInfo').textContent = err.message; $('connInfo').classList.add('err'); }
}
document.querySelectorAll('[data-write]').forEach((b) => b.addEventListener('click', () => plcWrite(b.dataset.write, true)));
document.querySelectorAll('[data-modereq]').forEach((b) => b.addEventListener('click', () => plcWrite('Machine.ModeRequest', Number(b.dataset.modereq))));

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
  $('alarms').innerHTML = alarms.map((n) => `<div>${n}. ${alarmText(n)}</div>`).join('')
    + (app.mode === 'offline' && s.validationError ? `<div>14. ${alarmText(14)}: ${VALIDATION_TEXT[s.validationError]}</div>` : '');
  const key = JSON.stringify([profile.kind, passes.map((p) => p.angleB), cut.done, cut.partial?.angle, s.passIndex]);
  if (key !== lastKey) {
    lastKey = key;
    $('section').innerHTML = sectionSvg(profile, passes, cut);
    $('passes').innerHTML = passes.map((p, i) => {
      const cls = i < cut.done ? 'done' : i === s.passIndex - 1 && s.step !== STEP.WaitForStart ? 'cur' : '';
      return `<span class="${cls}">${p.angleB > 0 ? '+' : ''}${fmt(p.angleB, 0)}°</span>`;
    }).join('');
  }
  $('simStart').textContent = sim.step === STEP.Pause ? 'WZNÓW' : 'START';
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
document.querySelector('#views [data-view="follow"]').classList.toggle('on', app.follow);
view.view('iso', current().state.x || 0);
connectEvents();
loadConnection();
refreshAccess();
window.vizu = { app, sim, view, current };		// diagnostyka i testy w przegladarce
requestAnimationFrame(frame);
