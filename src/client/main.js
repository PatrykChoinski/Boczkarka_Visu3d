// VizuApp - strona: tryb Online (pozycje z PLC przez serwer, SSE) i Offline (zadane ciecie / pozycja,
// animacja z predkosciami i przyspieszeniami jak w napedach, ruchy reczne), laser, obroty tarczy,
// ciecie w stol, bazowanie (tryb pila / frez / wiercenie / polerowanie - narzedzie i ekrany wg trybu).

import { View3D } from './view3d.js';
import { tableExtent } from './machine3d.js';
import { MAX_APEX, apexPoints, boardZMin, bounds, isArea, pointInPolygon } from '../shared/area.js';
import { machine as makeMachine, headFrame, isToolMode, toolSize, penetration, topZ, radius, lineAngle } from '../shared/geometry.js';
import { CutRecorder } from '../shared/cuts.js';
import { ToolRecorder } from '../shared/toolcuts.js';
import { MODES, AUTO_KINDS, modeById, modeFromValues, homingProgram, toolOpsFor } from '../shared/tools.js';
import { ProgramBuilder, gotoProgram, AXES } from '../shared/motion.js';
import { OPS, COMMON_FIELDS, defaults, parseField, savedPosition } from '../shared/ops.js';
import { STEPS, stepName, addAutomat, previewSteps, rowsFromArrays } from '../shared/automat.js';
import { MACHINE_KEYS, DYNAMICS_KEYS, dynamicsToInternal, dynamicsToDisplay } from '../shared/config.js';
import { JogMotion, interpolationDir, laserLine, A_PRESETS, B_PRESETS } from '../shared/jog.js';
import { FIGURES, FIGURE_CONTEXT_FIELDS, figureContext, MILL_STEPS, previewMill } from '../shared/figures/index.js';

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

function redraw() {
  const m = state.machine;
  const rock = rockPolygon();
  view.setMaterial(state.extent, m, rock);
  view.setCuts(state.recorder, 'stone');
  view.setCuts(state.tableRecorder, 'table');
  view.setToolCuts(state.toolRecorder, 'stone');
  view.setToolCuts(state.toolTableRecorder, 'table');
  view.setLaser(laserPoints(m, rock));
  view.setPlan(planItems(), topZ(m), { xy: $('#showMarks').checked, dist: $('#showDist').checked });
  view.setBlade(state.pose, m, $('#showBlade').checked, state.saw.angle);
  view.setTool(state.pose, m, $('#showBlade').checked, state.saw.angle);
  view.setMachine(state.pose, m, state.cfg.frame, areaPoints('board'), $('#showBlade').checked, $('#showFrame').checked);
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
  if (p) {
    const depth = Math.max(0, penetration(headFrame(p, m), m));
    let line = `X ${fmt(p.x, 8)}  Y ${fmt(p.y, 8)}  Z ${fmt(p.z, 7)}  A ${fmt(p.a, 6)}°  B ${fmt(p.b, 5)}°  głęb. ${fmt(depth, 6)} mm`;
    if (state.mode === 'offline') line += `  v ${fmt(state.sim.velocity * 0.06, 6, 2)} m/min`;
    $('#pos').textContent = line;
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
    if (v.waterCut) text += '   woda';
    if (v.laser) text += '   laser';
    $('#step').textContent = text;
  } else {
    const sim = state.sim;
    conn.textContent = 'Offline - symulacja (bez PLC)';
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
    state.forms.common = readGroup('common', COMMON_FIELDS);
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
  state.forms = { op: 'cut', ops: {}, common: defaults(COMMON_FIELDS), auto: demoAuto() };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) {
      writeFields('m', saved.m || {});
      // starsze zapisy byly w mm/s; puste / zerowe pola (nowe parametry) zostaja z domyslnych
      if (saved.units === 'm/min') writeFields('d', Object.fromEntries(Object.entries(saved.d || {}).filter(([, v]) => v > 0)));
      if (saved.board) writeArea('board', saved.board);
      if (saved.rock) writeArea('rock', saved.rock);
      if (saved.forms) {
        state.forms = {
          ...state.forms, ...saved.forms,
          ops: saved.forms.ops || {},
          common: { ...state.forms.common, ...(saved.forms.common || {}) },
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
  return `<label>${f.label}<input type="number" step="${f.t === 'int' ? 1 : 'any'}" ${attrs}></label>`;
}

const fieldEl = (group, k) => $(`[data-g="${group}"][data-k="${k}"]`);

// saves - przyciski "Zapisz" punktow (#139): wiersz z przyciskiem za polem Y punktu
function renderGroup(container, group, fields, values, saves = []) {
  container.innerHTML = fields.map((f) => fieldHtml(group, f) + saves.filter((sv) => sv.y === f.k).map((sv) => saveHtml(group, sv)).join('')).join('');
  writeGroup(group, fields, values);
  applyVisibility(group, fields);
  for (const el of container.querySelectorAll('[data-g]')) {
    el.addEventListener('input', () => { applyVisibility(group, fields); offlineFormsChanged(); });
  }
  for (const b of container.querySelectorAll('[data-save-x]')) b.onclick = () => savePoint(group, fields, b.dataset.saveX, b.dataset.saveY);
}

function saveHtml(group, sv) {
  const title = `Wpisz aktualną pozycję osi X / Y jako ${sv.name}${sv.plc ? ` (jak w PLC: ${sv.plc})` : ''}`;
  return `<div class="saveRow wide" data-save-group="${group}" data-save-of="${sv.y}"><button data-save-x="${sv.x}" data-save-y="${sv.y}" title="${title}">Zapisz ${sv.name}</button></div>`;
}

// "Zapisz": aktualna pozycja osi X / Y do pol punktu (zaokraglenie do 0,01 mm jak w PLC)
function savePoint(group, fields, kx, ky) {
  const p = state.pose;
  if (!p) return;
  fieldEl(group, kx).value = savedPosition(p.x);
  fieldEl(group, ky).value = savedPosition(p.y);
  applyVisibility(group, fields);
  offlineFormsChanged();
  requestDraw();
}

// Pola z warunkiem show(v) widoczne tylko przy zaznaczonej opcji (np. koniec X/Y tylko przy "dwa punkty")
function applyVisibility(group, fields) {
  const v = readGroup(group, fields);
  for (const f of fields) {
    if (!f.show) continue;
    const el = fieldEl(group, f.k);
    const box = el?.closest('label');
    if (box) box.hidden = !f.show(v);
    // przycisk "Zapisz" punktu widoczny razem z polem Y punktu
    const save = $(`[data-save-group="${group}"][data-save-of="${f.k}"]`);
    if (save) save.hidden = !f.show(v);
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
    const el = fieldEl(group, f.k);
    out[f.k] = el ? parseField(f, f.t === 'bool' ? el.checked : el.value) : parseField(f, f.d);
  }
  return out;
}

// Operacje trybu: pila - ops.js (CutST ...), frez / wiercenie / polerowanie - tools.js
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
  // glebokosc / wychyl / wyjazd wspolne tylko dla pily - operacje narzedzi maja wlasne pola
  $('#commonBox').hidden = currentMode() !== 'saw';
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
  const kinds = { cut: 'piła – ProgramAutoCutST', profile: 'profile – ProgramAutoProfileST', mill: 'frez – ProgramAutoMillST, tylko podgląd' };
  $('#figHint').textContent = `Jak w PLC: FigureType.${fig.id} (${fig.v}), ${fig.plc}; program: ${kinds[fig.kind] || fig.kind}`;
  renderGroup($('#figFields'), 'fig', fig.fields, state.forms.figs?.[fig.id] || defaults(fig.fields));
  $('#figInfo').textContent = '';
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

// Wspolne parametry ciecia + szerokosc tarczy z parametrow maszyny
function commonValues() {
  return { ...readGroup('common', COMMON_FIELDS), bladeWidth: offlineMachine().bladeWidth };
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

const AUTO_HEAD = '#autoKind, #autoFrom, #autoOX, #autoOY, #autoPJump, #autoSJump, #autoOuterInner, #autoSArrays';

function writeAutoHeader(a, editable) {
  $('#autoKind').value = a.kind;
  $('#autoFrom').value = a.from ?? 1;
  $('#autoOX').value = a.ox; $('#autoOY').value = a.oy;
  $('#autoPJump').value = a.pJump; $('#autoSJump').value = a.sJump;
  $('#autoOuterInner').checked = Boolean(a.outerInner);
  $('#autoSArrays').checked = Boolean(a.sArrays);
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
    outerInner: $('#autoOuterInner').checked, sArrays: $('#autoSArrays').checked,
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
  if (a.kind === 'mill') throw new Error('frez (ProgramAutoMillST) – Visu3D nie symuluje frezu, bufor tylko do podglądu');
  const pb = new ProgramBuilder(from, offlineMachine(), offlineDynamics());
  addAutomat(pb, a.rows, a.rows.length, [a.ox, a.oy], autoOpts(a), commonValues());
  pb.dwell(0.5, 'CutFinish');
  return pb.build();
}

function updateAutoInfo() {
  if (state.mode !== 'offline' || !$('#autoTable').rows.length) return;
  const a = readAuto();
  const d = offlineDynamics();
  let text = `Kroki: ${a.rows.length}`;
  if (a.kind === 'mill') {
    const millWidth = offlineMachine().millWidth;
    text += '<br>Bufor frezu (ProgramAutoMillST) jak w PLC – tylko podgląd toru, bez symulacji ruchu (frez pominięty)';
    text += outsideWarning(previewMill(a.rows, a.rows.length, [a.ox, a.oy], millWidth).map((it) => it.path).filter(Boolean));
  } else if (!validDynamics(d)) {
    text += '<br><span style="color:var(--bad)">Uzupełnij parametry dynamiki (wartości &gt; 0)</span>';
  } else {
    try {
      const prog = buildAutoProgram(state.pose || state.cfg.offline.start);
      text += `, czas programu ${formatTime(prog.duration)}`;
      text += outsideWarning(previewSteps(a.rows, a.rows.length, [a.ox, a.oy], autoOpts(a), commonValues()).map((it) => it.path));
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
  const common = { ...(state.forms.common || {}), bladeWidth: bw };
  const key = JSON.stringify(['op', op.id, v, common]);
  if (key !== planCache.key) {
    let items = [];
    try {
      const lines = op.lines ? op.lines(v, common) : [];
      const paths = op.path ? op.path(v, common) : [];
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
    const lines = op.lines ? op.lines(v, common) : [];
    const paths = op.path ? op.path(v, common) : [];
    if (lines.length) text += `Linie cięcia: ${lines.length}`;
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
  return DYNAMICS_KEYS.some((k) => typeof v[k] === 'number') || MACHINE_KEYS.some((k) => typeof v[k] === 'number');
}

function fromPlc() {
  const v = state.online.values;
  const pick = (keys) => Object.fromEntries(keys.filter((k) => typeof v[k] === 'number').map((k) => [k, v[k]]));
  writeFields('m', pick(MACHINE_KEYS));
  writeFields('d', dynamicsToDisplay(pick(DYNAMICS_KEYS)));
  saveForms();
  offlineFormsChanged();
}

function offlineFormsChanged() {
  saveForms();
  updateCutInfo();
  updateAutoInfo();
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

// homing - tryb bazowania, gdy program to bazowanie
function startProgram(program, homing = null) {
  if (!homing) cancelHoming();
  state.tool.homing = homing;
  state.jog = null;
  state.sim.program = program;
  state.sim.t = 0;
  state.sim.running = true;
  state.sim.label = null;
  state.sim.index = null;
  state.sim.lastFrame = performance.now();
  for (const b of $$('.pauseBtn')) b.textContent = 'Pauza';
  requestAnimationFrame(simFrame);
  ensureSpin();
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
  sim.step = res.step;
  if (sim.index !== res.index) markAutoRow(res.index ?? -1);
  sim.label = res.label;
  sim.index = res.index;
  sim.velocity = res.velocity;
  applyPose(res.pose, m);
  if (res.done) {
    sim.running = false;
    sim.velocity = 0;
    markAutoRow(-1);
    if (state.tool.homing) finishHoming();
  }
  redraw();
  if (sim.running) requestAnimationFrame(simFrame);
}

function stopProgram() {
  state.sim.running = false;
  state.sim.velocity = 0;
  requestDraw();
}

// --- ruchy reczne offline (ekran Reczne) ------------------------------------------------------

const JOG_DYN = { x: ['jogXVel', 'fastAcc'], y: ['jogYVel', 'fastAcc'], z: ['jogZVel', 'zAcc'], a: ['jogAVel', 'aAcc'], b: ['jogBVel', 'bAcc'] };

function startJog(dir, vel, acc, dec) {
  if (state.mode !== 'offline' || !state.pose || !(vel > 0)) return;
  stopProgram();
  cancelHoming();
  state.sim.program = null;
  state.jog = new JogMotion(dir, vel, acc, dec);
  state.jog.last = performance.now();
  requestAnimationFrame(jogFrame);
}

function releaseJog() {
  if (state.jog) state.jog.release();
  for (const b of $$('button.hold.pressed')) b.classList.remove('pressed');
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
  applyPose(p, m);
  if (jog.done) { state.jog = null; state.sim.velocity = 0; }
  redraw();
  updateManInfo();
  if (state.jog) requestAnimationFrame(jogFrame);
}

function updateManInfo() {
  const p = state.pose;
  if (!p || $('.tab[data-tab="man"]').hidden) return;
  const d = offlineDynamics();
  $('#manInfo').innerHTML = `Pozycja: X ${p.x.toFixed(1)}, Y ${p.y.toFixed(1)}, Z ${p.z.toFixed(1)}, A ${p.a.toFixed(1)}°, B ${p.b.toFixed(1)}°`
    + `<br>Jog: X / Y ${(d.jogXVel * 0.06).toFixed(2)} / ${(d.jogYVel * 0.06).toFixed(2)} m/min, Z ${(d.jogZVel * 0.06).toFixed(2)} m/min, A ${d.jogAVel.toFixed(1)} °/s, B ${d.jogBVel.toFixed(1)} °/s`
    + `<br>Interpolacja: ${(d.cutVel * 0.06).toFixed(2)} m/min (prędkość cięcia), laser w ${(state.cfg.laser?.side ?? 1) > 0 ? 'prawą' : 'lewą'} stronę (kierunek cięcia przy A)`;
}

function bindManual() {
  const hold = (btn, start) => {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('pressed'); start(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, releaseJog);
  };
  for (const b of $$('[data-jog]')) {
    hold(b, () => {
      const ax = b.dataset.jog;
      const d = offlineDynamics();
      const [velKey, accKey] = JOG_DYN[ax];
      startJog({ [ax]: Number(b.dataset.sign) }, d[velKey], d[accKey]);
    });
  }
  for (const b of $$('[data-interp]')) {
    hold(b, () => {
      const d = offlineDynamics();
      startJog(interpolationDir(b.dataset.interp, state.pose.a, state.cfg.laser?.side ?? 1), d.cutVel, d.cutAcc, d.cutDec);
    });
  }
  const preset = (ax, values, box) => {
    box.innerHTML = values.map((v) => `<button data-preset="${ax}" data-v="${v}">${v}°</button>`).join('');
    for (const b of box.querySelectorAll('button')) {
      b.onclick = () => {
        const d = offlineDynamics();
        if (!validDynamics(d) || state.mode !== 'offline') return;
        startProgram(gotoProgram(state.pose, { ...state.pose, [ax]: Number(b.dataset.v) }, d));
      };
    }
  };
  preset('a', A_PRESETS, $('#aPresets'));
  preset('b', B_PRESETS, $('#bPresets'));
  // jazda na zadany kat A / B: absolutnie (bManualAMoveToPosAbs) albo o kat (bManualAMoveToPosRel)
  for (const b of $$('[data-move]')) {
    b.onclick = () => {
      const d = offlineDynamics();
      if (!validDynamics(d) || state.mode !== 'offline' || !state.pose) return;
      const ax = b.dataset.move;
      const val = Number($(`#${ax}Set`).value);
      if (!Number.isFinite(val)) return;
      const target = b.dataset.rel ? state.pose[ax] + val : val;
      startProgram(gotoProgram(state.pose, { ...state.pose, [ax]: target }, d));
    };
  }
  const sawCfg = state.cfg.offline.saw || { freq: 50, dir: 'FWD' };
  $('#sawFreq').value = sawCfg.freq;
  $('#sawDir').value = sawCfg.dir;
  $('#sawToggle').onclick = () => {
    state.saw.manual = !state.saw.manual;
    $('#sawToggle').textContent = `${isToolMode(state.machine) ? 'Wrzeciono' : 'Piła'} ${state.saw.manual ? 'OFF' : 'ON'}`;
    $('#sawToggle').classList.toggle('on', state.saw.manual);
    requestDraw();
  };
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
  $('#speedBox').hidden = mode !== 'offline';
  $('#stoneOffline').hidden = mode !== 'offline';
  $('#stonePlc').hidden = mode === 'offline';
  for (const el of $$('[data-pt], [data-count], [data-save]')) el.disabled = mode !== 'offline';
  state.areasKey = '';
  clearCuts();
  state.fitted = false;
  if (mode === 'offline') {
    const start = state.pose || state.cfg.offline.start;
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

function showTab(name) {
  for (const x of $$('.tabs button')) x.classList.toggle('active', x.dataset.tab === name);
  for (const p of $$('.tab')) p.hidden = p.dataset.tab !== name;
  if (name === 'cut') state.planSource = 'op';
  if (name === 'auto') { state.planSource = 'auto'; showAuto(); }
  if (name === 'man') updateManInfo();
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
        + `<td><button data-save="${name}" data-i="${i}" title="Aktualna pozycja osi X, Y, Z">Poz.</button></td></tr>`;
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
// Operacja, Automat, Reczne - wg trybu i tylko po bazowaniu (Operacja i Reczne tylko offline)
function updateTabs() {
  const mode = modeById(currentMode());
  const based = isBased();
  for (const t of $$('.tabs button')) {
    const name = t.dataset.tab;
    let show = state.mode === 'offline' || !('offline' in t.dataset);
    if (['cut', 'auto', 'man'].includes(name)) show = show && based && mode.tabs.includes(name);
    t.hidden = !show;
  }
  const active = $('.tabs button.active');
  if (!active || active.hidden) showTab(state.mode === 'online' && !$('.tabs [data-tab="auto"]').hidden ? 'auto' : 'stone');
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
  const drive = mode.id === 'saw' ? 'Piła' : 'Wrzeciono';
  $('#sawTitle').textContent = drive;
  $('#sawToggle').textContent = `${drive} ${state.saw.manual ? 'OFF' : 'ON'}`;
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
    b.disabled = !offline;
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
  const names = { cut: 'Operacja', auto: 'Automat', man: 'Ręczne' };
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
  renderGroup($('#commonFields'), 'common', COMMON_FIELDS, state.forms.common);
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
    if (!validDynamics(d) || state.mode !== 'offline' || readAuto().kind === 'mill') return;
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
      [state.pose.x, state.pose.y, state.pose.z].forEach((v, c) => { cols[c][i] = v; });
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
    for (const b of $$('.pauseBtn')) b.textContent = sim.running ? 'Pauza' : 'Wznów';
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
  $('#posSet').onclick = () => {
    stopProgram();
    cancelHoming();
    state.sim.program = null;
    applyPose(readFields('pos'), offlineMachine());
    requestDraw();
  };
  $('#posActual').onclick = () => writeFields('pos', state.pose);

  $('#homeModes').innerHTML = MODES.map((x) => `<button data-home="${x.id}">${x.name} <small>B ${x.homeB}°</small></button>`).join('');
  for (const b of $$('[data-home]')) b.onclick = () => { state.tool.target = b.dataset.home; renderHoming(); };
  $('#homeStart').onclick = () => startHoming(state.tool.target || state.tool.mode);
  // automat: punkt startowy z aktualnej pozycji (bProgramSaveStartPosition / bProgramMillStartPointSave)
  $('#autoSaveStart').onclick = () => {
    if (!state.pose || state.mode !== 'offline') return;
    $('#autoOX').value = savedPosition(state.pose.x);
    $('#autoOY').value = savedPosition(state.pose.y);
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
  showOp();
  showFig();
  stoneChanged();
  connectEvents();
  let mode = state.cfg.plc ? 'online' : 'offline';
  try { mode = localStorage.getItem('vizuapp.mode') || mode; } catch { /* jw. */ }
  setMode(mode);
}

init();

// do testow z konsoli / automatu
window.vizu = { state, AXES, startJog, releaseJog, get view() { return view; } };
