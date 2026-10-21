// VizuApp - strona: tryb Online (pozycje z PLC przez serwer, SSE) i Offline (zadane ciecie / pozycja,
// animacja z predkosciami i przyspieszeniami jak w napedach).

import { View3D } from './view3d.js';
import { machine as makeMachine, bladeFrame, penetration, topZ, radius, lineAngle } from '../shared/geometry.js';
import { CutRecorder } from '../shared/cuts.js';
import { cutProgram, gotoProgram, depthTable, AXES } from '../shared/motion.js';
import { MACHINE_KEYS, DYNAMICS_KEYS } from '../shared/config.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const STORE_KEY = 'vizuapp.offline';
const SIM_STEP = 0.01;      // s czasu symulacji miedzy probkami zapisu ciecia

const state = {
  cfg: null,
  mode: 'online',
  pose: null,
  machine: makeMachine(),
  recorder: new CutRecorder(),
  extent: null,
  extentProvisional: true,
  fitted: false,
  online: { values: {}, status: 'Łączenie...', connected: false, lastCutStart: false },
  sim: { program: null, t: 0, running: false, step: '', velocity: 0 },
};

let view;

// --- dane wspolne obu trybow ---------------------------------------------------

function applyPose(pose, m) {
  state.pose = pose;
  state.machine = m;
  state.recorder.update(pose, m);
  growExtent();
}

function clearCuts() {
  state.recorder.clear();
  state.extent = null;
  state.extentProvisional = true;
}

// Material rysowany wokol tarczy; dopoki tarcza nie weszla w material - tymczasowo (jedzie za tarcza)
function growExtent() {
  const margin = state.cfg.materialMargin;
  const [minW, minH] = state.cfg.materialMinSize;
  const f = bladeFrame(state.pose, state.machine);
  const [lx, ly] = f.lowest;
  const inMaterial = penetration(f, state.machine) > 0;
  if (!state.extent || state.extentProvisional) {
    const refit = state.extent && inMaterial;
    state.extent = [lx - minW / 2, ly - minH / 2, lx + minW / 2, ly + minH / 2];
    state.extentProvisional = !inMaterial;
    if (refit || !state.fitted) { state.fitted = true; fit(); }
  }
  let [x0, y0, x1, y1] = state.extent;
  const b = state.recorder.bounds();
  if (b) {
    x0 = Math.min(x0, b[0] - margin); y0 = Math.min(y0, b[1] - margin);
    x1 = Math.max(x1, b[2] + margin); y1 = Math.max(y1, b[3] + margin);
  }
  if (inMaterial) {
    x0 = Math.min(x0, lx - margin); y0 = Math.min(y0, ly - margin);
    x1 = Math.max(x1, lx + margin); y1 = Math.max(y1, ly + margin);
  }
  state.extent = [x0, y0, x1, y1];
}

function sceneBox() {
  if (!state.extent) return null;
  const [x0, y0, x1, y1] = state.extent;
  const top = topZ(state.machine);
  return [[x0, y0, top - state.machine.materialThickness], [x1, y1, top + radius(state.machine) * 0.6]];
}

function fit() {
  const box = sceneBox();
  if (box) view.fit(box);
}

// --- rysowanie i pasek stanu ------------------------------------------------------

const fmt = (v, w, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(w);

function redraw() {
  const m = state.machine;
  view.setMaterial(state.extent, m);
  view.setCuts(state.recorder);
  view.setBlade(state.pose, m, $('#showBlade').checked);
  view.render();

  const s = state.recorder.summary();
  $('#hudCut').textContent = s
    ? `Cięcie: długość ${s.length.toFixed(0)} mm, głębokość ${s.depth.toFixed(1)} mm (cięć: ${s.count})`
    : 'Brak cięcia - tarcza nad materiałem';
  $('#hudMachine').textContent = `Tarcza Ø${m.discDiameter.toFixed(0)} × ${m.bladeWidth.toFixed(1)} mm, materiał: góra Z ${m.materialHeight.toFixed(1)}, grubość ${m.materialThickness.toFixed(1)} mm`;

  const p = state.pose;
  if (p) {
    const depth = Math.max(0, penetration(bladeFrame(p, m), m));
    let line = `X ${fmt(p.x, 8)}  Y ${fmt(p.y, 8)}  Z ${fmt(p.z, 7)}  A ${fmt(p.a, 6)}°  B ${fmt(p.b, 5)}°  głęb. ${fmt(depth, 6)} mm`;
    if (state.mode === 'offline') line += `  v ${fmt(state.sim.velocity, 6)} mm/s`;
    $('#pos').textContent = line;
  }

  const conn = $('#conn');
  if (state.mode === 'online') {
    conn.textContent = state.online.status;
    conn.className = state.online.connected ? 'ok' : 'bad';
    const v = state.online.values;
    let text = '';
    if (v.cutStep !== undefined) text = `CutStep: ${state.cfg.cutSteps[v.cutStep] ?? v.cutStep}`;
    if (v.sawRunning) text += '   piła ON';
    if (v.waterCut) text += '   woda';
    $('#step').textContent = text;
  } else {
    const sim = state.sim;
    conn.textContent = 'Offline - symulacja (bez PLC)';
    conn.className = 'ok';
    $('#step').textContent = sim.program
      ? `${sim.step}   ${sim.t.toFixed(1)} / ${sim.program.duration.toFixed(1)} s${sim.running ? '' : '   (zatrzymane)'}`
      : '';
  }
}

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; redraw(); });
}

// --- tryb online -------------------------------------------------------------------

function onlineValues(v) {
  state.online.values = v;
  if (state.mode !== 'online') return;
  const m = { ...state.machine };
  for (const k of MACHINE_KEYS) if (typeof v[k] === 'number') m[k] = v[k];
  if (![v.x, v.y, v.z, v.a, v.b].every((n) => typeof n === 'number')) return;
  const cutStart = Boolean(v.cutStart);
  if (cutStart && !state.online.lastCutStart && state.cfg.autoClearOnStart) clearCuts();
  state.online.lastCutStart = cutStart;
  applyPose({ x: v.x, y: v.y, z: v.z, a: v.a, b: v.b }, m);
  requestDraw();
}

function connectEvents() {
  const es = new EventSource('api/events');
  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if ('status' in msg) { state.online.status = msg.status; state.online.connected = msg.connected; }
    if (msg.values) onlineValues(msg.values);
    $('#fromPlc').disabled = !hasPlcDynamics();
    requestDraw();
  };
  es.onerror = () => {
    state.online.status = 'Brak połączenia z serwerem VizuApp';
    state.online.connected = false;
    requestDraw();
  };
}

// --- tryb offline: formularze ----------------------------------------------------

function readFields(attr) {
  const out = {};
  for (const el of $$(`[data-${attr}]`)) out[el.dataset[attr]] = Number(el.value);
  return out;
}

function writeFields(attr, obj) {
  for (const el of $$(`[data-${attr}]`)) {
    const v = obj[el.dataset[attr]];
    if (v !== undefined && Number.isFinite(Number(v))) el.value = Number(Number(v).toFixed(3));
  }
}

function saveForms() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ cut: readFields('cut'), m: readFields('m'), d: readFields('d') }));
  } catch { /* brak dostepu do localStorage - formularze tylko w tej sesji */ }
}

function loadForms() {
  const off = state.cfg.offline;
  writeFields('cut', off.cut);
  writeFields('m', off.machine);
  writeFields('d', off.dynamics);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) { writeFields('cut', saved.cut || {}); writeFields('m', saved.m || {}); writeFields('d', saved.d || {}); }
  } catch { /* jw. */ }
}

const offlineMachine = () => makeMachine(readFields('m'));
const offlineDynamics = () => readFields('d');

function cutInput() {
  const c = readFields('cut');
  return { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, b: c.b, above: c.above, depths: depthTable(c.depth, c.passes) };
}

function validDynamics(d) {
  return DYNAMICS_KEYS.every((k) => d[k] > 0);
}

function updateCutInfo() {
  const c = cutInput();
  const len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0);
  const a = lineAngle(c.x0, c.y0, c.x1, c.y1);
  const d = offlineDynamics();
  let text = `Kąt A ${a.toFixed(1)}°, długość ${len.toFixed(1)} mm, przejścia: ${c.depths.map((x) => x.toFixed(1)).join(' / ')} mm`;
  if (validDynamics(d) && len > 0) {
    const prog = cutProgram(state.pose || state.cfg.offline.start, c, offlineMachine(), d);
    text += `<br>Czas programu: ${prog.duration.toFixed(1)} s`;
  } else {
    text += '<br><span style="color:var(--bad)">Uzupełnij parametry dynamiki (wartości &gt; 0)</span>';
  }
  $('#cutInfo').innerHTML = text;
}

function hasPlcDynamics() {
  const v = state.online.values;
  return DYNAMICS_KEYS.some((k) => typeof v[k] === 'number') || MACHINE_KEYS.some((k) => typeof v[k] === 'number');
}

function fromPlc() {
  const v = state.online.values;
  const pick = (keys) => Object.fromEntries(keys.filter((k) => typeof v[k] === 'number').map((k) => [k, v[k]]));
  writeFields('m', pick(MACHINE_KEYS));
  writeFields('d', pick(DYNAMICS_KEYS));
  saveForms();
  offlineFormsChanged();
}

function offlineFormsChanged() {
  saveForms();
  updateCutInfo();
  if (state.mode === 'offline' && !state.sim.running && state.pose) {
    applyPose(state.pose, offlineMachine());
    requestDraw();
  }
}

// --- tryb offline: animacja ------------------------------------------------------

function startProgram(program) {
  state.sim.program = program;
  state.sim.t = 0;
  state.sim.running = true;
  state.sim.lastFrame = performance.now();
  $('#pause').textContent = 'Pauza';
  requestAnimationFrame(simFrame);
}

function simFrame(now) {
  const sim = state.sim;
  if (!sim.running || state.mode !== 'offline') return;
  const speed = Number($('#speed').value) || 1;
  // czas rzeczywisty (tez przy malej liczbie klatek); dluzsza przerwa (karta w tle) - bez skoku
  const dt = Math.min(0.5, (now - sim.lastFrame) / 1000) * speed;
  sim.lastFrame = now;
  const m = offlineMachine();
  const tEnd = Math.min(sim.program.duration, sim.t + dt);
  // probki co SIM_STEP, zeby przy szybkim tempie nie gubic ciecia
  let res;
  for (let t = sim.t + SIM_STEP; t < tEnd; t += SIM_STEP) state.recorder.update(sim.program.at(t).pose, m);
  res = sim.program.at(tEnd);
  sim.t = tEnd;
  sim.step = res.step;
  sim.velocity = res.velocity;
  applyPose(res.pose, m);
  if (res.done) {
    sim.running = false;
    sim.velocity = 0;
  }
  redraw();
  if (sim.running) requestAnimationFrame(simFrame);
}

function stopProgram() {
  state.sim.running = false;
  state.sim.velocity = 0;
  requestDraw();
}

function setMode(mode) {
  state.mode = mode;
  stopProgram();
  state.sim.program = null;
  for (const b of $$('#mode button')) b.classList.toggle('active', b.dataset.mode === mode);
  $('#panel').hidden = mode !== 'offline';
  clearCuts();
  state.fitted = false;
  if (mode === 'offline') {
    const start = state.pose || state.cfg.offline.start;
    applyPose({ ...start }, offlineMachine());
    writeFields('pos', start);
    updateCutInfo();
  } else {
    state.pose = null;
    onlineValues(state.online.values);
  }
  try { localStorage.setItem('vizuapp.mode', mode); } catch { /* jw. */ }
  requestDraw();
}

// --- obsluga przyciskow ------------------------------------------------------------

function bindUi() {
  for (const b of $$('#mode button')) b.onclick = () => setMode(b.dataset.mode);
  for (const b of $$('[data-view]')) b.onclick = () => { view.viewName = b.dataset.view; fit(); };
  $('#fit').onclick = fit;
  $('#zoomIn').onclick = () => view.zoom(0.8);
  $('#zoomOut').onclick = () => view.zoom(1.25);
  $('#clear').onclick = () => { clearCuts(); if (state.pose) growExtent(); requestDraw(); };
  $('#showBlade').onchange = requestDraw;
  $('#view').ondblclick = fit;

  for (const t of $$('.tabs button')) {
    t.onclick = () => {
      for (const x of $$('.tabs button')) x.classList.toggle('active', x === t);
      for (const p of $$('.tab')) p.hidden = p.dataset.tab !== t.dataset.tab;
    };
  }
  for (const el of $$('[data-cut], [data-m], [data-d]')) el.addEventListener('input', offlineFormsChanged);

  $('#cutStart').onclick = () => {
    const d = offlineDynamics();
    if (!validDynamics(d)) return;
    clearCuts();
    startProgram(cutProgram(state.pose, cutInput(), offlineMachine(), d));
  };
  $('#pause').onclick = () => {
    const sim = state.sim;
    if (!sim.program || sim.t >= sim.program.duration) return;
    sim.running = !sim.running;
    $('#pause').textContent = sim.running ? 'Pauza' : 'Wznów';
    if (sim.running) { sim.lastFrame = performance.now(); requestAnimationFrame(simFrame); }
    requestDraw();
  };
  $('#stop').onclick = () => { stopProgram(); state.sim.program = null; requestDraw(); };

  $('#posGo').onclick = () => {
    const d = offlineDynamics();
    if (!validDynamics(d)) return;
    startProgram(gotoProgram(state.pose, readFields('pos'), d));
  };
  $('#posSet').onclick = () => {
    stopProgram();
    state.sim.program = null;
    applyPose(readFields('pos'), offlineMachine());
    requestDraw();
  };
  $('#posActual').onclick = () => writeFields('pos', state.pose);

  $('#fromPlc').onclick = fromPlc;
  $('#defaults').onclick = () => {
    writeFields('m', state.cfg.offline.machine);
    writeFields('d', state.cfg.offline.dynamics);
    offlineFormsChanged();
  };
}

async function init() {
  view = new View3D($('#view'));
  state.cfg = await (await fetch('api/config')).json();
  loadForms();
  bindUi();
  connectEvents();
  let mode = state.cfg.plc ? 'online' : 'offline';
  try { mode = localStorage.getItem('vizuapp.mode') || mode; } catch { /* jw. */ }
  setMode(mode);
}

init();

// do testow z konsoli / automatu
window.vizu = { state, AXES };
