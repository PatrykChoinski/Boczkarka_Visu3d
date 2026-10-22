// VizuApp - strona: tryb Online (pozycje z PLC przez serwer, SSE) i Offline (zadane ciecie / pozycja,
// animacja z predkosciami i przyspieszeniami jak w napedach, ruchy reczne), laser, obroty tarczy,
// ciecie w stol, bazowanie (tryb pila / frez / wiercenie / polerowanie - narzedzie i ekrany wg trybu).

import { View3D } from './view3d.js';
import { tableExtent } from './machine3d.js';
import { MAX_APEX, apexPoints, boardZMin, bounds, isArea, pointInPolygon } from '../shared/area.js';
import { machine as makeMachine, headFrame, toolFrame, plcToolAxisZ, workAxisZ, plcActualPosition, axisFromActual, isToolMode, toolSize, penetration, topZ, radius, lineAngle } from '../shared/geometry.js';
import { waterLayout, laserMount } from '../shared/water.js';
import { CutRecorder } from '../shared/cuts.js';
import { ToolRecorder } from '../shared/toolcuts.js';
import { MODES, AUTO_KINDS, modeById, modeFromValues, homingProgram, toolOpsFor } from '../shared/tools.js';
import { ProgramBuilder, gotoProgram, AXES } from '../shared/motion.js';
import { OPS, COMMON_FIELDS, defaults, parseField, savedPosition } from '../shared/ops.js';
import { STEPS, stepName, addAutomat, previewSteps, rowsFromArrays } from '../shared/automat.js';
import { MACHINE_KEYS, DYNAMICS_KEYS, dynamicsToInternal, dynamicsToDisplay, plcDynamics, plcKey } from '../shared/config.js';
import { JogMotion, jogVelocity, interpolationDir, laserLine, DIAGONALS, diagonalDir, tiltMoveVector } from '../shared/jog.js';
import { MANUAL_SCREENS, manualScreenHtml } from './manualpanel.js';
import { installIcons, icon } from './icons.js';
import { SERVICE_BITS, serviceDefaults } from '../shared/service.js';
import { SERVICE_PAGES } from '../shared/servicescreens.js';
import { FIGURES, FIGURE_CONTEXT_FIELDS, figureContext, MILL_STEPS, previewMill } from '../shared/figures/index.js';
import { MILL_COMMON_FIELDS, addAutomatMill } from '../shared/millops.js';
import { figurePicture, fieldLetter } from '../shared/figpics.js';
import { parseGcode, gcodeSummary } from '../shared/gcode.js';
import { cncProgram, cncTipPath } from '../shared/cnc.js';
import { HeightMap, shadeHeightMap } from '../shared/heightmap.js';

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
  tableRecorder: new CutRecorder(),   // ciecie w stol (pod kamieniem) - na czerwono
  toolRecorder: new ToolRecorder(),   // slad frezu / wiertla / polerki w kamieniu
  toolTableRecorder: new ToolRecorder(),
  // tryb po bazowaniu (offline - ekran Bazowanie; online - bModeSaw / Mill / Drill / Polishing i bSystemBased z PLC),
  // homing - docelowy tryb bazowania w toku
  tool: { mode: 'saw', based: true, homing: null, key: '' },
  // ruchy reczne (#143): tryb ciagly / skok, wlaczony przelacznik ruchu interpolowanego, punkty A, B, C
  manContinuous: true, manToggle: null, points: {},
  // bity serwisowe HMI.bService... (ekran Ustawienia, service.js)
  service: serviceDefaults(),
  // ekrany serwisowe (#147): wartosci zmiennych HMI bez odpowiednika w symulacji (offline), GVL.zmienna -> wartosc
  hmi: {},
  servicePage: 'main',
  // aktualne predkosci osi (mm/s, °/s): offline z programu / jogu, online z PLC albo z roznicy pozycji
  axisVel: { x: 0, y: 0, z: 0, a: 0, b: 0 }, velTrack: { p: null, t: 0 },
  // logowanie (#145): enabled - serwer ma users.json; level 0 niezalogowany, 1 Operator, 2 Serwis, 3 Admin
  auth: { enabled: false, users: [], user: null, level: 0, token: null, timeoutMin: 30, lastActivity: 0, lastPing: 0 },
  extent: null,
  extentProvisional: true,
  stoneKey: '',
  areasKey: '',             // ostatnie punkty stolu / kamienia z PLC (odswiezanie tabel)
  fitted: false,
  online: { values: {}, status: 'Łączenie...', connected: false, lastCutStart: false },
  sim: { program: null, t: 0, running: false, step: '', velocity: 0, label: null, index: null },
  planSource: 'op',         // podglad planu: 'op' - operacja, 'auto' - automat
  autoKey: '',              // ostatnio narysowana tabela automatu (online)
  forms: null,              // formularze offline: operacje, wspolne parametry, automat
  jog: null,                // ruch reczny offline (JogMotion) w toku
  saw: { manual: false, angle: 0, last: 0 },   // naped tarczy: offline wlaczony recznie, kat obrotu szprych
};

let view;

// --- dane wspolne obu trybow ---------------------------------------------------

function applyPose(pose, m) {
  state.pose = pose;
  state.machine = m;
  recordPose(pose, m);
  growExtent();
}

// Plyta stolu pod kamieniem jako "material" do zapisu ciecia w stol
function tableMachine(m) {
  return { ...m, materialHeight: m.materialHeight + m.materialThickness, materialThickness: state.cfg.tableThickness || 80 };
}

// Zapis ciecia: w kamieniu (tylko nad kamieniem, gdy jest wielokat) i w stole (ponizej spodu kamienia);
// tarcza - rzazy (CutRecorder), frez / wiertlo / polerka - slad czola narzedzia (ToolRecorder)
function recordPose(pose, m) {
  // G-kod (#124): probki programu CNC na mapie wysokosci zamiast osobnych sladow narzedzia
  if (cncRecording(m)) { cncRecord(pose, m); return; }
  const rock = rockPolygon();
  const low = headFrame(pose, m).lowest;
  const [stone, table] = isToolMode(m) ? [state.toolRecorder, state.toolTableRecorder] : [state.recorder, state.tableRecorder];
  if (!rock || pointInPolygon(low[0], low[1], rock)) stone.update(pose, m);
  table.update(pose, tableMachine(m));
}

// Rekorder biezacego trybu (podsumowanie na pasku, zakres materialu)
const activeRecorder = (m = state.machine) => (isToolMode(m) ? state.toolRecorder : state.recorder);

function clearCuts() {
  state.recorder.clear();
  state.tableRecorder.clear();
  state.toolRecorder.clear();
  state.toolTableRecorder.clear();
  cncState.hm = null;
  cncState.lastTip = null;
  state.extent = null;
  state.extentProvisional = true;
}

// --- stol i kamien (punkty XYZ jak aCuttingBoard / aCuttingRock) -------------------

// Punkty stolu / kamienia: online z PLC, offline z tabel w zakladce
function areaPoints(name) {
  if (state.mode === 'online') {
    const v = state.online.values;
    return apexPoints(v[`${name}X`], v[`${name}Y`], v[`${name}Z`], v[`${name}Count`]);
  }
  return readArea(name).points;
}

// Kamien jako wielokat (>= 3 punkty) albo null - wtedy material rysowany wokol ciec
function rockPolygon() {
  const pts = areaPoints('rock');
  return isArea(pts) ? pts : null;
}

function growExtent() {
  const rock = rockPolygon();
  if (rock) {
    state.extent = bounds(rock);
    state.extentProvisional = false;
    const key = JSON.stringify(rock);
    if (key !== state.stoneKey || !state.fitted) { state.stoneKey = key; state.fitted = true; fit(); }
    return;
  }
  state.stoneKey = '';
  growAutoExtent();
}

// Material rysowany wokol tarczy; dopoki tarcza nie weszla w material - tymczasowo (jedzie za tarcza)
function growAutoExtent() {
  const margin = state.cfg.materialMargin;
  const [minW, minH] = state.cfg.materialMinSize;
  const f = headFrame(state.pose, state.machine);
  const [lx, ly] = f.lowest;
  const inMaterial = penetration(f, state.machine) > 0;
  if (!state.extent || state.extentProvisional) {
    const refit = state.extent && inMaterial;
    state.extent = [lx - minW / 2, ly - minH / 2, lx + minW / 2, ly + minH / 2];
    state.extentProvisional = !inMaterial;
    if (refit || !state.fitted) { state.fitted = true; fit(); }
  }
  let [x0, y0, x1, y1] = state.extent;
  for (const b of [state.recorder.bounds(), state.toolRecorder.bounds()]) {
    if (!b) continue;
    x0 = Math.min(x0, b[0] - margin); y0 = Math.min(y0, b[1] - margin);
    x1 = Math.max(x1, b[2] + margin); y1 = Math.max(y1, b[3] + margin);
  }
  if (inMaterial) {
    x0 = Math.min(x0, lx - margin); y0 = Math.min(y0, ly - margin);
    x1 = Math.max(x1, lx + margin); y1 = Math.max(y1, ly + margin);
  }
  state.extent = [x0, y0, x1, y1];
}

// Dopasowanie widoku: kamien / material, a przy widocznym suporcie caly stol maszyny
function sceneBox() {
  if (!state.extent) return null;
  let [x0, y0, x1, y1] = state.extent;
  if ($('#showFrame').checked) {
    const t = tableExtent(areaPoints('board'));
    x0 = Math.min(x0, t[0]); y0 = Math.min(y0, t[1]); x1 = Math.max(x1, t[2]); y1 = Math.max(y1, t[3]);
  }
  const top = topZ(state.machine);
  return [[x0, y0, top - state.machine.materialThickness], [x1, y1, top + radius(state.machine) * 0.6]];
}

function fit() {
  const box = sceneBox();
  if (box) view.fit(box);
}

// --- rysowanie i pasek stanu ------------------------------------------------------

const fmt = (v, w, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(w);
const fmtAxis = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

function redraw() {
  const m = state.machine;
  const rock = rockPolygon();
  view.setMaterial(state.extent, m, rock);
  view.setCuts(state.recorder, 'stone');
  view.setCuts(state.tableRecorder, 'table');
  view.setToolCuts(state.toolRecorder, 'stone');
  view.setToolCuts(state.toolTableRecorder, 'table');
  drawCnc();
  const lcfg = state.cfg.laser || { side: 1, length: 2500 };
  const head = $('#showBlade').checked && state.pose;
  view.setLaser(laserPoints(m, rock), 8, head && laserOn() ? laserMount(state.pose, m, lcfg.side, lcfg.mountAngle).pos : null);
  // kierunek obrotu tarczy (jak szprychy): woda na strone schodzaca w material, rozbryzg w kierunku obrotu
  const spin = sawState().dir * (state.cfg.saw?.fwdSign ?? 1);
  view.setWater(head ? waterLayout(state.pose, m, spin) : null, waterOn(), performance.now() / 1000);
  view.setPlan(planItems(), topZ(m), { xy: $('#showMarks').checked, dist: $('#showDist').checked });
  view.setBlade(state.pose, m, $('#showBlade').checked, state.saw.angle);
  view.setTool(state.pose, m, $('#showBlade').checked, state.saw.angle);
  view.setMachine(state.pose, m, state.cfg.frame, areaPoints('board'), $('#showBlade').checked, $('#showFrame').checked,
    { laser: lcfg, laserOn: laserOn(), spin });
  view.render();

  const tool = isToolMode(m);
  const mode = modeById(m.mode);
  const s = activeRecorder(m).summary();
  const work = { mill: 'Frezowanie', drill: 'Wiercenie', polishing: 'Polerowanie' }[m.mode] || 'Cięcie';
  let text = `Brak ${tool ? 'obróbki' : 'cięcia'} - ${mode.tool} nad materiałem`;
  if (s && s.polish) text = `${work}: tor ${s.length.toFixed(0)} mm (przejść: ${s.count})`;
  else if (s && m.mode === 'drill') text = `${work}: głębokość ${s.depth.toFixed(1)} mm (otworów: ${s.count})`;
  else if (s) text = `${work}: długość ${s.length.toFixed(0)} mm, głębokość ${s.depth.toFixed(1)} mm (${tool ? 'przejść' : 'cięć'}: ${s.count})`;
  $('#hudCut').textContent = text;
  const ts = (tool ? state.toolTableRecorder : state.tableRecorder).summary();
  $('#hudTable').textContent = ts && !ts.polish ? `${tool ? 'W stół' : 'Cięcie w stół'}: długość ${ts.length.toFixed(0)} mm, głębokość ${ts.depth.toFixed(1)} mm` : '';
  const rb = rock && bounds(rock);
  const size = rb ? `${(rb[2] - rb[0]).toFixed(0)} × ${(rb[3] - rb[1]).toFixed(0)} × ${m.materialThickness.toFixed(1)} mm` : `grubość ${m.materialThickness.toFixed(1)} mm`;
  const ts2 = tool && toolSize(m);
  const toolText = tool
    ? `${mode.name}: ${mode.tool} Ø${ts2.diameter.toFixed(0)} mm, długość ${ts2.length.toFixed(0)} mm`
    : `Piła: tarcza Ø${m.discDiameter.toFixed(0)} × ${m.bladeWidth.toFixed(1)} mm`;
  $('#hudMachine').textContent = `${toolText}${isBased() ? '' : ' (maszyna niezbazowana)'}, kamień: ${size}, góra Z ${m.materialHeight.toFixed(1)}`;

  const p = state.pose;
  if (p && !$('.tab[data-tab="pos"]').hidden) {
    for (const el of $$('[data-act]')) el.value = fmtAxis(p[el.dataset.act]);
  }
  syncManualWin();
  if (!$('.tab[data-tab="speed"]').hidden) syncSpeed();
  if (!$('.tab[data-tab="service"]').hidden) syncService();
  if (p) {
    // glebokosc jak HMI2.fStatusActualCutDepth (fZActualPosition - fCutMaterialHeight): nad materialem ujemna;
    // online z PLC, offline z geometrii (najnizszy punkt narzedzia wzgledem gornej powierzchni)
    const ov = state.online.values;
    const depth = state.mode === 'online' && typeof ov.cutDepth === 'number' ? ov.cutDepth : penetration(headFrame(p, m), m);
    let line = `X ${fmt(p.x, 8)}  Y ${fmt(p.y, 8)}  Z ${fmt(p.z, 7)}  A ${fmt(p.a, 6)}°  B ${fmt(p.b, 5)}°  głęb. ${fmt(depth, 6)} mm`;
    if (state.mode === 'offline') line += `  v ${fmt(state.sim.velocity * 0.06, 6, 2)} m/min`;
    $('#pos').textContent = line;
    // predkosci osi pod pozycjami: X / Y / Z w m/min, A / B w °/s (te same kolumny co pozycje)
    const av = state.axisVel;
    const tiny = (x, eps) => (Math.abs(x) < eps ? 0 : x);
    $('#vel').textContent = `vX${fmt(tiny(av.x * 0.06, 0.005), 8, 2)}  vY${fmt(tiny(av.y * 0.06, 0.005), 8, 2)}`
      + `  vZ${fmt(tiny(av.z * 0.06, 0.005), 7, 2)}  vA${fmt(tiny(av.a, 0.05), 6, 1)}°  vB${fmt(tiny(av.b, 0.05), 5, 1)}°  m/min, °/s`;
  }

  const conn = $('#conn');
  if (state.mode === 'online') {
    conn.textContent = state.online.status;
    conn.className = state.online.connected ? 'ok' : 'bad';
    const v = state.online.values;
    let text = '';
    const auto = onlineAuto();
    if (auto.running) text = `Automat: krok ${auto.index + 1} / ${auto.count} – ${stepName(auto.rows[auto.index]?.step)}   `;
    if (v.cutStep !== undefined) text += `CutStep: ${state.cfg.cutSteps[v.cutStep] ?? v.cutStep}`;
    text += sawText();
    if (v.waterCut || v.waterMill) text += `   woda${v.waterMill && !v.waterCut ? ' (frez)' : ''}`;
    if (v.laser) text += '   laser';
    $('#step').textContent = text;
  } else {
    const sim = state.sim;
    conn.textContent = state.cfg.static ? 'Offline - symulacja (GitHub Pages, bez PLC)' : 'Offline - symulacja (bez PLC)';
    conn.className = 'ok';
    $('#step').textContent = (sim.program
      ? `${sim.label ? `${sim.label}   ` : ''}${sim.step}   ${sim.t.toFixed(1)} / ${sim.program.duration.toFixed(1)} s${sim.running ? '' : '   (zatrzymane)'}`
      : (state.jog ? 'Ruch ręczny' : '')) + sawText() + ($('#showLaser').checked ? '   laser' : '');
  }
}

// --- laser i naped tarczy -------------------------------------------------------------------

// Wysokosc powierzchni pod laserem: kamien (gdzie jest) albo stol
function surfaceZ(m, rock) {
  const top = topZ(m);
  const table = top - m.materialThickness;
  return (x, y) => (!rock || pointInPolygon(x, y, rock) ? top : table);
}

function laserOn() {
  if (!$('#showLaser').checked || !state.pose) return false;
  return state.mode === 'online' ? Boolean(state.online.values.laser) : true;
}

function laserPoints(m, rock) {
  if (!laserOn()) return null;
  const l = state.cfg.laser || { side: 1, length: 2500 };
  return laserLine(state.pose, m, l.side, l.length, surfaceZ(m, rock));
}

// Woda na tarcze / narzedzie (#141): przy obrotach; online zawor z PLC (yWaterCut - pila, yWaterMill - frez, wiercenie),
// bez tych zmiennych w PLC - jak offline (woda przy obrotach)
function waterOn() {
  const s = sawState();
  if (!s.running || s.freq <= 0) return false;
  if (state.mode !== 'online') return true;
  const v = state.online.values;
  if (v.waterCut === undefined && v.waterMill === undefined) return true;
  return Boolean(v.waterCut || v.waterMill);
}

// Stan napedu tarczy: {running, freq [Hz], dir: 1 FWD / -1 REV}
function sawState() {
  if (state.mode === 'online') {
    const v = state.online.values;
    const scale = state.cfg.saw?.freqScale ?? 0.01;
    return { running: Boolean(v.sawRunning), freq: (Number(v.sawFreq) || 0) * scale, dir: v.sawRev && !v.sawFwd ? -1 : 1 };
  }
  const running = state.saw.manual || Boolean(state.sim.running);
  return { running, freq: Number($('#sawFreq').value) || 0, dir: $('#sawDir').value === 'REV' ? -1 : 1 };
}

function sawText() {
  const s = sawState();
  return s.running ? `   ${isToolMode(state.machine) ? 'wrzeciono' : 'piła'} ${s.freq.toFixed(1)} Hz ${s.dir > 0 ? 'FWD' : 'REV'}` : '';
}

// Obroty tarczy / narzedzia na ekranie (umowne: visualRps / toolVisualRps obr/s przy 50 Hz), petla tylko gdy naped sie kreci
function spinFrame(now) {
  const s = sawState();
  const dt = state.saw.last ? Math.min(0.1, (now - state.saw.last) / 1000) : 0;
  state.saw.last = now;
  if (!s.running || s.freq <= 0) { state.saw.last = 0; state.saw.spinning = false; return; }
  const cfg = state.cfg.saw || {};
  // narzedzia (frez, wiertlo, polerka) - male srednice, na ekranie szybciej niz tarcza (toolVisualRps przy 50 Hz)
  const base = isToolMode(state.machine) ? (cfg.toolVisualRps ?? 3) : (cfg.visualRps ?? 1.5);
  const rps = base * s.freq / 50;
  state.saw.angle = (state.saw.angle + s.dir * (cfg.fwdSign ?? 1) * rps * 2 * Math.PI * dt) % (2 * Math.PI);
  if (!state.sim.running && !state.jog) redraw();
  requestAnimationFrame(spinFrame);
}

function ensureSpin() {
  if (state.saw.spinning) return;
  const s = sawState();
  if (!s.running || s.freq <= 0) return;
  state.saw.spinning = true;
  state.saw.last = 0;
  requestAnimationFrame(spinFrame);
}

let drawQueued = false;
function requestDraw() {
  if (state.cfg) ensureSpin();
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; redraw(); });
}

// --- aktualne predkosci osi (pod pozycjami w stopce) ------------------------------------------

function zeroAxisVelocity() {
  for (const ax of AXES) state.axisVel[ax] = 0;
}

// Symulacja: pochodna programu ruchu w czasie maszyny (srodek ostatnich 20 ms)
function axisVelocityFromProgram(prog, t) {
  const h = 0.02;
  const t0 = Math.max(0, t - h);
  if (t - t0 < 1e-6) { zeroAxisVelocity(); return; }
  const p0 = prog.at(t0).pose;
  const p1 = prog.at(t).pose;
  for (const ax of AXES) state.axisVel[ax] = (p1[ax] - p0[ax]) / (t - t0);
}

// Online: predkosci z PLC (HMI2.f[XYZA]ActualVelocity: X / Y / Z w m/min, A w °/s * 0.06 - przeliczone na mm/s, °/s);
// os bez zmiennej (B - w PLC liczona z osi A) z roznicy pozycji miedzy kolejnymi odczytami (wygladzone)
const PLC_ACT_VEL = { x: 1000 / 60, y: 1000 / 60, z: 1000 / 60, a: 1 / 0.06 };

function onlineAxisVelocity(v) {
  const tr = state.velTrack;
  const t = performance.now() / 1000;
  const p = state.pose;
  const fresh = tr.p && t - tr.t > 1e-3 && t - tr.t < 1;
  for (const ax of AXES) {
    const plc = v[`${ax}ActVel`];
    if (typeof plc === 'number' && PLC_ACT_VEL[ax]) state.axisVel[ax] = plc * PLC_ACT_VEL[ax];
    else state.axisVel[ax] = fresh ? 0.5 * state.axisVel[ax] + 0.5 * (p[ax] - tr.p[ax]) / (t - tr.t) : 0;
  }
  tr.p = { ...p };
  tr.t = t;
}

// --- tryb online -------------------------------------------------------------------

function onlineValues(v) {
  state.online.values = v;
  if (state.mode !== 'online') return;
  const m = { ...state.machine };
  for (const k of MACHINE_KEYS) if (typeof v[k] === 'number') m[k] = v[k];
  // tryb z PLC (bez flag - pila); srednica polerki tylko z Parametrow wizualizacji
  m.mode = currentMode();
  m.polishDiameter = readFields('m').polishDiameter || m.polishDiameter;
  const toolKey = `${m.mode}:${isBased()}`;
  if (toolKey !== state.tool.key) { state.machine = m; toolModeChanged(); }
  if (![v.x, v.y, v.z, v.a, v.b].every((n) => typeof n === 'number')) return;
  const cutStart = Boolean(v.cutStart);
  if (cutStart && !state.online.lastCutStart && state.cfg.autoClearOnStart) clearCuts();
  state.online.lastCutStart = cutStart;
  const areas = JSON.stringify(['board', 'rock'].map((n) => [v[`${n}X`], v[`${n}Y`], v[`${n}Z`], v[`${n}Count`]]));
  if (areas !== state.areasKey) {
    state.areasKey = areas;
    for (const name of ['board', 'rock']) writeArea(name, { count: v[`${name}Count`], points: areaPoints(name) });
    stoneChanged();
  }
  applyPose({ x: v.x, y: v.y, z: v.z, a: v.a, b: v.b }, m);
  onlineAxisVelocity(v);
  refreshOnlineAuto();
  $('#stonePlc').textContent = `Z PLC: grubość ${fmt(m.materialThickness, 0)} mm (fParameterMaterialThickness), góra materiału Z ${fmt(m.materialHeight, 0)} mm (fCutMaterialHeight)`;
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
  if (!state.forms) return;
  try {
    const op = currentOp();
    state.forms.ops[op.id] = readGroup('op', op.fields);
    state.forms.op = op.id;
    state.forms.modeOp = { ...(state.forms.modeOp || {}), [currentMode()]: op.id };
    state.forms.service = state.service;
    state.forms.hmi = state.hmi;
    if (commonFields()) state.forms[commonSlot()] = readGroup('common', commonFields());
    if (state.mode === 'offline' && $('#autoTable').rows.length) state.forms.auto = readAuto();
    if ($('#figFields').children.length) {
      const fig = currentFig();
      state.forms.figs = { ...(state.forms.figs || {}), [fig.id]: readGroup('fig', fig.fields) };
      state.forms.fig = fig.id;
      state.forms.figCtx = readGroup('figctx', FIGURE_CONTEXT_FIELDS);
    }
    localStorage.setItem(STORE_KEY, JSON.stringify({
      units: 'm/min', m: readFields('m'), d: readFields('d'), board: readArea('board'), rock: readArea('rock'), forms: state.forms,
    }));
  } catch { /* brak dostepu do localStorage - formularze tylko w tej sesji */ }
}

function loadForms() {
  const off = state.cfg.offline;
  writeFields('m', off.machine);
  writeFields('d', off.dynamics);
  writeArea('board', off.board);
  writeArea('rock', off.rock);
  state.forms = { op: 'cut', ops: {}, common: defaults(COMMON_FIELDS), millCommon: defaults(MILL_COMMON_FIELDS), auto: demoAuto() };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) {
      writeFields('m', saved.m || {});
      // starsze zapisy byly w mm/s; puste / zerowe pola (nowe parametry) zostaja z domyslnych
      if (saved.units === 'm/min') writeFields('d', Object.fromEntries(Object.entries(saved.d || {}).filter(([, v]) => v > 0)));
      if (saved.board) writeArea('board', saved.board);
      if (saved.rock) writeArea('rock', saved.rock);
      if (saved.forms) {
        state.service = { ...serviceDefaults(), ...(saved.forms.service || {}) };
        state.hmi = { ...(saved.forms.hmi || {}) };
        state.forms = {
          ...state.forms, ...saved.forms,
          ops: saved.forms.ops || {},
          common: { ...state.forms.common, ...(saved.forms.common || {}) },
          millCommon: { ...state.forms.millCommon, ...(saved.forms.millCommon || {}) },
          auto: saved.forms.auto?.rows ? saved.forms.auto : state.forms.auto,
        };
      }
    }
  } catch { /* jw. */ }
}

// --- formularze operacji (pola z definicji w shared/ops.js) -------------------------------

function fieldHtml(group, f) {
  const attrs = `data-g="${group}" data-k="${f.k}"`;
  if (f.t === 'bool') return `<label class="cb wide"><input type="checkbox" ${attrs}> ${f.label}</label>`;
  if (f.t === 'sel') return `<label>${f.label}<select ${attrs}>${f.o.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>`;
  if (f.t === 'list') return `<label class="wide">${f.label}<input type="text" ${attrs}></label>`;
  const lim = `${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''}`;
  return `<label>${f.label}<input type="number" step="${f.t === 'int' ? 1 : 'any'}"${lim} ${attrs}></label>`;
}

const fieldEl = (group, k) => $(`[data-g="${group}"][data-k="${k}"]`);

// saves - przyciski "Zapisz" punktow (#139): wiersz z przyciskiem za polem Y punktu
function renderGroup(container, group, fields, values, saves = []) {
  container.innerHTML = fields.filter((f) => !f.svc).map((f) => fieldHtml(group, f) + saves.filter((sv) => (sv.y ?? sv.z) === f.k).map((sv) => saveHtml(group, sv)).join('')).join('');
  writeGroup(group, fields, values);
  applyVisibility(group, fields);
  for (const el of container.querySelectorAll('[data-g]')) {
    el.addEventListener('input', () => { applyVisibility(group, fields); offlineFormsChanged(); });
  }
  for (const b of container.querySelectorAll('[data-save-x]')) b.onclick = () => savePoint(group, fields, b.dataset.saveX, b.dataset.saveY);
  for (const b of container.querySelectorAll('[data-save-z]')) b.onclick = () => savePoint(group, fields, null, null, b.dataset.saveZ);
}

function saveHtml(group, sv) {
  // sam Z (polerowanie: bSaveZ - aktualna pozycja osi Z jako fHeightPosition)
  if (sv.z) {
    const tz = `Wpisz aktualną pozycję osi Z jako ${sv.name}${sv.plc ? ` (jak w PLC: ${sv.plc})` : ''}`;
    return `<div class="saveRow wide" data-save-group="${group}" data-save-of="${sv.z}"><button data-save-z="${sv.z}" title="Zapisz ${sv.name}: ${tz}">${icon('save')}${icon('arrowDown')}Z</button></div>`;
  }
  const title = `Wpisz aktualną pozycję osi X / Y jako ${sv.name}${sv.plc ? ` (jak w PLC: ${sv.plc})` : ''}`;
  return `<div class="saveRow wide" data-save-group="${group}" data-save-of="${sv.y}"><button data-save-x="${sv.x}" data-save-y="${sv.y}" title="Zapisz ${sv.name}: ${title}">${icon('save')}${icon('here')}</button></div>`;
}

// Aktualna pozycja jak HMI2.fX/Y/ZActualPosition w PLC (punkt narzedzia z pozycji osi, Settings/ActualPosition) -
// to zapisuja przyciski "Zapisz" w PLC (TO_REAL(TO_DINT(fXActualPosition*100))/100.0), punkty stolu i kamienia,
// punkty reczne A / B / C, Z polerowania. Online - wartosci z PLC nie sa potrzebne (zapis tylko offline).
const actualPosition = () => (state.pose ? plcActualPosition(state.pose, offlineMachine()) : null);

// "Zapisz": aktualna pozycja X / Y (albo Z) do pol punktu (zaokraglenie do 0,01 mm jak w PLC)
function savePoint(group, fields, kx, ky, kz = null) {
  const p = actualPosition();
  if (!p) return;
  if (kx) fieldEl(group, kx).value = savedPosition(p.x);
  if (ky) fieldEl(group, ky).value = savedPosition(p.y);
  if (kz) fieldEl(group, kz).value = savedPosition(p.z);
  applyVisibility(group, fields);
  offlineFormsChanged();
  requestDraw();
}

// Pola z warunkiem show(v) widoczne tylko przy zaznaczonej opcji (np. koniec X/Y tylko przy "dwa punkty")
function applyVisibility(group, fields) {
  const v = readGroup(group, fields);
  const mode = currentMode();
  for (const f of fields) {
    // #145: pola serwisowe (bService..., "(serwis)") od poziomu Serwis
    if (isServiceField(f)) fieldEl(group, f.k)?.closest('label')?.classList.toggle('noaccess', accessLevel() < 2);
    if (!f.show && !f.modes) continue;
    // modes - pole tylko w podanych trybach (#131: w pile ukryte pola frezu i odwrotnie)
    const visible = (!f.show || f.show(v)) && (!f.modes || f.modes.includes(mode));
    const el = fieldEl(group, f.k);
    const box = el?.closest('label');
    if (box) box.hidden = !visible;
    // przycisk "Zapisz" punktu widoczny razem z polem Y punktu
    const save = $(`[data-save-group="${group}"][data-save-of="${f.k}"]`);
    if (save) save.hidden = !visible;
  }
}

function writeGroup(group, fields, values) {
  for (const f of fields) {
    const el = fieldEl(group, f.k);
    if (!el) continue;
    const v = values?.[f.k] ?? f.d;
    if (f.t === 'bool') el.checked = Boolean(v);
    else el.value = Array.isArray(v) ? v.join(', ') : v;
  }
}

function readGroup(group, fields) {
  const out = {};
  for (const f of fields) {
    // bit serwisowy: wartosc z ekranu Ustawienia (pole nie jest w formularzu)
    if (f.svc) { out[f.k] = Boolean(state.service[f.svc] ?? f.d); continue; }
    const el = fieldEl(group, f.k);
    out[f.k] = el ? parseField(f, f.t === 'bool' ? el.checked : el.value) : parseField(f, f.d);
  }
  return out;
}

// Operacje trybu: pila - ops.js (CutST ...), frez - millops.js (przez tools.js), wiercenie / polerowanie - tools.js
const modeOps = () => (currentMode() === 'saw' ? OPS : toolOpsFor(currentMode()));
const currentOp = () => modeOps().find((o) => o.id === $('#op').value) || modeOps()[0];

function fillOpSelect() {
  const ops = modeOps();
  $('#op').innerHTML = ops.map((o) => `<option value="${o.id}">${o.name}</option>`).join('');
  const want = state.forms.modeOp?.[currentMode()] ?? state.forms.op;
  $('#op').value = ops.some((o) => o.id === want) ? want : ops[0].id;
}

function showOp() {
  const op = currentOp();
  $('#opHint').textContent = `Jak w PLC: ${op.plc}`;
  // wspolne pola: pila - glebokosc / wychyl / wyjazd, frez - tablica glebokosci frezu (Depths), wiercenie / polerowanie - brak
  renderCommon();
  renderGroup($('#opFields'), 'op', op.fields, state.forms.ops[op.id] || defaults(op.fields), op.saves);
  updateCutInfo();
  requestDraw();
}

// --- figury automatu (FiguresGeometricSt) ---------------------------------------------------

// Figury trybu: pila - programy ciecia i profili, frez - ProgramAutoMillST
const modeFigures = () => FIGURES.filter((f) => (currentMode() === 'mill' ? f.kind === 'mill' : f.kind !== 'mill'));
const currentFig = () => modeFigures().find((f) => f.id === $('#fig').value) || modeFigures()[0];

function fillFigSelect() {
  const figs = modeFigures();
  $('#fig').innerHTML = figs.map((f) => `<option value="${f.id}">${f.v} ${f.name}${f.kind === 'mill' ? ' (frez)' : ''}</option>`).join('');
  $('#fig').value = figs.some((f) => f.id === state.forms.fig) ? state.forms.fig : figs[0].id;
}

// Rodzaje programu automatu trybu (pole Program) - bufor innego rodzaju zastapiony przykladem / pustym buforem frezu
function fillAutoKinds() {
  const kinds = AUTO_KINDS[currentMode()] || [];
  for (const o of $('#autoKind').options) o.hidden = !kinds.includes(o.value);
  const a = state.forms.auto;
  if (kinds.length && a && !kinds.includes(a.kind)) {
    state.forms.auto = kinds[0] === 'mill' ? { ...a, kind: 'mill', from: 1, rows: [] } : demoAuto();
  }
}

function showFig() {
  const fig = currentFig();
  const kinds = { cut: 'piła – ProgramAutoCutST', profile: 'profile – ProgramAutoProfileST', mill: 'frez – ProgramAutoMillST' };
  $('#figHint').textContent = `Jak w PLC: FigureType.${fig.id} (${fig.v}), ${fig.plc}; program: ${kinds[fig.kind] || fig.kind}`;
  renderGroup($('#figFields'), 'fig', fig.fields, state.forms.figs?.[fig.id] || defaults(fig.fields));
  // litery wymiarow przy polach (jak tekst obok pola na ekranie figury w HMI)
  for (const f of fig.fields) {
    const letter = fieldLetter(fig.id, f);
    const label = fieldEl('fig', f.k)?.closest('label');
    if (!letter || !label) continue;
    // litera i opis w jednym wierszu (etykieta jest kolumna: opis nad polem)
    const text = label.firstChild?.nodeType === Node.TEXT_NODE ? label.firstChild : null;
    const row = document.createElement('span');
    row.className = 'lt';
    row.innerHTML = `<span class="letter">${letter}</span>`;
    if (text) row.append(text.textContent);
    if (text) text.remove();
    label.prepend(row);
  }
  for (const el of $$('#figFields [data-g]')) el.addEventListener('input', showFigPicture);
  showFigPicture();
  $('#figInfo').textContent = '';
}

// #138 rysunek pogladowy figury (obrazki z HMI, wariant wg pol figury; bez obrazka w HMI - schemat SVG)
function showFigPicture() {
  const fig = currentFig();
  const pic = figurePicture(fig.id, readGroup('fig', fig.fields));
  const box = $('#figPic');
  if (!pic) { box.hidden = true; return; }
  box.hidden = false;
  let html = '';
  if (pic.img) html = `<img src="${pic.img}" alt="${fig.name}">`;
  else if (pic.svg) html = pic.svg;
  else if (pic.roof) {
    const [w, h] = pic.size;
    const k = Math.min(1, 320 / (w + 70));
    html = `<div class="roof" style="width:${(w + 70) * k}px;height:${(h + 50) * k}px">`
      + pic.roof.map((r) => {
        // obraz w ukladzie przed obrotem (przy 90 / 270 zamienione boki), srodek w srodku przycisku
        const side = r.angle === 90 || r.angle === 270;
        const [iw, ih] = side ? [r.h, r.w] : [r.w, r.h];
        return `<img src="img/figures/roof_wall${r.wall}_${r.on ? 1 : 0}.png" alt="ściana ${r.wall}" style="left:${(r.x + r.w / 2) * k}px;top:${(r.y + r.h / 2) * k}px;`
          + `width:${iw * k}px;height:${ih * k}px;transform:translate(-50%,-50%) rotate(${r.angle || 0}deg)">`;
      }).join('')
      + pic.labels.map((l) => `<b style="left:${l.x * k}px;top:${l.y * k}px">${l.t}</b>`).join('') + '</div>';
  }
  box.innerHTML = `${html}<div class="src">Rysunek poglądowy – ekran HMI ${pic.screen}</div>`;
}

// "Wypelnij bufor": figura jak FiguresGeometricSt, bufor jak GetDemoProgram (aProgram* := aFigure*)
function fillFigure() {
  const fig = currentFig();
  try {
    const ctx = figureContext(readGroup('figctx', FIGURE_CONTEXT_FIELDS), offlineMachine(), commonValues());
    const buf = fig.build(readGroup('fig', fig.fields), ctx);
    const a = readAuto();
    a.kind = fig.kind;
    a.from = 1;
    a.rows = buf.rows;
    writeAutoHeader(a, true);
    renderAutoTable(a, true);
    state.planSource = 'auto';
    autoChanged();
    $('#figInfo').textContent = `Bufor wypełniony: ${fig.name}, ${buf.count} kroków (iFigureNumber), ${buf.rows.length} punktów`;
  } catch (err) {
    $('#figInfo').innerHTML = `<span style="color:var(--bad)">${fig.name}: ${err.message}</span>`;
  }
}

// Wspolne parametry trybu: pila - ciecie (COMMON_FIELDS), frez - Depths frezu (MILL_COMMON_FIELDS)
const commonFields = () => ({ saw: COMMON_FIELDS, mill: MILL_COMMON_FIELDS })[currentMode()] || null;
const commonSlot = () => (currentMode() === 'mill' ? 'millCommon' : 'common');

function renderCommon() {
  const fields = commonFields();
  const box = $('#commonFields');
  $('#commonBox').hidden = !fields;
  $('#commonBox summary').textContent = currentMode() === 'mill' ? 'Głębokości frezu (Depths), wyjazd' : 'Głębokość, wyjazd';
  if (!fields || box.dataset.mode === currentMode()) return;
  box.dataset.mode = currentMode();
  renderGroup(box, 'common', fields, { ...defaults(fields), ...(state.forms[commonSlot()] || {}) });
}

// Wspolne parametry trybu + szerokosc tarczy z parametrow maszyny
function commonValues() {
  const fields = commonFields() || [];
  const v = $('#commonFields').dataset.mode === currentMode() ? readGroup('common', fields) : { ...defaults(fields), ...(state.forms[commonSlot()] || {}) };
  return { ...v, bladeWidth: offlineMachine().bladeWidth };
}

// --- automat (tabela krokow jak lista programu w HMI) -----------------------------------------

const AUTO_COLS = [['x', 'X'], ['y', 'Y'], ['step', 'Krok'], ['r', 'R'], ['angle', 'B°'], ['depth', 'Głęb.'], ['depthEnd', 'Głęb. k.'], ['length', 'Dł.'], ['outIn', 'W/Z']];

function demoAuto() {
  return {
    kind: 'cut', from: 1, ox: 500, oy: 400, pJump: 5, sJump: 100, outerInner: false, sArrays: false,
    rows: [
      { x: 0, y: 0, step: 1 }, { x: 1500, y: 0, step: 4, r: 1000 }, { x: 1500, y: 900, step: 1 },
      { x: 0, y: 900, step: 1 }, { x: 0, y: 0, step: 2 }, { x: 750, y: 450, step: 26, r: 200 },
    ].map((r) => ({ r: 0, angle: 0, depth: 0, depthEnd: 0, length: 0, outIn: 0, ...r })),
  };
}

const stepOptions = (kind) => (kind === 'mill' ? MILL_STEPS : STEPS.filter((st) => kind === 'profile' || !st.prof));

function renderAutoTable(a, editable) {
  const opts = stepOptions(a.kind);
  const dis = editable ? '' : ' disabled';
  let html = `<tr><th>#</th>${AUTO_COLS.map(([, n]) => `<th>${n}</th>`).join('')}</tr>`;
  a.rows.forEach((r, i) => {
    html += `<tr data-row="${i}"><td class="n">${i + 1}</td>`;
    for (const [k] of AUTO_COLS) {
      if (k === 'step') {
        const known = opts.some((o) => o.v === Number(r.step));
        html += `<td><select data-a="${k}" data-i="${i}"${dis}>${opts.map((o) => `<option value="${o.v}"${o.v === Number(r.step) ? ' selected' : ''}>${o.v} ${o.name}</option>`).join('')}${known ? '' : `<option value="${r.step}" selected>${r.step} ?</option>`}</select></td>`;
      } else if (k === 'outIn') {
        html += `<td><select data-a="${k}" data-i="${i}"${dis}>${[[0, '-'], [1, 'zew'], [2, 'wew']].map(([v, n]) => `<option value="${v}"${v === Number(r.outIn) ? ' selected' : ''}>${n}</option>`).join('')}</select></td>`;
      } else {
        html += `<td><input type="number" step="any" data-a="${k}" data-i="${i}" value="${Number(Number(r[k] || 0).toFixed(3))}"${dis}></td>`;
      }
    }
    html += '</tr>';
  });
  $('#autoTable').innerHTML = html;
  for (const el of $$('#autoTable [data-a]')) el.addEventListener('input', autoChanged);
}

const AUTO_HEAD = '#autoKind, #autoFrom, #autoOX, #autoOY, #autoPJump, #autoSJump, #autoRepeatOver';

function writeAutoHeader(a, editable) {
  $('#autoKind').value = a.kind;
  $('#autoFrom').value = a.from ?? 1;
  $('#autoOX').value = a.ox; $('#autoOY').value = a.oy;
  $('#autoPJump').value = a.pJump; $('#autoSJump').value = a.sJump;
  $('#autoRepeatOver').checked = Boolean(a.repeatOver);
  for (const el of $$(AUTO_HEAD)) el.disabled = !editable;
  for (const el of $$('[data-prof]')) el.hidden = a.kind !== 'profile';
  $('#autoEdit').hidden = !editable;
  $('#autoRun').hidden = !editable;
  $('#autoSaveRow').hidden = !editable;
  $('#figBox').hidden = !editable;
}

function readAuto() {
  const rows = [];
  for (const el of $$('#autoTable [data-a]')) {
    const i = Number(el.dataset.i);
    rows[i] ??= {};
    rows[i][el.dataset.a] = Number(el.value) || 0;
  }
  return {
    kind: $('#autoKind').value, from: Math.max(1, Math.round(Number($('#autoFrom').value) || 1)),
    ox: Number($('#autoOX').value) || 0, oy: Number($('#autoOY').value) || 0,
    pJump: Number($('#autoPJump').value) || 1, sJump: Number($('#autoSJump').value) || 50,
    // bServiceCutProgramOuterInner, bServiceSmoothingArrays - z ekranu Ustawienia
    outerInner: Boolean(state.service.bServiceCutProgramOuterInner), sArrays: Boolean(state.service.bServiceSmoothingArrays),
    repeatOver: $('#autoRepeatOver').checked,
    rows: rows.filter(Boolean),
  };
}

const autoOpts = (a) => ({ outerInner: a.outerInner, profileJump: a.pJump, smoothingJump: a.sJump, smoothingArrays: a.sArrays, startIndex: (a.from || 1) - 1 });

function showAuto() {
  if (!state.forms) return;
  if (state.mode === 'online') { state.autoKey = ''; refreshOnlineAuto(); return; }
  const a = state.forms.auto || demoAuto();
  writeAutoHeader(a, true);
  renderAutoTable(a, true);
  updateAutoInfo();
}

function autoChanged() {
  if (state.mode !== 'offline') return;
  const a = readAuto();
  state.forms.auto = a;
  for (const el of $$('[data-prof]')) el.hidden = a.kind !== 'profile';
  saveForms();
  updateAutoInfo();
  requestDraw();
}

function buildAutoProgram(from) {
  const a = readAuto();
  const pb = new ProgramBuilder(from, offlineMachine(), offlineDynamics());
  // frez (#131): ProgramAutoMillST z tablica glebokosci frezu, bProgramReapitingOver - zamkniete ksztalty
  if (a.kind === 'mill') addAutomatMill(pb, a.rows, a.rows.length, [a.ox, a.oy], commonValues(), { closedShapes: a.repeatOver, startIndex: (a.from || 1) - 1 });
  else addAutomat(pb, a.rows, a.rows.length, [a.ox, a.oy], autoOpts(a), commonValues());
  pb.dwell(0.5, 'CutFinish');
  return pb.build();
}

function updateAutoInfo() {
  if (state.mode !== 'offline' || !$('#autoTable').rows.length) return;
  const a = readAuto();
  const d = offlineDynamics();
  let text = `Kroki: ${a.rows.length}`;
  if (a.kind === 'mill' && currentMode() !== 'mill') {
    text += '<br>Bufor frezu (ProgramAutoMillST) – symulacja w trybie frezu (Bazowanie: Frez)';
  } else if (!validDynamics(d)) {
    text += '<br><span style="color:var(--bad)">Uzupełnij parametry dynamiki (wartości &gt; 0)</span>';
  } else {
    try {
      const prog = buildAutoProgram(state.pose || state.cfg.offline.start);
      text += `, czas programu ${formatTime(prog.duration)}`;
      text += outsideWarning((a.kind === 'mill' ? previewMill(a.rows, a.rows.length, [a.ox, a.oy], offlineMachine().millWidth)
        : previewSteps(a.rows, a.rows.length, [a.ox, a.oy], autoOpts(a), commonValues())).map((it) => it.path).filter(Boolean));
    } catch (err) {
      text += `<br><span style="color:var(--bad)">Błąd programu: ${err.message}</span>`;
    }
  }
  $('#autoInfo').innerHTML = text;
}

// Automat w PLC (online): tablice programu, licznik krokow, aktualny krok; w trybie frezu ProgramAutoMillST
// (te same tablice aProgram*, iProgramMillNumber, iActualNumberOfProgramMills, bProgramMillStart)
function onlineAuto() {
  const v = state.online.values;
  if (currentMode() === 'mill') {
    const count = Math.max(0, Math.round(Number(v.progMillCount) || 0));
    return {
      kind: 'mill', count, running: Boolean(v.progMillStart), index: Math.round(Number(v.progMillIndex) || 0),
      rows: v.progX ? rowsFromArrays(v, count) : [],
      origin: [Number(v.progOriginX) || 0, Number(v.progOriginY) || 0],
      opt: { outerInner: false, profileJump: 1, smoothingJump: 50, smoothingArrays: false },
    };
  }
  const profile = Boolean(v.progProfStart) || (!v.progCutStart && Number(v.progProfCount) > 0 && !(Number(v.progCutCount) > 0));
  const count = Math.max(0, Math.round(Number(profile ? v.progProfCount : v.progCutCount) || 0));
  const running = Boolean(profile ? v.progProfStart : v.progCutStart);
  const index = Math.round(Number(profile ? v.progProfIndex : v.progCutIndex) || 0);
  return {
    kind: profile ? 'profile' : 'cut', count, running, index,
    rows: v.progX ? rowsFromArrays(v, count) : [],
    origin: [Number(v.progOriginX) || 0, Number(v.progOriginY) || 0],
    opt: { outerInner: Boolean(v.progOuterInner), profileJump: Number(v.profileJump) || 1, smoothingJump: Number(v.smoothingJump) || 50, smoothingArrays: Boolean(v.smoothingArrays) },
  };
}

function refreshOnlineAuto() {
  if (state.mode !== 'online' || $('.tab[data-tab="auto"]').hidden) return;
  const au = onlineAuto();
  const key = JSON.stringify([au.kind, au.count, au.rows, au.origin, au.opt]);
  if (key !== state.autoKey) {
    state.autoKey = key;
    const a = { kind: au.kind, from: 1, ox: au.origin[0], oy: au.origin[1], pJump: au.opt.profileJump, sJump: au.opt.smoothingJump, outerInner: au.opt.outerInner, sArrays: au.opt.smoothingArrays, rows: au.rows.slice(0, au.count) };
    writeAutoHeader(a, false);
    renderAutoTable(a, false);
    const prog = { profile: 'ProgramAutoProfileST', mill: 'ProgramAutoMillST' }[au.kind] || 'ProgramAutoCutST';
    $('#autoInfo').innerHTML = au.rows.length
      ? `Program z PLC: ${prog}, kroków ${au.count}`
      : 'Brak tablic programu w PLC (aProgramXPosition ...)';
  }
  markAutoRow(au.running ? au.index : -1);
}

function markAutoRow(index) {
  for (const tr of $$('#autoTable tr[data-row]')) tr.classList.toggle('active', Number(tr.dataset.row) === index);
}

// --- podglad planu (linie operacji / kroki automatu) ---------------------------------------

let planCache = { key: '', items: [] };

function planItems() {
  if (!$('#showPlan').checked || !state.forms) return [];
  const bw = state.machine.bladeWidth;
  if (state.mode === 'online') {
    const au = onlineAuto();
    if (!au.count || !au.rows.length) return [];
    const key = JSON.stringify(['on', au.kind, au.rows, au.count, au.origin, au.opt, bw, state.machine.millWidth]);
    if (key !== planCache.key) {
      planCache = { key, items: au.kind === 'mill' ? previewMill(au.rows, au.count, au.origin, state.machine.millWidth)
        : previewSteps(au.rows, au.count, au.origin, au.opt, { bladeWidth: bw }) };
    }
    return planCache.items.map((it) => ({ path: it.path, marks: it.marks, active: au.running && it.i === au.index }));
  }
  if (state.planSource === 'auto') {
    const a = state.forms.auto || demoAuto();
    const key = JSON.stringify(['auto', a, bw]);
    if (key !== planCache.key) {
      planCache = { key, items: a.kind === 'mill'
        ? previewMill(a.rows, a.rows.length, [a.ox, a.oy], offlineMachine().millWidth)
        : previewSteps(a.rows, a.rows.length, [a.ox, a.oy], autoOpts(a), { bladeWidth: bw }) };
    }
    return planCache.items.map((it) => ({ path: it.path, marks: it.marks, active: state.sim.running && it.i === state.sim.index }));
  }
  const op = currentOp();
  const v = state.forms.ops[op.id] || defaults(op.fields);
  const common = { ...(state.forms[commonSlot()] || {}), bladeWidth: bw };
  const key = JSON.stringify(['op', op.id, v, common, state.machine.millWidth]);
  if (key !== planCache.key) {
    let items = [];
    try {
      const lines = op.lines ? op.lines(v, common, state.machine) : [];
      const paths = op.path ? op.path(v, common, state.machine) : [];
      // marks - wlasne punkty akcji (wiercenie: punkt otworu zamiast konca krzyzyka)
      const marks = op.marks ? op.marks(v) : null;
      items = [...lines.map((l) => ({ path: [[l.x0, l.y0], [l.x1, l.y1]] })), ...paths.map((path) => (marks ? { path, marks } : { path }))];
    } catch { /* niepelne dane formularza */ }
    planCache = { key, items };
  }
  return planCache.items;
}

// Ostrzezenie: tor poza kamieniem
function outsideWarning(paths) {
  const rock = rockPolygon();
  if (!rock) return '';
  const out = paths.some((p) => (p || []).some((pt) => pt && !pointInPolygon(pt[0], pt[1], rock)));
  return out ? '<br><span style="color:var(--bad)">Tor wychodzi poza kamień</span>' : '';
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  return m ? `${m} min ${(sec - m * 60).toFixed(0)} s` : `${sec.toFixed(1)} s`;
}

// Offline gora materialu jak w PLC (WorkArea): fCutMaterialHeight := fCuttingBoardZMin - grubosc
function offlineMachine() {
  const m = makeMachine({ ...state.cfg.offline.machine, ...readFields('m'), mode: state.tool.mode });
  const zMin = boardZMin(readArea('board').points);
  if (zMin !== null) m.materialHeight = zMin - m.materialThickness;
  return m;
}
const offlineDynamics = () => dynamicsToInternal(readFields('d'));

function validDynamics(d) {
  return DYNAMICS_KEYS.every((k) => d[k] > 0);
}

function buildOpProgram(from) {
  const op = currentOp();
  const pb = new ProgramBuilder(from, offlineMachine(), offlineDynamics());
  op.build(pb, readGroup('op', op.fields), commonValues());
  pb.dwell(0.5, 'CutFinish');
  return pb.build();
}

function updateCutInfo() {
  if (!state.forms || !$('#opFields').children.length) return;
  const op = currentOp();
  const v = readGroup('op', op.fields);
  const common = commonValues();
  const d = offlineDynamics();
  let text = '';
  try {
    const m = offlineMachine();
    const lines = op.lines ? op.lines(v, common, m) : [];
    const paths = op.path ? op.path(v, common, m) : [];
    if (lines.length) text += `${currentMode() === 'saw' ? 'Linie cięcia' : 'Linie frezu'}: ${lines.length}`;
    // #142: skos tylko dla 0 < B < 90 (GetPositions), inaczej ciecie pionowe
    if (op.id === 'cut' && v.tilt) {
      text += v.b > 0 && v.b < 90 ? `${text ? ', ' : ''}skos B ${v.b}°`
        : '<br><span style="color:var(--bad)">Wychył B poza 0–90° – cięcie bez skosu (jak GetPositions w PLC)</span><br>';
    }
    if (validDynamics(d)) {
      const prog = buildOpProgram(state.pose || state.cfg.offline.start);
      text += `${text ? ', ' : ''}czas programu ${formatTime(prog.duration)}`;
    } else {
      text += '<br><span style="color:var(--bad)">Uzupełnij parametry dynamiki (wartości &gt; 0)</span>';
    }
    text += outsideWarning([...lines.map((l) => [[l.x0, l.y0], [l.x1, l.y1]]), ...paths]);
  } catch (err) {
    text += `<br><span style="color:var(--bad)">Błąd programu: ${err.message}</span>`;
  }
  $('#cutInfo').innerHTML = text;
}

function hasPlcDynamics() {
  const v = state.online.values;
  return Object.keys(plcDynamics(v)).length > 0 || MACHINE_KEYS.some((k) => typeof v[k] === 'number');
}

function fromPlc() {
  const v = state.online.values;
  const pick = (keys) => Object.fromEntries(keys.filter((k) => typeof v[k] === 'number').map((k) => [k, v[k]]));
  writeFields('m', pick(MACHINE_KEYS));
  // przyspieszenia X / Z / A / B wzorami PLC (VelocityAcceleration) z fMaxVelocityJog* i czasow Tacc
  writeFields('d', dynamicsToDisplay(plcDynamics(v)));
  saveForms();
  offlineFormsChanged();
}

function offlineFormsChanged() {
  saveForms();
  updateCutInfo();
  updateAutoInfo();
  updateManInfo();             // predkosci osi na ekranie Reczne (wspolne z Parametrami)
  if (state.mode === 'offline' && !state.sim.running && state.pose) {
    applyPose(state.pose, offlineMachine());
    requestDraw();
  }
}

// --- tryb offline: animacja ------------------------------------------------------

// Przerwanie bazowania (inny ruch, Stop, zmiana trybu) - maszyna niezbazowana, jak BaseHomingST bez END_PROCEDURE
function cancelHoming() {
  if (!state.tool.homing) return;
  state.tool.homing = null;
  state.tool.based = false;
  toolModeChanged();
}

// homing - tryb bazowania, gdy program to bazowanie; bez bazowania (#144) tylko bazowanie; ruchy od Operatora (#145)
function startProgram(program, homing = null) {
  if ((!homing && !isBased()) || accessLevel() < 1) return;
  if (!homing) cancelHoming();
  cncState.active = Boolean(program.cnc);
  cncState.lastTip = null;
  state.tool.homing = homing;
  state.jog = null;
  state.sim.program = program;
  state.sim.t = 0;
  state.sim.running = true;
  state.sim.label = null;
  state.sim.index = null;
  state.sim.lastFrame = performance.now();
  setPauseButtons(true);
  requestAnimationFrame(simFrame);
  ensureSpin();
}

// Pauza / Wznow: ikona i podpowiedz
function setPauseButtons(running) {
  for (const b of $$('.pauseBtn')) {
    b.innerHTML = icon(running ? 'pause' : 'play');
    b.title = running ? 'Pauza' : 'Wznów';
  }
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
  for (let t = sim.t + SIM_STEP; t < tEnd; t += SIM_STEP) recordPose(sim.program.at(t).pose, m);
  res = sim.program.at(tEnd);
  sim.t = tEnd;
  axisVelocityFromProgram(sim.program, tEnd);
  sim.step = res.step;
  if (sim.index !== res.index) markAutoRow(res.index ?? -1);
  sim.label = res.label;
  sim.index = res.index;
  sim.velocity = res.velocity;
  applyPose(res.pose, m);
  if (res.done) {
    sim.running = false;
    sim.velocity = 0;
    zeroAxisVelocity();
    markAutoRow(-1);
    if (state.tool.homing) finishHoming();
  }
  redraw();
  if (sim.running) requestAnimationFrame(simFrame);
}

function stopProgram() {
  state.sim.running = false;
  state.sim.velocity = 0;
  if (!state.jog) zeroAxisVelocity();
  requestDraw();
}

// --- ekran Serwis (#147, HMI serwis i ekrany z niego otwierane) --------------------------------
// Offline wartosci wspolne z symulacja: parametry glowicy i narzedzi (pola Parametrow), bity bService..., predkosc
// jog A, pozycje osi; pozostale zmienne - wartosci HMI (poczatkowe z GVL), zapamietane w przegladarce.
// Online wszystko z PLC (OPC UA), tylko odczyt. Zmienne z indeksem (aMillingBoardX[0]) - element tablicy.

const SVC_MACHINE = {
  'HMI.fParameterHeadRotationDiameter': 'headRotationDiameter', 'HMI.fParameterCutTiltDiameter': 'cutTiltDiameter',
  'HMI.fParameterDiscDiameter': 'discDiameter', 'HMI.fParameterMillTiltDiameter': 'millTiltDiameter', 'HMI.fParameterMillWidth': 'millWidth',
  'HMI.fParameterMillLength': 'millLength', 'HMI.fParameterMillCorrection': 'millCorrection', 'HMI.fParameterDrillLength': 'drillLength',
};
const SVC_DYN = { 'HMI.fJogAVelocity': 'jogAVel' };
const SVC_POSE = { 'HMI2.fXRealPosition': 'x', 'HMI2.fYRealPosition': 'y', 'HMI2.fZRealPosition': 'z', 'HMI2.fAActualPosition': 'a', 'HMI2.fBActualPosition': 'b' };
const svcBitKey = (v) => (v.startsWith('HMI.bService') && SERVICE_BITS.some((b) => b.k === v.slice(4)) ? v.slice(4) : null);
const svcIndex = (v) => /^(.*)\[(\d+)\]$/.exec(v);
// strony z przyciskami u gory (jak glowne ekrany serwisu), reszta z listy "Inne ekrany"
const SVC_MAIN_PAGES = ['main', 'area', 'settings', 'plcvars'];

// Wartosc zmiennej HMI (surowa, jak w PLC)
function svcValue(it) {
  const v = it.v;
  const ix = svcIndex(v);
  if (state.mode === 'online') {
    const k = plcKey(ix ? ix[1] : v);
    const val = k ? state.online.values[k] ?? null : null;
    return ix && Array.isArray(val) ? val[Number(ix[2])] ?? null : val;
  }
  if (ix) {
    const arr = state.hmi[ix[1]];
    return Array.isArray(arr) && arr[Number(ix[2])] !== undefined && arr[Number(ix[2])] !== null ? arr[Number(ix[2])] : it.init ?? 0;
  }
  if (SVC_POSE[v]) return state.pose?.[SVC_POSE[v]] ?? null;
  if (SVC_MACHINE[v]) return Number($(`[data-m="${SVC_MACHINE[v]}"]`)?.value);
  if (SVC_DYN[v]) return Number($(`[data-d="${SVC_DYN[v]}"]`)?.value);
  const bit = svcBitKey(v);
  if (bit) return Boolean(state.service[bit]);
  if (v in state.hmi) return state.hmi[v];
  if (v.startsWith('IoConfig') || v.startsWith('Communication.') || v.startsWith('IOVars.')) return null;   // odczyty sprzetu - tylko online
  return it.init ?? (it.t === 'BOOL' ? false : it.t === 'STRING' ? '' : null);
}

function setSvcValue(it, val) {
  if (state.mode !== 'offline') return;
  const v = it.v;
  const ix = svcIndex(v);
  if (ix) {
    const arr = Array.isArray(state.hmi[ix[1]]) ? [...state.hmi[ix[1]]] : [];
    arr[Number(ix[2])] = val;
    state.hmi[ix[1]] = arr;
    saveForms();
  } else if (SVC_MACHINE[v]) { $(`[data-m="${SVC_MACHINE[v]}"]`).value = val; offlineFormsChanged(); }
  else if (SVC_DYN[v]) { $(`[data-d="${SVC_DYN[v]}"]`).value = val; offlineFormsChanged(); }
  else if (svcBitKey(v)) { state.service[svcBitKey(v)] = Boolean(val); serviceChanged(); }
  else { state.hmi[v] = val; saveForms(); }
  syncService(true);
}

// Widocznosc elementu jak w HMI: "GVL.zmienna = TRUE / FALSE" (inne warunki - widoczny)
function svcVisible(it) {
  const m = /^\s*([\w.[\]]+)\s*=\s*(TRUE|FALSE)\s*$/.exec(it.vis || '');
  if (!m) return true;
  return Boolean(svcValue({ v: m[1], t: 'BOOL' })) === (m[2] === 'TRUE');
}

const svcAll = () => {
  const all = SERVICE_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items));
  const extra = extraServiceGroup(all);
  return extra ? [...all, ...extra.items] : all;
};

function svcItemHtml(it, i, ro) {
  const id = `data-svc-i="${i}"`;
  const tip = `${it.v ? `HMI: ${it.v}` : ''}${it.use ? `\n${it.use}` : ''}${it.note ? `\n${it.note}` : ''}${it.vis ? `\nWidoczny: ${it.vis}` : ''}`.replace(/"/g, '&quot;');
  const code = it.v ? `<code>${it.v}</code>` : '';
  const dis = ro ? ' disabled' : '';
  switch (it.k) {
    case 'num':
      return `<label class="svcItem" title="${tip}">${it.label ?? it.v}<span class="row2"><input type="number" step="any" ${id}${dis}>${it.unit ? `<span class="unit">${it.unit}</span>` : ''}</span>${code}</label>`;
    case 'sel':
      return `<label class="svcItem" title="${tip}">${it.label ?? it.v}<select ${id}${dis}>${it.o.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>${code}</label>`;
    case 'text':
      return `<label class="svcItem wide" title="${tip}">${it.label ?? it.v}<input type="text" ${id}${dis}>${code}</label>`;
    case 'display':
    case 'textout':
      return `<div class="svcItem${it.k === 'textout' ? ' wide' : ''}" title="${tip}">${it.label ?? it.v}<output ${id}></output>${code}</div>`;
    case 'lamp':
      return `<div class="svcItem lamp" title="${tip}"><span class="svcLamp" ${id}></span><span>${it.label ?? it.v}</span></div>`;
    case 'bit':
      return `<div class="svcItem" title="${tip}">${it.label ? `<span>${it.label}</span>` : ''}<button type="button" class="svcBit" ${id}${dis}></button>${code}</div>`;
    case 'button':
      return `<div class="svcItem" title="${tip}"><button type="button" class="svcBtn" ${id}${ro || !it.act ? ' disabled' : ''}>${it.label ?? it.v}</button>${code}</div>`;
    case 'goto':
      return `<div class="svcItem" title="HMI: ${it.hmi}${it.page || it.tab ? '' : ' – brak w Visu3D'}"><button type="button" class="svcGoto" ${id}${it.page || it.tab ? '' : ' disabled'}>${it.label}</button></div>`;
    case 'dead':
      return `<div class="svcItem" title="${tip}"><button type="button" class="svcBtn" disabled>${it.label}</button></div>`;
    default: return '';
  }
}

// Bity bService... uzywane przez Visu3D, ktorych nie ma na ekranach serwisowych HMI - dodatkowa grupa na stronie
// ustawien serwisowych (jedno miejsce na wszystkie bity serwisowe)
function extraServiceGroup(all = SERVICE_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items))) {
  const onScreens = new Set(all.map((it) => it.v));
  const items = SERVICE_BITS.filter((b) => !onScreens.has(`HMI.${b.k}`))
    .map((b) => ({ k: 'bit', v: `HMI.${b.k}`, t: 'BOOL', label: b.label, off: 'WYŁĄCZONE', on: 'ZAŁĄCZONE', use: 'Bit serwisowy używany przez programy w Visu3D (brak na ekranach serwisowych HMI)' }));
  return items.length ? { title: 'Pozostałe bity serwisowe (programy w Visu3D)', items } : null;
}

function showServicePage(id) {
  state.servicePage = id;
  renderService();
}

function renderService() {
  const ro = state.mode === 'online';
  for (const b of $$('#servicePages [data-spage="plcvars"]')) b.hidden = !ro;
  if (state.servicePage === 'plcvars' && !ro) state.servicePage = 'main';
  for (const b of $$('#servicePages [data-spage]')) {
    b.classList.toggle('active', b.dataset.spage === state.servicePage);
    b.onclick = () => showServicePage(b.dataset.spage);
  }
  // pozostale ekrany serwisowe HMI - lista
  const more = $('#serviceMore');
  more.innerHTML = `<option value="">Inne ekrany serwisowe…</option>${SERVICE_PAGES.filter((p) => !SVC_MAIN_PAGES.includes(p.id))
    .map((p) => `<option value="${p.id}">${p.title}</option>`).join('')}`;
  more.value = SVC_MAIN_PAGES.includes(state.servicePage) ? '' : state.servicePage;
  more.classList.toggle('active', Boolean(more.value));
  more.onchange = () => { if (more.value) showServicePage(more.value); };
  // strona Zmienne PLC (diagnostyka OPC UA)
  const vars = state.servicePage === 'plcvars';
  $('#plcVarsBox').hidden = !vars;
  $('#servicePage').hidden = vars;
  if (vars) {
    $('#serviceHint').textContent = 'Zmienne PLC czytane przez Visu3D: węzeł OPC UA, typ danych, ostatnia wartość.';
    refreshPlcVars();
    return;
  }
  const page = SERVICE_PAGES.find((p) => p.id === state.servicePage) || SERVICE_PAGES[0];
  $('#serviceHint').textContent = `${page.title} – jak ekran HMI ${page.hmi}. ${page.note ? `${page.note} ` : ''}`
    + (ro ? 'Wartości z PLC (tylko odczyt).' : 'Symulacja: parametry głowicy i narzędzi, bity bService… i prędkość jog A są wspólne z resztą aplikacji; pozostałe wartości jak w HMI, zapamiętane w przeglądarce; odczyty sprzętu (falowniki, wejścia) tylko w trybie PLC.');
  const all = svcAll();
  const extra = page.id === 'settings' ? extraServiceGroup() : null;
  $('#servicePage').innerHTML = [...page.groups, ...(extra ? [{ ...extra, items: all.slice(all.length - extra.items.length) }] : [])]
    .map((g) => `<div class="svcCard">${g.title ? `<h4>${g.title}</h4>` : ''}<div class="svcItems">${
      g.items.map((it) => svcItemHtml(it, all.indexOf(it), ro)).join('')}</div></div>`).join('');
  for (const el of $$('#servicePage [data-svc-i]')) {
    const it = all[Number(el.dataset.svcI)];
    if (el.tagName === 'INPUT' && el.type === 'number') {
      el.addEventListener('change', () => {
        const n = Number(el.value);
        if (!Number.isFinite(n)) return;
        const raw = it.gain ? n / it.gain : n;
        setSvcValue(it, Math.min(it.max ?? Infinity, Math.max(it.min ?? -Infinity, raw)));
      });
    } else if (el.tagName === 'INPUT') {
      el.addEventListener('change', () => setSvcValue(it, el.value));
    } else if (el.tagName === 'SELECT') {
      el.addEventListener('change', () => setSvcValue(it, Number(el.value)));
    } else if (it.k === 'bit') {
      el.onclick = () => setSvcValue(it, !svcValue(it));
    } else if (it.k === 'goto') {
      el.onclick = () => { if (it.page) showServicePage(it.page); else if (it.tab && !$(`.tabs [data-tab="${it.tab}"]`).hidden) showTab(it.tab); };
    } else if (it.k === 'button' && it.act) {
      bindServiceAction(el, it, all);
    }
  }
  syncService(true);
}

// Akcje przyciskow serwisu w symulacji
function bindServiceAction(el, it, all) {
  const [kind, a1, a2] = it.act.split(':');
  if (kind === 'jog') {
    // JOG obrot / wychyl (bManualA/BJogLeft/Right) - trzymany
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const { vel, acc } = jogVelocity(a1, offlineDynamics(), false);
      startJog({ [a1]: Number(a2) }, vel, acc);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, releaseJog);
  } else if (kind === 'limit') {
    // zapis krancowki (WorkArea: fServiceX/Y/ZLimit... := aktualna pozycja osi) - A w PLC nie obslugiwane
    el.onclick = () => {
      if (!state.pose || a1 === 'a') return;
      const target = all.find((x) => x.v === `HMI.fService${a1.toUpperCase()}Limit${a2 === 'min' ? 'Negative' : 'Positive'}`);
      if (target) setSvcValue(target, savedPosition(state.pose[a1]));
    };
  } else if (kind === 'millpt') {
    // WorkArea: iMillingBoardSave = n -> aMillingBoardX/Y/Z[n-1] := fX/Y/ZActualPosition (punkt narzedzia)
    el.onclick = () => {
      const p = actualPosition();
      if (!p) return;
      const i = Number(a1) - 1;
      for (const ax of ['X', 'Y', 'Z']) setSvcValue({ v: `HMI.aMillingBoard${ax}[${i}]` }, savedPosition(p[ax.toLowerCase()]));
    };
  } else if (kind === 'set') {
    el.onclick = () => setSvcValue(it, Number.isFinite(Number(a1)) ? Number(a1) : a1);
  }
}

function syncService(force = false) {
  const all = svcAll();
  for (const el of $$('#servicePage [data-svc-i]')) {
    const it = all[Number(el.dataset.svcI)];
    el.closest('.svcItem')?.classList.toggle('noaccess', !svcVisible(it));
    if (!it.v || it.k === 'button' || it.k === 'goto') continue;
    const raw = svcValue(it);
    if (it.k === 'bit' || it.k === 'lamp') {
      const on = Boolean(raw);
      el.classList.toggle('on', on);
      if (it.k === 'bit') el.textContent = (on ? it.on : it.off) ?? (on ? 'ZAŁĄCZONE' : 'WYŁĄCZONE');
      continue;
    }
    if (it.k === 'sel') {
      if (force || el !== document.activeElement) el.value = raw ?? '';
      continue;
    }
    if (it.k === 'text' || it.k === 'textout') {
      const txt = Array.isArray(raw) ? raw.filter(Boolean).slice(0, 10).join(', ') : (raw ?? '');
      if (el.tagName === 'OUTPUT') el.textContent = txt || '–';
      else if (force || el !== document.activeElement) el.value = txt;
      continue;
    }
    const val = typeof raw === 'number' && Number.isFinite(raw) ? (it.gain ? raw * it.gain : raw) : null;
    const txt = val === null ? '' : val.toFixed(it.dec ?? 2);
    if (el.tagName === 'OUTPUT') el.textContent = txt || '–';
    else if (force || el !== document.activeElement) el.value = txt;
  }
}

// --- ekran Predkosc (#146, HMI predkosc) -----------------------------------------------------
// Grupy jak w HMI: przesuw szybki, przesuw roboczy (pila / frez wg trybu), Z dojazd, Z praca, silnik glowny.
// Offline: pole i +/- (przytrzymanie powtarza: +/-1 % maksimum na krok jak PLC przy trzymaniu przycisku, silnik +/-0,1 Hz)
// zmieniaja dynamike symulacji (te same pola co Parametry) i czestotliwosc pily. Online: wartosci z PLC (tylko odczyt),
// procent jak HMI2.iVelocity...Precent = predkosc / maksimum.

const M_MIN = 0.06;   // mm/s -> m/min

function speedGroups() {
  const online = state.mode === 'online';
  const v = state.online.values;
  const mx = state.cfg.offline.speedMax || { fast: 20, saw: 10, mill: 2, zUp: 3, zWork: 3, mainDrive: 200 };
  const saw = currentMode() === 'saw';
  // wartosc i maksimum w m/min (Hz dla silnika): online z PLC (mm/s), offline z pol dynamiki (m/min)
  const plc = (k) => (typeof v[k] === 'number' ? v[k] * M_MIN : null);
  const d = (k) => Number($(`[data-d="${k}"]`)?.value);
  return [
    { k: 'fast', icon: 'continuous', title: 'Przesuw szybki', plc: 'fVelocityFast', field: 'fastVel', unit: 'm/min', dec: 2,
      value: online ? plc('fastVel') : d('fastVel'), max: online ? plc('maxFastVel') : mx.fast },
    { k: 'work', icon: saw ? 'saw' : 'mill', title: saw ? 'Przesuw roboczy – piła' : 'Przesuw roboczy – frez',
      plc: saw ? 'fVelocitySawMode' : 'fVelocityMillMode', field: 'cutVel', unit: 'm/min', dec: 2,
      value: online ? plc(saw ? 'cutVel' : 'millVel') : d('cutVel'), max: online ? plc(saw ? 'maxSawVel' : 'maxMillVel') : (saw ? mx.saw : mx.mill) },
    { k: 'zUp', icon: 'arrowUp', title: 'Prędkość osi Z – dojazd', plc: 'fVelocityAxisZApproach', field: 'zUpVel', unit: 'm/min', dec: 3,
      value: online ? plc('zUpVel') : d('zUpVel'), max: online ? plc('maxZUpVel') : mx.zUp },
    { k: 'zWork', icon: 'arrowDown', title: 'Prędkość osi Z – praca', plc: 'fVelocityAxisZWork', field: 'zVel', unit: 'm/min', dec: 3,
      value: online ? plc('zVel') : d('zVel'), max: online ? plc('maxZVel') : mx.zWork },
    { k: 'drive', icon: saw ? 'saw' : 'mill', title: saw ? 'Prędkość silnika głównego (piła)' : 'Prędkość wrzeciona', plc: 'fVelocityMainDrive', unit: 'Hz', dec: 1,
      value: online ? v.mainDriveHz : Number($('#sawFreq').value), max: online ? v.maxMainDriveHz : mx.mainDrive, step: 0.1 },
  ];
}

function renderSpeed() {
  const online = state.mode === 'online';
  const groups = speedGroups();
  $('#speedHint').innerHTML = online
    ? `Jak ekran HMI „predkosc”: wartości z PLC (tylko odczyt).${state.online.values.advancedDesktop ? ' <b>Pulpit rozszerzony</b> (bServiceAdvancedDesktop) – prędkości z potencjometrów pulpitu.' : ''}`
    : 'Jak ekran HMI „predkosc”: wpisz wartość albo +/- (przytrzymaj – szybciej). Zmiana działa od razu w symulacji (te same wartości co w Parametrach).';
  $('#speedGroups').innerHTML = groups.map((g) => `
    <div class="speedGroup" data-speed="${g.k}" title="HMI.${g.plc}">
      <h4>${icon(g.icon)}<span>${g.title}</span></h4>
      <div class="speedBar"><i></i><span></span></div>
      <div class="speedRow">
        <button type="button" data-speed-dec="${g.k}" title="−"${online ? ' disabled' : ''}>−</button>
        <input type="number" step="any" min="0" data-speed-in="${g.k}"${online ? ' disabled' : ''}>
        <span class="unit">${g.unit}</span>
        <button type="button" data-speed-inc="${g.k}" title="+"${online ? ' disabled' : ''}>+</button>
      </div>
      ${g.k === 'drive' ? '<div class="speedRow sub"><span></span><output data-speed-rpm></output><span class="unit">rpm</span><span></span></div>' : ''}
    </div>`).join('');
  for (const el of $$('[data-speed-in]')) el.addEventListener('change', () => setSpeed(el.dataset.speedIn, Number(el.value)));
  for (const b of $$('[data-speed-dec], [data-speed-inc]')) {
    const k = b.dataset.speedDec || b.dataset.speedInc;
    const sign = b.dataset.speedInc ? 1 : -1;
    let timer = null;
    const stepOnce = () => {
      const g = speedGroups().find((x) => x.k === k);
      const step = g.step ?? (g.max > 0 ? g.max / 100 : 0.01);
      setSpeed(k, Math.min(g.max ?? Infinity, Math.max(0, (Number.isFinite(g.value) ? g.value : 0) + sign * step)));
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stepOnce();
      timer = setTimeout(function rep() { stepOnce(); timer = setTimeout(rep, 80); }, 400);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(timer));
  }
  syncSpeed(true);
}

// Offline: nowa predkosc do pol dynamiki (m/min) albo czestotliwosci pily (Hz), LIMIT(0, wartosc, maksimum) jak w PLC
function setSpeed(k, value) {
  if (state.mode !== 'offline' || !Number.isFinite(value)) return;
  const g = speedGroups().find((x) => x.k === k);
  const val = Math.min(g.max ?? Infinity, Math.max(0, value));
  if (k === 'drive') {
    $('#sawFreq').value = +val.toFixed(2);
    requestDraw();
  } else {
    $(`[data-d="${g.field}"]`).value = +val.toFixed(4);
    offlineFormsChanged();
  }
  syncSpeed(true);
}

function syncSpeed(force = false) {
  const p = state.pose;
  if (p) {
    const v = state.online.values;
    const online = state.mode === 'online';
    const tool = online && typeof v.toolX === 'number' ? { x: v.toolX, y: v.toolY, z: v.toolZ } : plcActualPosition(p, state.machine);
    // nad materialem ujemna (jak fStatusActualCutDepth w PLC)
    const depth = online && typeof v.cutDepth === 'number' ? v.cutDepth : penetration(headFrame(p, state.machine), state.machine);
    const a = online && typeof v.aFixed === 'number' ? v.aFixed : p.a;
    $('#speedPos').innerHTML = [['Pozycja osi X [mm]', tool.x], ['Pozycja osi Y [mm]', tool.y], ['Wysokość osi Z [mm]', tool.z],
      ['Kąt obrotu głowicy [°]', a], ['Pozycja wychył [°]', p.b], ['Głębokość [mm]', depth]]
      .map(([t, x]) => `<div><small>${t}</small><b>${fmtAxis(x)}</b></div>`).join('');
  }
  for (const g of speedGroups()) {
    const box = $(`[data-speed="${g.k}"]`);
    if (!box) continue;
    const pct = g.max > 0 && Number.isFinite(g.value) ? Math.round(g.value / g.max * 100) : null;
    box.querySelector('.speedBar i').style.width = `${Math.min(100, Math.max(0, pct ?? 0))}%`;
    box.querySelector('.speedBar span').textContent = pct === null ? '–' : `${pct} %`;
    const inp = box.querySelector('input');
    if ((force || inp !== document.activeElement) && Number.isFinite(g.value)) inp.value = g.value.toFixed(g.dec);
    const rpm = box.querySelector('[data-speed-rpm]');
    if (rpm) rpm.textContent = Number.isFinite(g.value) ? (g.value * 30).toFixed(0) : '–';    // rpm = Hz * 30 (HMI)
  }
}

// --- bity serwisowe (ekran Ustawienia) ----------------------------------------------------------
// Jeden bit dla wszystkich programow (jak HMI.bService... w PLC); zmiana odswieza formularze, plan i informacje.

// Diagnostyka podpiecia zmiennych PLC: kazda zmienna z konfiguracji - znaleziona w OPC UA, typ, ostatnia wartosc
let plcVarsTimer = null;
async function refreshPlcVars() {
  clearTimeout(plcVarsTimer);
  const box = $('#plcVarsBox');
  if (box.hidden || $('.tab[data-tab="service"]').hidden || state.mode !== 'online') return;
  try {
    const r = await (await fetch('api/variables')).json();
    const found = r.variables.filter((v) => v.found).length;
    $('#plcVarsInfo').innerHTML = `${r.status}. Znalezione: <b>${found}/${r.variables.length}</b>`
      + (found < r.variables.length ? ' – <span style="color:var(--bad)">brakujących nie ma w symbol configu PLC albo mają inną nazwę</span>' : '');
    $('#plcVars').innerHTML = '<tr><th></th><th>Zmienna PLC</th><th>Typ</th><th>Wartość</th></tr>' + r.variables.map((v) => `<tr class="${v.found ? '' : 'bad'}">
      <td>${icon(v.found ? 'plc' : 'warn')}</td><td title="${v.key}${v.node ? ` – ${v.node}` : ''}">${v.name}${v.required ? ' <b>*</b>' : ''}</td>
      <td>${v.dataType ?? ''}</td><td>${v.value === null ? '–' : String(v.value)}</td></tr>`).join('');
  } catch {
    $('#plcVarsInfo').textContent = 'Brak diagnostyki zmiennych (serwer VizuApp bez /api/variables)';
  }
  plcVarsTimer = setTimeout(refreshPlcVars, 1000);
}

function serviceChanged() {
  saveForms();
  if (state.forms) {
    showOp();
    showFig();
  }
  // automat: OuterInner / wygladzanie lancuchem - plan i czas programu (tylko gdy tabela jest na ekranie)
  if ($('#autoTable').rows.length) autoChanged();
  offlineFormsChanged();
  requestDraw();
}

// --- logowanie (#145) ----------------------------------------------------------------------------
// Serwer sprawdza haslo (users.json, skroty scrypt) i daje token sesji; strona trzyma token w sessionStorage.
// Bez users.json (i w wersji statycznej) logowanie wylaczone - pelny dostep. Wylogowanie po bezczynnosci
// (auth.timeoutMin z konfiguracji): ruch myszy / klawisz odswieza sesje na serwerze najwyzej co 30 s.

const TOKEN_KEY = 'vizuapp.token';
// wersja statyczna (GitHub Pages): logowanie demonstracyjne - uzytkownik bez hasla, te same poziomy co na maszynie
const DEMO_LEVELS = { Operator: 1, Serwis: 2, Admin: 3 };
const DEMO_PREFIX = 'demo:';
const LEVEL_NAMES = ['Niezalogowany', 'Operator', 'Serwis', 'Admin'];

const accessLevel = () => (state.auth.enabled ? state.auth.level : 3);
const isServiceField = (f) => /\(serwis\)|bService/.test(f.label);

function authChanged() {
  const a = state.auth;
  $('#authBox').hidden = !a.enabled;
  $('#authUser').innerHTML = a.user ? `<b>${a.user}</b>` : 'Niezalogowany';
  $('#loginBtn').innerHTML = icon(a.user ? 'logout' : 'login');
  $('#loginBtn').title = a.user ? `Wyloguj (${a.user})` : 'Zaloguj';
  if (state.forms) {
    showOp();
    showFig();
    applyVisibility('figctx', FIGURE_CONTEXT_FIELDS);
    if (commonFields()) applyVisibility('common', commonFields());
  }
  toolModeChanged();
}

function setSession(s) {
  const a = state.auth;
  a.user = s?.user ?? null;
  a.level = s?.level ?? 0;
  a.token = s?.token ?? (s ? a.token : null);
  a.lastActivity = Date.now();
  a.lastPing = Date.now();
  try { if (a.token) sessionStorage.setItem(TOKEN_KEY, a.token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* jw. */ }
  if (!a.user) {
    // wylogowanie: ruchy stop, okno reczne zamkniete
    stopProgram();
    releaseJog();
  }
  authChanged();
}

const authHeaders = () => (state.auth.token ? { authorization: `Bearer ${state.auth.token}` } : {});

async function initAuth() {
  const a = state.auth;
  a.enabled = Boolean(state.cfg.auth?.enabled);
  a.demo = Boolean(state.cfg.auth?.demo);
  // demo: bez pola hasla, z opisem
  $('#loginPassRow').hidden = a.demo;
  $('#loginDemo').hidden = !a.demo;
  a.users = state.cfg.auth?.users || [];
  a.timeoutMin = state.cfg.auth?.timeoutMin ?? 30;
  $('#loginUser').innerHTML = a.users.map((u) => `<option value="${u}">${u}</option>`).join('');
  if (a.enabled) {
    try { a.token = sessionStorage.getItem(TOKEN_KEY); } catch { a.token = null; }
    if (a.token && a.demo) {
      const user = a.token.startsWith(DEMO_PREFIX) ? a.token.slice(DEMO_PREFIX.length) : null;
      setSession(DEMO_LEVELS[user] ? { user, level: DEMO_LEVELS[user], token: a.token } : null);
    } else if (a.token) {
      const r = await fetch('api/session', { headers: authHeaders() }).catch(() => null);
      setSession(r?.ok ? { ...(await r.json()), token: a.token } : null);
    } else setSession(null);
  } else authChanged();
  bindAuth();
}

function showLogin(open) {
  $('#loginWin').hidden = !open;
  $('#loginErr').textContent = '';
  $('#loginPass').value = '';
  if (open) (state.auth.demo ? $('#loginUser') : $('#loginPass')).focus();
}

async function login(user, password) {
  if (state.auth.demo) {
    if (!DEMO_LEVELS[user]) return;
    setSession({ user, level: DEMO_LEVELS[user], token: DEMO_PREFIX + user });
    showLogin(false);
    return;
  }
  const r = await fetch('api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) })
    .catch(() => null);
  if (!r?.ok) {
    $('#loginErr').textContent = r ? 'Złe hasło' : 'Brak połączenia z serwerem';
    $('#loginPass').value = '';
    return;
  }
  setSession(await r.json());
  showLogin(false);
}

function logout() {
  if (state.auth.token && !state.auth.demo) fetch('api/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
  setSession(null);
}

function bindAuth() {
  $('#loginBtn').onclick = () => (state.auth.user ? logout() : showLogin(true));
  $('#loginClose').onclick = () => showLogin(false);
  $('#loginCancel').onclick = () => showLogin(false);
  $('#loginForm').onsubmit = (e) => { e.preventDefault(); login($('#loginUser').value, $('#loginPass').value); };
  // aktywnosc odswieza sesje na serwerze (najwyzej co 30 s); bezczynnosc dluzej niz timeoutMin - wylogowanie
  const activity = () => {
    const a = state.auth;
    if (!a.user) return;
    a.lastActivity = Date.now();
    if (a.demo || a.lastActivity - a.lastPing < 30000) return;
    a.lastPing = a.lastActivity;
    fetch('api/session', { headers: authHeaders() }).then((r) => { if (r.status === 401) setSession(null); }).catch(() => {});
  };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, activity, { passive: true });
  setInterval(() => {
    const a = state.auth;
    if (a.user && a.timeoutMin > 0 && Date.now() - a.lastActivity > a.timeoutMin * 60000) logout();
  }, 15000);
}

// --- ruchy reczne offline (okno Ruchy reczne, #143) -------------------------------------------

const MAN_WIN_KEY = 'vizuapp.manWin';

function showManWin(open) {
  const win = $('#manWin');
  if (!open) releaseJog();
  win.hidden = !open;
  $('#manOpen').classList.toggle('active', open);
  if (open) {
    placeManWin();
    syncManualWin();
    updateManInfo();
  }
}

// Okno w granicach ekranu (pozycja zapamietana w przegladarce)
function placeManWin(x, y) {
  const win = $('#manWin');
  if (x === undefined) {
    try { ({ x, y } = JSON.parse(localStorage.getItem(MAN_WIN_KEY) || '{}')); } catch { /* jw. */ }
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const maxX = Math.max(0, window.innerWidth - win.offsetWidth);
  const maxY = Math.max(0, window.innerHeight - 40);
  win.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
  win.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
}

// Przesuwanie okna za naglowek (mysz i dotyk)
function bindManWin() {
  const win = $('#manWin');
  const head = $('#manHead');
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
    try { localStorage.setItem(MAN_WIN_KEY, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop })); } catch { /* jw. */ }
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  $('#manOpen').onclick = () => showManWin(win.hidden);
  $('#manClose').onclick = () => showManWin(false);
  window.addEventListener('resize', () => { if (!win.hidden) placeManWin(win.offsetLeft, win.offsetTop); });
}

function startJog(dir, vel, acc, dec) {
  if (state.mode !== 'offline' || !state.pose || !(vel > 0) || !isBased() || accessLevel() < 1) return;
  stopProgram();
  cancelHoming();
  state.sim.program = null;
  state.jog = new JogMotion(dir, vel, acc, dec);
  state.jog.last = performance.now();
  requestAnimationFrame(jogFrame);
}

function releaseJog() {
  if (state.jog) state.jog.release();
  for (const b of $$('#manWin .pressed')) b.classList.remove('pressed');
}

function jogFrame(now) {
  const jog = state.jog;
  if (!jog || state.mode !== 'offline') return;
  const dt = Math.min(0.1, (now - jog.last) / 1000);
  jog.last = now;
  const m = offlineMachine();
  let p = state.pose;
  const n = Math.max(1, Math.ceil(dt / SIM_STEP));
  for (let i = 0; i < n; i++) {
    p = jog.step(p, dt / n, { z: [0, 5000] });    // Z nie powyzej bazy (Z = 0)
    if (i < n - 1) recordPose(p, m);
  }
  state.sim.velocity = jog.dir.x || jog.dir.y || jog.dir.z ? jog.v : 0;
  for (const ax of AXES) state.axisVel[ax] = (jog.dir[ax] || 0) * jog.v;
  applyPose(p, m);
  if (jog.done) { state.jog = null; state.sim.velocity = 0; zeroAxisVelocity(); }
  redraw();
  updateManInfo();
  if (state.jog) requestAnimationFrame(jogFrame);
}

function updateManInfo() {
  const p = state.pose;
  if (!p || $('#manWin').hidden) return;
  const d = offlineDynamics();
  syncManualSpeeds();
  const pts = ['A', 'B', 'C'].filter((k) => state.points[k]).join(', ') || 'brak';
  $('#manInfo').innerHTML = `${state.manContinuous ? 'Tryb ciągły – ruch, dopóki przycisk jest wciśnięty' : `Tryb skok – ruch o ${Number($('#manJump').value) || 0} mm`}; `
    + `ruchy po skosie i interpolowane: ${((state.saw.manual ? d.cutVel : d.fastVel) * 0.06).toFixed(2)} m/min `
    + `(${state.saw.manual ? 'prędkość cięcia – piła ON' : 'prędkość dojazdu'}). Punkty A, B, C (Pozycja): ${pts}.`;
}

// Odczyty i stany przyciskow okna ruchow recznych (pozycje osi, laser, przelaczniki ruchu interpolowanego)
function syncManualWin() {
  const p = state.pose;
  if (!p || $('#manWin').hidden) return;
  // X / Y / Z jak w HMI: fX/Y/ZActualPosition (punkt narzedzia) - online z PLC, offline tym samym wzorem; A / B - osie
  const v = state.online.values;
  const tool = state.mode === 'online' && typeof v.toolX === 'number' ? { x: v.toolX, y: v.toolY, z: v.toolZ } : plcActualPosition(p, state.machine);
  for (const ax of ['x', 'y', 'z', 'a', 'b']) {
    const el = $(`#manPos_${ax}`);
    if (el) el.value = fmtAxis(ax === 'a' || ax === 'b' ? p[ax] : tool[ax]);
  }
  for (const b of $$('#manWin [data-hmi="laser"]')) b.classList.toggle('on', $('#showLaser').checked);
  if (state.manToggle && !state.jog) state.manToggle = null;
  for (const b of $$('#manWin [data-toggle]')) b.classList.toggle('on', b.dataset.hmi === state.manToggle);
}

// Prędkości osi na ekranie Ręczne (#140) - te same pola co jog w Parametrach (data-d), wpisane tu przepisywane tam
function syncManualSpeeds() {
  for (const el of $$('[data-jogvel]')) {
    if (el !== document.activeElement) el.value = $(`[data-d="${el.dataset.jogvel}"]`).value;
  }
}

// bServiceManualRewriteJogSpeed: przy wlaczonej pile (offline - START PIŁY) jog X / Y z predkoscia ciecia, Z robocza
const manualRewrite = () => Boolean(state.service.bServiceManualRewriteJogSpeed) && state.saw.manual;

// Punkty reczne A, B, C (bManualSavePointA..C / bManualMovePointA..C, GoToPositionST) - zapis w przegladarce
const POINTS_KEY = 'vizuapp.points';
// fManualMoveWithTiltDistance (HMI, domyslnie 50 mm)
const MOVE_WITH_TILT_DIST = 50;

function savePoints() {
  try { localStorage.setItem(POINTS_KEY, JSON.stringify(state.points)); } catch { /* jw. */ }
  renderPoints();
}

function renderPoints() {
  for (const k of ['A', 'B', 'C']) {
    const v = state.points[k];
    const el = $(`[data-point-val="${k}"]`);
    if (el) el.textContent = v ? `X ${fmtAxis(v.x)}  Y ${fmtAxis(v.y)}  Z ${fmtAxis(v.z)}  A ${fmtAxis(v.a)}°  B ${fmtAxis(v.b)}°` : '– (nie zapisany)';
  }
}

// Ruch reczny programem (skok, punkt, wychyl): tylko offline, z poprawna dynamika
function manualProgram(build) {
  const d = offlineDynamics();
  if (!validDynamics(d) || state.mode !== 'offline' || !state.pose) return;
  state.manToggle = null;
  startProgram(build(d));
}

// Skok (tryb SKOK, MCRelative / mLinearXYZRelative): o wektor delta, predkosc vel / rampa acc
function stepProgram(delta, vel, acc, step) {
  manualProgram((d) => {
    const pb = new ProgramBuilder(state.pose, offlineMachine(), d);
    const to = Object.fromEntries(Object.entries(delta).map(([ax, v]) => [ax, state.pose[ax] + v]));
    pb.linearTo(to, step, vel, acc, acc);
    return pb.build();
  });
}

// Akcja przycisku okna (data-hmi); hold - przycisk trzymany (puszczenie zatrzymuje ruch)
function manualAction(act) {
  const [kind, arg, arg2] = act.split(':');
  const d = offlineDynamics();
  const p = state.pose;
  if (!p) return;
  const jump = Math.max(0, Number($('#manJump').value) || 0);
  // ruchy po skosie i interpolowane: piła ON - fMaxVelocitySawMode, inaczej fMaxVelocityFast
  const xyVel = state.saw.manual ? [d.cutVel, d.cutAcc] : [d.fastVel, d.fastAcc];
  switch (kind) {
    case 'jog': {
      const sign = Number(arg2);
      const { vel, acc } = jogVelocity(arg, d, manualRewrite());
      if (state.manContinuous) startJog({ [arg]: sign }, vel, acc);
      else if (jump > 0) stepProgram({ [arg]: sign * jump }, vel, acc, 'MCRelative');
      break;
    }
    case 'diag': {
      const dir = diagonalDir(DIAGONALS[arg]);
      if (state.manContinuous) startJog(dir, xyVel[0], xyVel[1]);
      else if (jump > 0) stepProgram({ x: dir.x * jump, y: dir.y * jump }, xyVel[0], xyVel[1], 'MoveDiagonal');
      break;
    }
    case 'interp': {
      // przelacznik jak w HMI: ruch do STOP albo ponownego nacisniecia
      if (state.manToggle === act) { releaseJog(); state.manToggle = null; break; }
      startJog(interpolationDir(arg, p.a, state.cfg.laser?.side ?? 1), xyVel[0], xyVel[1]);
      if (state.jog) state.manToggle = act;
      break;
    }
    case 'tilt': {
      // wzdluz pochylonej tarczy o fManualMoveWithTiltDistance; piła ON - Z robocza, inaczej dojazdowa
      const v = tiltMoveVector(p.a, p.b, MOVE_WITH_TILT_DIST, arg === 'up');
      stepProgram(v, state.saw.manual ? d.zVel : (d.zUpVel || d.zVel), d.zAcc, arg === 'up' ? 'MoveWithTiltUp' : 'MoveWithTiltDown');
      break;
    }
    case 'a': case 'b':
      manualProgram((dd) => gotoProgram(p, { ...p, [kind]: Number(arg) }, dd));
      break;
    case 'goto': {
      const val = Number($(`#${arg}Set`).value);
      // ManualST: B tylko 0..90 (wartosc ujemna z pola HMI nie rusza osi)
      if (!Number.isFinite(val) || (arg === 'b' && (val < 0 || val > 90))) {
        $('#manInfo').innerHTML = '<span style="color:var(--bad)">Wychył B: zadaj 0–90°</span>';
        break;
      }
      manualProgram((dd) => gotoProgram(p, { ...p, [arg]: val }, dd));
      break;
    }
    case 'point': {
      if (arg === 'D') {
        // NAD MATERIAŁ: Z nad material w aktualnym XY / A / B (fParameterAboveMaterialPosition)
        const z = workAxisZ(-(commonValues().above ?? 20), p.b, offlineMachine());
        manualProgram((dd) => gotoProgram(p, { ...p, z: Math.max(0, z) }, dd));
      } else if (state.points[arg]) {
        // punkt zapisany jako punkt narzedzia - dojazd osi do tego punktu przy zapisanych A / B
        manualProgram((dd) => gotoProgram(p, axisFromActual(state.points[arg], offlineMachine()), dd));
      } else {
        $('#manInfo').innerHTML = `<span style="color:var(--bad)">Punkt ${arg} nie jest zapisany – zapisz go w zakładce Pozycja (USTAWIENIA POZYCJI)</span>`;
      }
      break;
    }
    case 'stop':
      stopProgram();
      releaseJog();
      state.manToggle = null;
      break;
    case 'laser':
      $('#showLaser').checked = !$('#showLaser').checked;
      $('#showLaser').dispatchEvent(new Event('change'));
      requestDraw();
      break;
    case 'tab':
      if (!$(`.tabs [data-tab="${arg}"]`).hidden) showTab(arg);
      break;
    case 'continuous':
      state.manContinuous = !state.manContinuous;
      try { localStorage.setItem('vizuapp.manContinuous', state.manContinuous ? '1' : '0'); } catch { /* jw. */ }
      renderContinuous();
      break;
    default: break;
  }
  syncManualWin();
  updateManInfo();
}

// TRYB CIĄGŁY (czerwony) / TRYB SKOK (niebieski) jak przelacznik bManualContinousMode w HMI
function renderContinuous() {
  const b = $('#manContinuous');
  b.innerHTML = icon(state.manContinuous ? 'continuous' : 'step', 'big');
  b.title = state.manContinuous ? 'Tryb ciągły – ruch, dopóki przycisk jest wciśnięty (bManualContinousMode)' : 'Tryb skok – ruch o SKOK [mm]';
  b.classList.toggle('on', state.manContinuous);
}

function bindManual() {
  $('#manScreen_mpg').innerHTML = manualScreenHtml(MANUAL_SCREENS.mpg);
  $('#manScreen_interp').innerHTML = manualScreenHtml(MANUAL_SCREENS.interp);
  for (const b of $$('#manPages [data-page]')) {
    b.onclick = () => {
      for (const x of $$('#manPages [data-page]')) x.classList.toggle('active', x === b);
      for (const sc of $$('#manWin .hmiScreen')) sc.hidden = sc.dataset.page !== b.dataset.page;
      syncManualWin();
    };
  }
  try { state.manContinuous = localStorage.getItem('vizuapp.manContinuous') !== '0'; } catch { state.manContinuous = true; }
  try { state.points = JSON.parse(localStorage.getItem(POINTS_KEY) || '{}') || {}; } catch { state.points = {}; }
  renderContinuous();
  renderPoints();
  for (const el of $$('[data-jogvel]')) {
    el.addEventListener('input', () => {
      $(`[data-d="${el.dataset.jogvel}"]`).value = el.value;
      offlineFormsChanged();
      updateManInfo();
    });
  }
  $('#manJump').addEventListener('input', updateManInfo);
  for (const b of $$('#manWin [data-hmi]')) {
    if ('hold' in b.dataset) {
      // trzymany: ruch od nacisniecia, puszczenie - hamowanie (jog) albo stop (skok, wychyl)
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        b.classList.add('pressed');
        manualAction(b.dataset.hmi);
      });
      const up = () => {
        if (!b.classList.contains('pressed')) return;
        b.classList.remove('pressed');
        releaseJog();
        // ManualInterpolationST: skosy i wychyl tylko trzymane (puszczenie - stop, tez w trybie skok); skok osi (MCRelative) do konca
        if (/^(tilt|diag)/.test(b.dataset.hmi)) stopProgram();
      };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    } else {
      b.onclick = () => manualAction(b.dataset.hmi);
    }
  }
  // punkty A, B, C w zakladce Pozycja: zapis aktualnej pozycji (bManualSavePointA..C)
  for (const b of $$('[data-savepoint]')) {
    b.onclick = () => {
      if (!state.pose) return;
      // SaveManualPoint: aManualX/Y/ZSavedPositions := fX/Y/ZActualPosition (punkt narzedzia) + A / B
      const p = actualPosition();
      state.points[b.dataset.savepoint] = Object.fromEntries(AXES.map((ax) => [ax, savedPosition(p[ax])]));
      savePoints();
      updateManInfo();
    };
  }
  const sawCfg = state.cfg.offline.saw || { freq: 50, dir: 'FWD' };
  $('#sawFreq').value = sawCfg.freq;
  $('#sawDir').value = sawCfg.dir;
  const setSaw = (on) => {
    state.saw.manual = on;
    $('#sawStart').classList.toggle('on', on);
    updateManInfo();
    requestDraw();
  };
  $('#sawStart').onclick = () => setSaw(true);
  $('#sawStop').onclick = () => setSaw(false);
  for (const el of [$('#sawFreq'), $('#sawDir'), $('#showLaser')]) el.addEventListener('input', requestDraw);
}

function setMode(mode) {
  if (state.tool.homing) { state.tool.homing = null; state.tool.based = false; }
  state.mode = mode;
  state.jog = null;
  stopProgram();
  state.sim.program = null;
  for (const b of $$('#mode button')) b.classList.toggle('active', b.dataset.mode === mode);
  state.tool.key = '';
  toolModeChanged();
  if (!$('.tab[data-tab="service"]').hidden) renderService();
  $('#speedBox').hidden = mode !== 'offline';
  $('#stoneOffline').hidden = mode !== 'offline';
  $('#stonePlc').hidden = mode === 'offline';
  for (const el of $$('[data-pt], [data-count], [data-save]')) el.disabled = mode !== 'offline';
  state.areasKey = '';
  clearCuts();
  state.fitted = false;
  if (mode === 'offline') {
    // bez pozycji (start strony): zbazowany tryb z localStorage - B jak po bazowaniu (frez / wiertlo / polerka 90)
    const start = state.pose || { ...state.cfg.offline.start, b: state.tool.based ? modeById(state.tool.mode).homeB : state.cfg.offline.start.b };
    applyPose({ ...start }, offlineMachine());
    writeFields('pos', start);
    restoreOfflineAreas();
    stoneChanged();
    updateCutInfo();
    showAuto();
  } else {
    state.pose = null;
    state.autoKey = '';
    onlineValues(state.online.values);
    if (!$('.tab[data-tab="auto"]').hidden) showAuto();
  }
  try { localStorage.setItem('vizuapp.mode', mode); } catch { /* jw. */ }
  requestDraw();
}

// Tytul panelu: ikona i nazwa ekranu z przycisku w lewym menu
function setPanelTitle(name) {
  const tb = $(`.tabs [data-tab="${name}"]`);
  if (tb) $('#panelTitle').innerHTML = `${tb.innerHTML}<span>${tb.title}</span>`;
}

function showTab(name) {
  for (const x of $$('.tabs button')) x.classList.toggle('active', x.dataset.tab === name);
  setPanelTitle(name);
  for (const p of $$('.tab')) p.hidden = p.dataset.tab !== name;
  if (name === 'speed') renderSpeed();
  if (name === 'service') renderService();
  if (name === 'cut') state.planSource = 'op';
  if (name === 'auto') { state.planSource = 'auto'; showAuto(); }
  if (name === 'cnc') updateCncInfo();
  requestDraw();
}

// Tabele punktow (8 wierszy X / Y / Z + "Poz." - aktualna pozycja osi, jak zapis w PLC)
function buildPointTables() {
  for (const table of $$('table.pts')) {
    const name = table.dataset.pts;
    let html = '<tr><th>#</th><th>X</th><th>Y</th><th>Z</th><th></th></tr>';
    for (let i = 0; i < MAX_APEX; i++) {
      html += `<tr data-row="${i}"><td>${i + 1}</td>`
        + [0, 1, 2].map((c) => `<td><input type="number" step="any" data-pt="${name}" data-i="${i}" data-c="${c}"></td>`).join('')
        + `<td><button data-save="${name}" data-i="${i}" title="Wstaw aktualną pozycję osi X, Y, Z">${icon('here')}</button></td></tr>`;
    }
    table.innerHTML = html;
  }
}

function readArea(name) {
  const count = Math.max(0, Math.min(MAX_APEX, Math.round(Number($(`[data-count="${name}"]`).value) || 0)));
  const cols = [[], [], []];
  for (const el of $$(`[data-pt="${name}"]`)) cols[el.dataset.c][el.dataset.i] = Number(el.value) || 0;
  return { count, points: apexPoints(cols[0], cols[1], cols[2], count) };
}

function writeArea(name, area) {
  const count = Math.max(0, Math.min(MAX_APEX, Math.round(Number(area.count) || 0)));
  $(`[data-count="${name}"]`).value = count;
  for (const el of $$(`[data-pt="${name}"]`)) {
    const v = area.points?.[el.dataset.i]?.[el.dataset.c];
    el.value = v === undefined ? 0 : Number(Number(v).toFixed(3));
  }
  markRows(name, count);
}

function markRows(name, count) {
  for (const tr of $$(`table[data-pts="${name}"] tr[data-row]`)) tr.classList.toggle('off', Number(tr.dataset.row) >= count);
}

// Po powrocie do offline - punkty zapisane w przegladarce (tabele pokazywaly punkty z PLC)
function restoreOfflineAreas() {
  const off = state.cfg.offline;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { /* jw. */ }
  writeArea('board', saved?.board || off.board);
  writeArea('rock', saved?.rock || off.rock);
}

function stoneChanged() {
  for (const name of ['board', 'rock']) markRows(name, Number($(`[data-count="${name}"]`).value) || 0);
  if (state.mode === 'offline') saveForms();
  const board = areaPoints('board');
  const rock = rockPolygon();
  const lines = [];
  const tb = bounds(board);
  if (isArea(board)) {
    lines.push(`Stół: ${(tb[2] - tb[0]).toFixed(0)} × ${(tb[3] - tb[1]).toFixed(0)} mm (X ${tb[0].toFixed(0)} … ${tb[2].toFixed(0)}, Y ${tb[1].toFixed(0)} … ${tb[3].toFixed(0)}), Z min ${boardZMin(board).toFixed(1)}`);
  } else {
    const t = tableExtent([]);
    lines.push(`Stół: mniej niż 3 punkty - przyjęty ${(t[2] - t[0]).toFixed(0)} × ${(t[3] - t[1]).toFixed(0)} mm od (0, 0)`);
  }
  if (rock) {
    const rb = bounds(rock);
    lines.push(`Kamień: ${rock.length} wierzchołków, obrys ${(rb[2] - rb[0]).toFixed(0)} × ${(rb[3] - rb[1]).toFixed(0)} mm`);
    if (isArea(board) && rock.some(([x, y]) => !pointInPolygon(x, y, board))) lines.push('<span style="color:var(--bad)">Kamień wychodzi poza stół</span>');
  } else {
    lines.push('Kamień: mniej niż 3 punkty - materiał rysowany wokół cięć');
  }
  if (state.mode === 'offline') {
    const m = offlineMachine();
    lines.push(`Góra materiału Z ${m.materialHeight.toFixed(1)} mm (Z min stołu − grubość, jak fCutMaterialHeight w PLC)`);
  }
  $('#stoneInfo').innerHTML = lines.join('<br>');
  if (!rock) { state.extent = null; state.extentProvisional = true; }
  if (state.pose) {
    if (state.mode === 'offline' && !state.sim.running) state.machine = offlineMachine();
    growExtent();
  }
  if (state.mode === 'offline') updateCutInfo();
  requestDraw();
}

// --- G-kod / CNC 3D (#124, tylko tryb frezu) -------------------------------------------------
// Plik .nc jak w module CNC PLC: punkt poczatkowy G54 (pozycja osi), ruchy X / Y / Z z pliku, A i B bez zmian.
// Material w obszarze programu jako mapa wysokosci (HeightMap) - frez obniza powierzchnie wzdluz toru.

const cncState = { prog: null, name: '', summary: null, hm: null, hmKey: '', active: false, lastTip: null, paths: null, pathsKey: '' };

const cncMode = () => currentMode() === 'mill' && isBased();

// G54: online z PLC (HMI.G54_X / Y / Z), offline z pol
function cncG54() {
  if (state.mode === 'online') {
    const v = state.online.values;
    return { x: Number(v.g54X) || 0, y: Number(v.g54Y) || 0, z: Number(v.g54Z) || 0 };
  }
  return { x: Number($('#cncX').value) || 0, y: Number($('#cncY').value) || 0, z: Number($('#cncZ').value) || 0 };
}

function cncMachine() {
  return state.mode === 'online' ? state.machine : offlineMachine();
}

// Domyslny G54: naroznik kamienia + 300 mm, Z - czolo frezu na gornej powierzchni (B 90)
function defaultG54(m) {
  const rock = rockPolygon();
  const b = rock ? bounds(rock) : [0, 0, 0, 0];
  return { x: b[0] + 300, y: b[1] + 300 + (cncState.summary ? Math.max(0, -cncState.summary.lo[1]) : 0), z: plcToolAxisZ(0, 90, m) };
}

function writeCncG54(g) {
  $('#cncX').value = Number(g.x.toFixed(3));
  $('#cncY').value = Number(g.y.toFixed(3));
  $('#cncZ').value = Number(g.z.toFixed(3));
}

function cncFormsChanged() {
  if (state.forms) { state.forms.cnc = cncG54(); saveForms(); }
  cncState.hm = null;
  updateCncInfo();
  requestDraw();
}

async function loadCncFile(file) {
  const text = await file.text();
  const prog = parseGcode(text);
  cncState.prog = prog;
  cncState.name = file.name;
  cncState.summary = gcodeSummary(prog, (offlineDynamics().fastVel || 150) * 60);
  cncState.hm = null;
  cncState.active = false;
  if (state.mode === 'offline' && !state.forms?.cnc) writeCncG54(defaultG54(cncMachine()));
  updateCncInfo();
  requestDraw();
}

// Tor czubka narzedzia (swiat) - pamietany dla G54 / narzedzia / A, B
function cncPaths() {
  if (!cncState.prog || !state.pose) return null;
  const m = cncMachine();
  const g = cncG54();
  const key = JSON.stringify([cncState.name, g, m.millWidth, m.millTiltDiameter, m.millLength, m.cutTiltDiameter, m.millCorrection, Math.round(state.pose.a * 100), Math.round(state.pose.b * 100)]);
  if (key !== cncState.pathsKey) {
    cncState.pathsKey = key;
    cncState.paths = cncTipPath(cncState.prog, g, state.pose, m, 3);
  }
  return cncState.paths;
}

// Mapa wysokosci na obszarze toru (z marginesem promienia frezu), gora i spod kamienia
function cncHeightMap() {
  const paths = cncPaths();
  if (!paths) return null;
  const m = cncMachine();
  const r = Math.max(1, toolSize(m).diameter / 2);
  const key = `${cncState.pathsKey}|${m.materialHeight}|${m.materialThickness}`;
  if (cncState.hm && cncState.hmKey === key) return cncState.hm;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of paths) {
    if (p.kind === 'rapid') continue;
    for (const q of p.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  }
  if (!Number.isFinite(x0)) return null;
  const box = [x0 - r - 20, y0 - r - 20, x1 + r + 20, y1 + r + 20];
  // komorka tak, zeby siatka miala najwyzej ok. 400 tys. punktow
  const res = Math.max(1, Math.sqrt((box[2] - box[0]) * (box[3] - box[1]) / 400000));
  const top = topZ(m);
  cncState.hm = new HeightMap(box, top, top - Math.max(1, m.materialThickness), Math.round(res * 10) / 10);
  cncState.hmKey = key;
  cncState.lastTip = null;
  return cncState.hm;
}

// Probka ruchu: czolo frezu obniza mape wysokosci (od poprzedniej probki)
function cncRecord(pose, m) {
  const hm = cncHeightMap();
  if (!hm) return;
  const f = toolFrame(pose, m);
  const tip = f.tip;
  if (cncState.lastTip) hm.carve(cncState.lastTip, tip, Math.max(1, f.radius));
  else hm.stamp(tip[0], tip[1], tip[2], Math.max(1, f.radius));
  cncState.lastTip = tip;
}

// Czy probki ruchu ida na mape wysokosci (program G-kodu offline albo online z wczytanym plikiem w trybie frezu)
const cncRecording = (m) => isToolMode(m) && m.mode === 'mill' && cncState.prog
  && (state.mode === 'online' ? true : cncState.active);

function cncInstant() {
  const hm = cncHeightMap();
  if (!hm) return;
  const m = cncMachine();
  const r = Math.max(1, toolSize(m).diameter / 2);
  const t0 = performance.now();
  for (const p of cncState.paths) {
    if (p.kind === 'rapid') continue;
    for (let k = 1; k < p.pts.length; k++) hm.carve(p.pts[k - 1], p.pts[k], r);
  }
  updateCncInfo(`Wynik od razu: ${((performance.now() - t0) / 1000).toFixed(1)} s obliczeń`);
  requestDraw();
}

function cncStart() {
  if (state.mode !== 'offline' || !cncState.prog || !cncMode()) return;
  const d = offlineDynamics();
  if (!validDynamics(d)) return;
  const m = offlineMachine();
  cncHeightMap();
  const prog = cncProgram(state.pose, cncState.prog, cncG54(), m, d, { zAbove: commonValues().above ?? 20, step: 3 });
  prog.cnc = true;
  startProgram(prog);
  cncState.active = true;
  cncState.lastTip = null;
}

const fmtMm = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');

function updateCncInfo(extra = '') {
  if (!$('#cncInfo')) return;
  const online = state.mode === 'online';
  for (const el of $$('#cncX, #cncY, #cncZ, #cncSet button')) el.disabled = online;
  $('#cncRun').hidden = online;
  if (online) writeCncG54(cncG54());
  const s = cncState.summary;
  $('#cncName').textContent = cncState.prog ? `${cncState.name}: ${cncState.prog.lines} linii` : 'Brak pliku – wczytaj program G-kodu (.nc)';
  if (!s) { $('#cncInfo').innerHTML = cncMode() ? '' : '<span style="color:var(--bad)">G-kod tylko w trybie frezu (po bazowaniu)</span>'; return; }
  const m = cncMachine();
  const lines = [
    `Ruchy: ${s.moves} (posuw ${(s.feedLen / 1000).toFixed(1)} m, szybkie ${(s.rapidLen / 1000).toFixed(1)} m), czas ok. ${formatTime(s.time)}`,
    `Zakres programu: X ${fmtMm(s.lo[0])} … ${fmtMm(s.hi[0])}, Y ${fmtMm(s.lo[1])} … ${fmtMm(s.hi[1])}, Z ${fmtMm(s.lo[2])} … ${fmtMm(s.hi[2])} mm`,
    `Frez Ø${fmtMm(toolSize(m).diameter)} mm (fParameterMillWidth); najgłębiej Z ${fmtMm(s.hi[2])} mm pod G54_Z`,
  ];
  // CNC w PLC nie rusza A / B - frez musi byc pionowo (B 90 po bazowaniu)
  if (state.pose && Math.abs(state.pose.b - 90) > 0.5) lines.push(`<span style="color:var(--bad)">Wychył B ${fmtMm(state.pose.b)}° – frez nie jest pionowo. Program CNC (jak w PLC) nie rusza A / B: ustaw B 90° (Bazowanie, Ręczne albo Pozycja)</span>`);
  if (s.hi[2] > m.materialThickness) lines.push(`<span style="color:var(--bad)">Program schodzi ${fmtMm(s.hi[2])} mm – głębiej niż grubość kamienia (${fmtMm(m.materialThickness)} mm)</span>`);
  const hm = cncState.hm;
  if (hm && hm.cut) lines.push(`Materiał: obrobione ${(hm.cut * hm.res * hm.res / 100).toFixed(0)} cm², najgłębiej ${fmtMm(hm.top - hm.minZ())} mm (siatka co ${hm.res} mm)`);
  if (cncState.prog.warnings.length) lines.push(`<span style="color:var(--bad)">Uwagi: ${cncState.prog.warnings.slice(0, 5).join('; ')}${cncState.prog.warnings.length > 5 ? ' …' : ''}</span>`);
  if (!cncMode()) lines.push('<span style="color:var(--bad)">G-kod tylko w trybie frezu (po bazowaniu)</span>');
  if (extra) lines.push(extra);
  $('#cncInfo').innerHTML = lines.join('<br>');
}

function bindCnc() {
  $('#cncFile').onchange = (e) => { const f = e.target.files?.[0]; if (f) loadCncFile(f); e.target.value = ''; };
  for (const el of $$('#cncX, #cncY, #cncZ')) el.addEventListener('input', cncFormsChanged);
  for (const b of $$('[data-g54]')) {
    b.onclick = () => {
      if (!state.pose) return;
      const g = cncG54();
      const r = (cncMachine().millWidth || 0) / 2;
      const k = b.dataset.g54;
      if (k === 'x') g.x = state.pose.x;
      if (k === 'y') g.y = state.pose.y;
      if (k === 'z') g.z = state.pose.z;
      if (k === 'xr') g.x = state.pose.x + r;
      if (k === 'yr') g.y = state.pose.y + r;
      writeCncG54(g);
      cncFormsChanged();
    };
  }
  $('#cncShowPath').onchange = requestDraw;
  // przyklad: plaskorzezba Madonny (Dodatkowe Programy w repo glownym), frez fi 25
  $('#cncExample').onclick = async () => {
    const name = 'madonna_frez_fi25mm_fixed.nc';
    try {
      const res = await fetch(`examples/${name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadCncFile(new File([await res.text()], name));
    } catch (err) {
      $('#cncName').textContent = `Nie udało się wczytać przykładu: ${err.message}`;
    }
  };
  $('#cncStart').onclick = cncStart;
  $('#cncInstant').onclick = cncInstant;
  $('#cncClear').onclick = () => { cncState.hm = null; cncState.lastTip = null; updateCncInfo(); requestDraw(); };
  if (state.forms?.cnc) writeCncG54(state.forms.cnc);
}

// Podglad 2D w panelu (#124): mapa wysokosci z cieniowaniem i pozycja frezu; odswiezanie najwyzej co 0,3 s
function drawCncPreview(now) {
  const cv = $('#cncPreview');
  const hm = cncState.hm;
  if (!cv || $('.tab[data-tab="cnc"]').hidden) return;
  if (!hm || !hm.cut || currentMode() !== 'mill') { cv.hidden = true; $('#cncPreviewHint').hidden = false; return; }
  const key = `${hm.version}|${state.pose?.x}|${state.pose?.y}`;
  if (key === cncState.previewKey || now - (cncState.previewAt || 0) < 300) return;
  cncState.previewKey = key;
  cncState.previewAt = now;
  cv.hidden = false;
  $('#cncPreviewHint').hidden = true;
  if (cv.width !== hm.nx || cv.height !== hm.ny) { cv.width = hm.nx; cv.height = hm.ny; }
  const ctx = cv.getContext('2d');
  ctx.putImageData(new ImageData(shadeHeightMap(hm), hm.nx, hm.ny), 0, 0);
  if (state.pose) {
    const tip = toolFrame(state.pose, cncMachine()).tip;
    const px = (tip[0] - hm.x0) / hm.res;
    const py = hm.ny - 1 - (tip[1] - hm.y0) / hm.res;
    const r = Math.max(2, toolSize(cncMachine()).diameter / 2 / hm.res);
    ctx.strokeStyle = '#d62728';
    ctx.lineWidth = Math.max(1.5, hm.nx / 200);
    ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#d62728';
    ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, hm.nx / 150), 0, 2 * Math.PI); ctx.fill();
  }
}

// Widok: mapa wysokosci i tor - tylko w trybie frezu
function drawCnc() {
  const show = cncState.prog && currentMode() === 'mill';
  // podsumowanie materialu w trakcie animacji - najwyzej co 1 s
  const now = performance.now();
  if (show && cncState.hm && !$('.tab[data-tab="cnc"]').hidden && now - (cncState.infoAt || 0) > 1000) {
    cncState.infoAt = now;
    updateCncInfo();
  }
  view.setHeightMap(show ? cncState.hm : null);
  // kamien nad reliefem prawie przezroczysty (inaczej gorna sciana bryly rozmywa wynik)
  view.setMaterialOpacity(show && cncState.hm && cncState.hm.cut ? 0.18 : 0.72);
  drawCncPreview(now);
  const paths = show && $('#cncShowPath').checked ? cncPaths() : null;
  view.setCncPath(paths, paths ? cncState.pathsKey : null);
}

// --- bazowanie i tryb pracy (BaseHomingST) ------------------------------------------------

// Tryb: online z PLC (bMode*, bez flag - pila), offline - po ostatnim bazowaniu
function currentMode() {
  if (state.mode === 'online') return modeFromValues(state.online.values) || 'saw';
  return state.tool.mode;
}

// Zbazowana: online bSystemBased (brak zmiennej w PLC - tak), offline - po bazowaniu (przerwane = nie)
function isBased() {
  if (state.mode === 'online') return state.online.values.systemBased !== false;
  return state.tool.based && !state.tool.homing;
}

// Zakladki: Stol i kamien, Pozycja, Parametry, Bazowanie - zawsze (Pozycja i Parametry tylko offline);
// Manual (operacje), Automat - wg trybu i tylko po bazowaniu (Manual tylko offline); Ruchy reczne (okno z gornego menu, #143) -
// offline, po bazowaniu. Bez bazowania (#144) ustawienia (stol i kamien, Pozycja, Parametry) zablokowane.
// Logowanie (#145): niezalogowany - podglad, Operator - praca, Serwis - Parametry i opcje serwisowe, Admin - parametry figur
const TAB_LEVEL = { stone: 1, cut: 1, cnc: 1, pos: 1, par: 2, speed: 1, service: 2 };

function updateTabs() {
  const mode = modeById(currentMode());
  const based = isBased();
  const level = accessLevel();
  for (const t of $$('.tabs button')) {
    const name = t.dataset.tab;
    let show = state.mode === 'offline' || !('offline' in t.dataset);
    if (['cut', 'auto', 'cnc'].includes(name)) show = show && based && mode.tabs.includes(name);
    // automat offline (edycja bufora) od Operatora, online - podglad PLC
    const need = name === 'auto' ? (state.mode === 'offline' ? 1 : 0) : (TAB_LEVEL[name] ?? 0);
    t.hidden = !show || level < need;
  }
  const manOk = state.mode === 'offline' && based && mode.tabs.includes('man') && level >= 1;
  $('#manOpen').disabled = !manOk;
  $('#manOpen').title = manOk ? 'Ruchy ręczne (jak ekran ruchów ręcznych w HMI) – okno, które można przesuwać i zamknąć'
    : state.mode === 'offline' ? 'Ruchy ręczne – dopiero po bazowaniu' : 'Ruchy ręczne – tylko offline (wizualizacja nie steruje maszyną)';
  if (!manOk) showManWin(false);
  const locked = !based || level < 1;
  $('#lockInfo').hidden = !locked;
  $('#lockInfo').innerHTML = level < 1
    ? 'Niezalogowany – tylko podgląd. Zaloguj się (przycisk <b>Zaloguj</b> u góry), żeby wykonywać ruchy i zmieniać ustawienia.'
    : 'Maszyna niezbazowana – ruchy i ustawienia zablokowane. Zbazuj maszynę w zakładce <b>Bazowanie</b>.';
  for (const el of $$('[data-lock]')) {
    el.inert = locked;
    el.classList.toggle('locked', locked);
  }
  for (const el of $$('[data-level]')) el.classList.toggle('noaccess', level < Number(el.dataset.level));
  for (const b of $$('[data-home], #homeStart')) b.disabled = state.mode !== 'offline' || level < 1;
  const active = $('.tabs button.active');
  if (active && !active.hidden) setPanelTitle(active.dataset.tab);
  // zakladka zniknela (tryb, bazowanie, wylogowanie): online automat, potem Stol i kamien, inaczej pierwsza widoczna
  if (!active || active.hidden) {
    const visible = [...$$('.tabs button')].filter((t) => !t.hidden).map((t) => t.dataset.tab);
    showTab(['auto', 'stone'].find((t) => visible.includes(t) && (t !== 'auto' || state.mode === 'online')) || visible[0]);
  }
}

// Zmiana trybu / bazowania: narzedzie w widoku, zakladki, operacje, figury i rodzaje automatu, napisy trybu
function toolModeChanged() {
  const mode = modeById(currentMode());
  state.tool.key = `${mode.id}:${isBased()}`;
  if (state.forms) {
    fillOpSelect();
    showOp();
    fillAutoKinds();
    fillFigSelect();
    showFig();
    if (!$('.tab[data-tab="auto"]').hidden) showAuto();
  }
  updateTabs();
  // elementy tylko dla trybu (data-modes="saw" / "mill drill polishing" ...), pola kontekstu figur wg modes
  for (const el of $$('[data-modes]')) el.hidden = !el.dataset.modes.split(/\s+/).includes(mode.id);
  if (state.forms) applyVisibility('figctx', FIGURE_CONTEXT_FIELDS);
  const drive = mode.id === 'saw' ? 'Piła' : 'Wrzeciono';
  $('#sawTitle').innerHTML = icon(mode.id === 'saw' ? 'saw' : { mill: 'mill', drill: 'drill', polishing: 'polish' }[mode.id], 'big');
  $('#sawTitle').title = drive;
  $('#sawStart').title = `Start: ${drive.toLowerCase()} (bManualMainDriveOn)`;
  $('#sawStop').title = `Stop: ${drive.toLowerCase()} (bManualMainDriveOff)`;
  renderHoming();
  if (state.mode === 'offline' && state.pose && !state.sim.running) applyPose(state.pose, offlineMachine());
  requestDraw();
}

// Ekran Bazowanie: offline - wybor trybu i bazowanie jak BaseHomingST; online - stan z PLC
function renderHoming() {
  const offline = state.mode === 'offline';
  const mode = modeById(currentMode());
  const target = state.tool.homing || state.tool.target || mode.id;
  for (const b of $$('[data-home]')) {
    b.classList.toggle('active', b.dataset.home === (offline ? target : mode.id));
    b.disabled = !offline || accessLevel() < 1;
  }
  $('#homeStart').hidden = !offline;
  $('#homeStop').hidden = !offline;
  const v = state.online.values;
  const lines = [];
  if (offline) {
    const h = state.tool.homing && modeById(state.tool.homing);
    if (h) lines.push(`Bazowanie w toku: ${h.name} (Z do 0, A na 0 najkrótszą drogą, B na ${h.homeB}°)`);
    else lines.push(isBased() ? `Zbazowana w trybie: <b>${mode.name}</b> (B ${mode.homeB}°)` : '<span style="color:var(--bad)">Maszyna niezbazowana</span> – wybierz tryb i bazuj');
  } else {
    lines.push(`PLC: bSystemBased ${v.systemBased === undefined ? '– (brak zmiennej)' : v.systemBased ? 'TRUE' : '<span style="color:var(--bad)">FALSE</span>'}`);
    lines.push(`Tryb: ${MODES.map((x) => `${x.plc} ${v[x.flag] ? '<b>TRUE</b>' : 'FALSE'}`).join(', ')}`);
  }
  const m = state.mode === 'online' ? state.machine : offlineMachine();
  if (mode.id === 'saw') {
    lines.push(`Narzędzie: tarcza Ø${m.discDiameter} × ${m.bladeWidth} mm (fParameterDiscDiameter, fParameterBladeWidth)`);
  } else {
    const t = toolSize({ ...m, mode: mode.id });
    const src = {
      mill: 'fParameterMillWidth, fParameterMillLength + fParameterMillCorrection',
      drill: 'fParameterMillWidth, fParameterDrillLength + fParameterMillCorrection',
      polishing: 'średnica z Parametrów, fParameterMillCorrection − ActiveTool.Height',
    }[mode.id];
    lines.push(`Narzędzie: ${mode.tool} Ø${t.diameter.toFixed(1)} mm, długość ${t.length.toFixed(1)} mm (${src}); `
      + `oś narzędzia ${(m.millTiltDiameter / 2).toFixed(1)} mm od osi A (fParameterMillTiltDiameter/2)`);
  }
  const names = { cut: 'Manual', auto: 'Automat', man: 'Ruchy ręczne', cnc: 'G-kod' };
  lines.push(`Ekrany trybu: ${mode.tabs.map((t) => names[t]).join(', ')}${isBased() ? '' : ' – po bazowaniu'}`);
  $('#homeInfo').innerHTML = lines.join('<br>');
}

function startHoming(modeId) {
  const d = offlineDynamics();
  if (state.mode !== 'offline' || !validDynamics(d) || !state.pose) return;
  stopProgram();
  state.tool.based = false;
  startProgram(homingProgram(state.pose, modeId, offlineMachine(), d), modeId);
  toolModeChanged();
}

// END_PROCEDURE: bSystemBased, tryb z bBase* - zamiana narzedzia
function finishHoming() {
  state.tool.mode = state.tool.homing;
  state.tool.homing = null;
  state.tool.target = null;
  state.tool.based = true;
  try { localStorage.setItem('vizuapp.toolMode', state.tool.mode); } catch { /* jw. */ }
  toolModeChanged();
}

// --- obsluga przyciskow ------------------------------------------------------------

function bindUi() {
  bindCnc();
  for (const b of $$('#mode button')) b.onclick = () => setMode(b.dataset.mode);
  for (const b of $$('[data-view]')) b.onclick = () => { view.viewName = b.dataset.view; fit(); };
  $('#fit').onclick = fit;
  $('#zoomIn').onclick = () => view.zoom(0.8);
  $('#zoomOut').onclick = () => view.zoom(1.25);
  $('#clear').onclick = () => { clearCuts(); if (state.pose) growExtent(); requestDraw(); };
  $('#showBlade').onchange = requestDraw;
  $('#showFrame').onchange = () => { try { localStorage.setItem('vizuapp.frame', $('#showFrame').checked ? '1' : '0'); } catch { /* jw. */ } requestDraw(); };
  $('#view').ondblclick = fit;

  for (const t of $$('.tabs button')) t.onclick = () => showTab(t.dataset.tab);
  for (const el of $$('[data-m], [data-d]')) el.addEventListener('input', offlineFormsChanged);
  $('#showPlan').onchange = requestDraw;
  // przelaczniki XY i Odleglosci (zapamietywane w przegladarce)
  for (const [id, store] of [['#showMarks', 'vizuapp.marks'], ['#showDist', 'vizuapp.dist']]) {
    $(id).onchange = () => { try { localStorage.setItem(store, $(id).checked ? '1' : '0'); } catch { /* jw. */ } requestDraw(); };
    try { const v = localStorage.getItem(store); if (v !== null) $(id).checked = v === '1'; } catch { /* jw. */ }
  }
  fillOpSelect();
  $('#op').onchange = () => { saveForms(); showOp(); };
  renderCommon();
  for (const el of $$(AUTO_HEAD)) {
    el.addEventListener('input', () => { if (el.id === 'autoKind') renderAutoTable(readAuto(), true); autoChanged(); });
  }
  $('#autoAdd').onclick = () => {
    const a = readAuto();
    const last = a.rows[a.rows.length - 1] || { x: 0, y: 0 };
    a.rows.push({ x: last.x, y: last.y, step: 1, r: 0, angle: 0, depth: 0, depthEnd: 0, length: 0, outIn: 0 });
    renderAutoTable(a, true);
    autoChanged();
  };
  $('#autoDel').onclick = () => { const a = readAuto(); a.rows.pop(); renderAutoTable(a, true); autoChanged(); };
  $('#autoDemo').onclick = () => { const a = demoAuto(); writeAutoHeader(a, true); renderAutoTable(a, true); autoChanged(); };
  fillFigSelect();
  $('#fig').onchange = () => { saveForms(); showFig(); };
  renderGroup($('#figCtx'), 'figctx', FIGURE_CONTEXT_FIELDS, { ...defaults(FIGURE_CONTEXT_FIELDS), ...(state.forms.figCtx || {}) });
  $('#figFill').onclick = fillFigure;
  $('#autoStart').onclick = () => {
    const d = offlineDynamics();
    const kind = readAuto().kind;
    if (!validDynamics(d) || state.mode !== 'offline' || (kind === 'mill') !== (currentMode() === 'mill')) return;
    clearCuts();
    state.planSource = 'auto';
    startProgram(buildAutoProgram(state.pose));
  };

  for (const el of $$('[data-pt], [data-count]')) el.addEventListener('input', stoneChanged);
  for (const b of $$('[data-save]')) {
    b.onclick = () => {
      if (!state.pose) return;
      const name = b.dataset.save;
      const i = Number(b.dataset.i);
      const cols = [0, 1, 2].map((c) => $$(`[data-pt="${name}"][data-c="${c}"]`).map((el) => Number(el.value) || 0));
      // WorkArea: aCuttingBoardX/Y/Z[i] := fX/Y/ZActualPosition (punkt narzedzia, np. spod tarczy w Z)
      const ap = actualPosition();
      [ap.x, ap.y, ap.z].forEach((v, c) => { cols[c][i] = savedPosition(v); });
      const points = cols[0].map((x, k) => [x, cols[1][k], cols[2][k]]);
      writeArea(name, { count: Math.max(readArea(name).count, i + 1), points });
      stoneChanged();
    };
  }
  $('#stoneShow').onclick = () => { if (state.pose) growExtent(); view.viewName = 'top'; fit(); };

  $('#cutStart').onclick = () => {
    const d = offlineDynamics();
    if (!validDynamics(d)) return;
    clearCuts();
    state.planSource = 'op';
    startProgram(buildOpProgram(state.pose));
  };
  const togglePause = () => {
    const sim = state.sim;
    if (!sim.program || sim.t >= sim.program.duration) return;
    sim.running = !sim.running;
    setPauseButtons(sim.running);
    if (sim.running) { sim.lastFrame = performance.now(); requestAnimationFrame(simFrame); }
    requestDraw();
  };
  for (const b of $$('.pauseBtn')) b.onclick = togglePause;
  for (const b of $$('.stopBtn')) {
    b.onclick = () => {
      stopProgram();
      state.sim.program = null;
      markAutoRow(-1);
      cancelHoming();
      requestDraw();
    };
  }

  $('#posGo').onclick = () => {
    const d = offlineDynamics();
    if (!validDynamics(d)) return;
    startProgram(gotoProgram(state.pose, readFields('pos'), d));
  };
  $('#posActual').onclick = () => writeFields('pos', state.pose);

  // tryby bazowania: piktogram narzedzia i B po bazowaniu (nazwa w podpowiedzi)
  const MODE_ICON = { saw: 'saw', mill: 'mill', drill: 'drill', polishing: 'polish' };
  $('#homeModes').innerHTML = MODES.map((x) => `<button data-home="${x.id}" title="${x.name}">${icon(MODE_ICON[x.id], 'big')}<small>B ${x.homeB}°</small></button>`).join('');
  for (const b of $$('[data-home]')) b.onclick = () => { state.tool.target = b.dataset.home; renderHoming(); };
  $('#homeStart').onclick = () => startHoming(state.tool.target || state.tool.mode);
  // automat: punkt startowy z aktualnej pozycji (bProgramSaveStartPosition / bProgramMillStartPointSave)
  $('#autoSaveStart').onclick = () => {
    if (!state.pose || state.mode !== 'offline') return;
    const p = actualPosition();
    $('#autoOX').value = savedPosition(p.x);
    $('#autoOY').value = savedPosition(p.y);
    autoChanged();
  };
  $('#fromPlc').onclick = fromPlc;
  $('#defaults').onclick = () => {
    writeFields('m', state.cfg.offline.machine);
    writeFields('d', state.cfg.offline.dynamics);
    offlineFormsChanged();
  };
}

async function init() {
  installIcons();
  view = new View3D($('#view'));
  state.cfg = await (await fetch('api/config')).json();
  buildPointTables();
  loadForms();
  $('#showFrame').checked = state.cfg.frame.show;
  try { const f = localStorage.getItem('vizuapp.frame'); if (f !== null) $('#showFrame').checked = f === '1'; } catch { /* jw. */ }
  state.tool.mode = state.cfg.offline.mode || 'saw';
  try { state.tool.mode = localStorage.getItem('vizuapp.toolMode') || state.tool.mode; } catch { /* jw. */ }
  if (!MODES.some((x) => x.id === state.tool.mode)) state.tool.mode = 'saw';
  bindUi();
  bindManual();
  bindManWin();
  await initAuth();
  showOp();
  showFig();
  stoneChanged();
  if (!state.cfg.static) connectEvents();
  let mode = state.cfg.plc ? 'online' : 'offline';
  try { mode = localStorage.getItem('vizuapp.mode') || mode; } catch { /* jw. */ }
  // wersja statyczna (GitHub Pages, scripts/build-pages.js): bez serwera VizuApp - tylko tryb offline
  if (state.cfg.static) {
    mode = 'offline';
    $('#mode [data-mode="online"]').hidden = true;
    $('#mode [data-mode="offline"]').title = 'Wersja statyczna (GitHub Pages) - symulacja bez PLC; online tylko z serwerem VizuApp na maszynie';
  }
  setMode(mode);
}

init();

// do testow z konsoli / automatu
window.vizu = { state, AXES, startJog, releaseJog, get view() { return view; }, cnc: { state: cncState, load: loadCncFile, start: cncStart, instant: cncInstant } };
