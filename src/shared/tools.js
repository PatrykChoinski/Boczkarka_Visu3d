// Tryby maszyny po bazowaniu (BaseHomingST) i operacje narzedzi na wrzecionie: frez (millops.js - MillST ...),
// wiercenie (DrillST, DrillSimpleST), polerowanie (Polishing). Pila zostaje jak dotad (operacje z ops.js, CutST).

import { ProgramBuilder } from './motion.js';
import { plcToolAxisXY, workAxisZ } from './geometry.js';
import { MILL_OPS } from './millops.js';

// Tryby: flaga trybu (bMode*) i bazowania (bBase*) w PLC, B po bazowaniu (BaseHomingST.MOVE_A_HOME_B: pila 0, reszta 90),
// zakladki widoczne w trybie (Stol i kamien, Pozycja, Parametry i Bazowanie - zawsze)
export const MODES = [
  { id: 'saw', name: 'Piła', flag: 'modeSaw', plc: 'bModeSaw', base: 'bBaseSaw', homeB: 0, tool: 'tarcza', tabs: ['cut', 'auto', 'man'] },
  { id: 'mill', name: 'Frez', flag: 'modeMill', plc: 'bModeMill', base: 'bBaseMill', homeB: 90, tool: 'frez', tabs: ['cut', 'auto', 'man', 'cnc'] },
  { id: 'drill', name: 'Wiercenie', flag: 'modeDrill', plc: 'bModeDrill', base: 'bBaseDrill', homeB: 90, tool: 'wiertło', tabs: ['cut', 'man'] },
  { id: 'polishing', name: 'Polerowanie', flag: 'modePolishing', plc: 'bModePolishing', base: 'bBasePolishing', homeB: 90, tool: 'narzędzie polerskie', tabs: ['cut', 'man'] },
];
export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

// Rodzaje programu automatu w trybie (ProgramAutoCutST / ProgramAutoProfileST - pila, ProgramAutoMillST - frez)
export const AUTO_KINDS = { saw: ['cut', 'profile'], mill: ['mill'] };

// Tryb z wartosci PLC (bModeSaw / Mill / Drill / Polishing) albo null, gdy zadna flaga nie jest ustawiona
export function modeFromValues(v) {
  const m = MODES.find((x) => v[x.flag] === true || v[x.flag] === 1);
  return m ? m.id : null;
}

// A w zakresie -180..180 (ten sam kat glowicy) - BaseHomingST: A >= 0 w strone ujemna, A < 0 w dodatnia
export const homeA = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

// Bazowanie jak BaseHomingST: INIT (fPositionZ := 0) -> MOVE_Z_UP -> MOVE_A_HOME_B (A na 0 najkrotsza droga,
// rownoczesnie B na 0 / 90) -> CHECK_HOME (0.5 s); po programie END_PROCEDURE (bSystemBased, bMode* z bBase*) - w main.js.
export function homingProgram(from, modeId, m, dyn) {
  const pb = new ProgramBuilder(from, m, dyn);
  pb.label = `Bazowanie: ${modeById(modeId).name}`;
  pb.cur.a = homeA(pb.cur.a);
  if (Math.abs(pb.cur.z) > 1e-9) pb.zUp(0, 'MOVE_Z_UP');
  pb.axesTo({ a: 0, b: modeById(modeId).homeB }, 'MOVE_A_HOME_B');
  pb.dwell(0.5, 'CHECK_HOME');
  return pb.build();
}

// --- operacje narzedzi (tryb offline) ------------------------------------------------------------------

const toolXY = (m, x, y) => plcToolAxisXY(x, y, 0, 90, m);
const POLISH_TYPES = [[0, 'XY – linie wzdłuż X, skok w Y'], [1, 'YX – linie wzdłuż Y, skok w X'], [2, 'Prostokąt CCW'], [3, 'Prostokąt CW']];

// Tor polerowania jak Polishing (MOVE_POLISHING_X / Y, CHECK_END_LINE): punkty narzedzia [[x, y], ...]
export function polishingPath(v) {
  const { xs, ys, width: W, length: L, type } = v;
  const jump = Math.max(v.jump, 1);
  const lines = type === 0 ? Math.ceil(L / jump) : type === 1 ? Math.ceil(W / jump) : 1;
  let x = xs;
  let y = ys;
  let line = 0;
  const pts = [[x, y]];
  const moveX = () => {
    if (type === 1) x = xs + Math.min(line * jump, W);
    else x = Math.abs(x - xs) <= 1 ? xs + W : xs;
    pts.push([x, y]);
  };
  const moveY = () => {
    if (type === 0) y = ys + Math.min(line * jump, L);
    else y = Math.abs(y - ys) <= 1 ? ys + L : ys;
    pts.push([x, y]);
  };
  // XY i prostokat CCW zaczynaja od X, YX i prostokat CW od Y; CHECK_END_LINE w XY / YX po pierwszym ruchu, w prostokatach po drugim
  const first = type === 0 || type === 2 ? moveX : moveY;
  const second = first === moveX ? moveY : moveX;
  const endAfterFirst = type === 0 || type === 1;
  for (let guard = 0; guard < 10000; guard++) {
    first();
    if (endAfterFirst) {
      if (line >= lines) break;
      line++;
      second();
    } else {
      second();
      if (line >= lines) break;
      line++;
    }
  }
  return pts;
}

// Wiercenie: Z w dol z fVelocityAxisZDrill (pole w m/min jak dynamika), przyspieszenie Z z dynamiki
const DRILL_VEL = { k: 'zVel', label: 'Prędkość Z wiercenia [m/min] (fVelocityAxisZDrill)', t: 'num', d: 0.6 };
const drillZ = (pb, v) => ({ z: [Math.max(v.zVel, 0.001) * 1000 / 60, pb.dyn.zAcc] });

// Polerowanie bez bMaterialHeightMode: Z osi = fHeightPosition + ActiveTool.Height - sin(B) * (korekta + Ct/2)
// (jak workAxisZ, tylko od zadanej wysokosci zamiast fMillMaterialHeight)
export const polishAxisZ = (height, m) => workAxisZ(0, 90, { ...m, materialHeight: height });

// Kolejnosc pracy narzedzi polerskich: [{tool, type}] - narzedzia 1..10 rosnaco; bez kolejki aToolRepetitions[n] razy
// wybrany rodzaj, z kolejka (aQueueTools[n].Actions[type]) rodzaje XY, YX, CCW, CW po kolei, kazdy Actions razy
export function polishingJobs(v) {
  const jobs = [];
  const count = (list, i) => Math.max(0, Math.round(Number((list || [])[i]) || 0));
  for (let i = 0; i < 10; i++) {
    if (!v.queue) {
      for (let r = 0; r < count(v.reps ?? [1], i); r++) jobs.push({ tool: i + 1, type: v.type });
    } else {
      [v.qXY, v.qYX, v.qCCW, v.qCW].forEach((q, type) => { for (let r = 0; r < count(q, i); r++) jobs.push({ tool: i + 1, type }); });
    }
  }
  return jobs;
}

export const TOOL_OPS = [
  ...MILL_OPS,
  {
    id: 'drill', mode: 'drill', name: 'Wiercenie', plc: 'DrillST',
    saves: [{ x: 'x', y: 'y', name: 'punkt', plc: 'bManualXSaveZero, bManualYSaveZero' }],
    fields: [
      { k: 'x', label: 'Punkt X (fManualXZeroPosition)', t: 'num', d: 1000 },
      { k: 'y', label: 'Punkt Y (fManualYZeroPosition)', t: 'num', d: 800 },
      { k: 'depth', label: 'Głębokość [mm] (fDrillDepth)', t: 'num', d: 40 },
      DRILL_VEL,
      { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterZMoveAboveMaterial)', t: 'num', d: 20 },
    ],
    path(v) { return [[[v.x - 25, v.y], [v.x + 25, v.y], null, [v.x, v.y - 25], [v.x, v.y + 25]]]; },
    marks: (v) => [[v.x, v.y]],          // znacznik XY w punkcie otworu
    // DrillST: GoToPosition nad punkt na wysokosc materialu (A 0, B 90), wrzeciono 95 % obrotow, MOVE_DRILL
    // z fVelocityAxisZDrill, MOVE_ABOVE_MATERIAL z fVelocityAxisZApproach
    build(pb, v) {
      const m = pb.m;
      const [x, y] = toolXY(m, v.x, v.y);
      pb.goto({ x, y, a: 0, b: 90, z: workAxisZ(0, 90, m) }, v.above, 'MOVE_TO_START_POSITION');
      pb.dwell(1, 'WAIT_MAIN_DRIVE');
      pb.axesTo({ z: workAxisZ(v.depth, 90, m) }, 'MOVE_DRILL', drillZ(pb, v));
      pb.zUp(workAxisZ(-v.above, 90, m), 'MOVE_ABOVE_MATERIAL');
    },
  },
  {
    id: 'drillSimple', mode: 'drill', name: 'Wiercenie w miejscu', plc: 'DrillSimpleST', here: true,
    fields: [
      { k: 'depth', label: 'Głębokość od aktualnego Z [mm] (fDrillDepth)', t: 'num', d: 40 },
      DRILL_VEL,
      { k: 'above', label: 'Wyjazd nad start [mm] (fParameterZMoveAboveMaterial)', t: 'num', d: 20 },
    ],
    // DrillSimpleST: bez dojazdu - wiercenie w aktualnym XY od aktualnego Z (z0): wrzeciono 95 %, Z do z0 + fDrillDepth
    // z fVelocityAxisZDrill, potem Z na z0 - fParameterZMoveAboveMaterial z fVelocityAxisZApproach
    build(pb, v) {
      const z0 = pb.cur.z;
      pb.dwell(1, 'WAIT_MAIN_DRIVE');
      pb.axesTo({ z: z0 + v.depth }, 'MOVE_DRILL', drillZ(pb, v));
      pb.zUp(z0 - v.above, 'MOVE_ABOVE');
    },
  },
  {
    id: 'polishing', mode: 'polishing', name: 'Polerowanie', plc: 'Polishing',
    saves: [{ x: 'xs', y: 'ys', name: 'start', plc: 'bSaveStartPosition' }, { z: 'height', name: 'Z', plc: 'bSaveZ' }],
    fields: [
      { k: 'xs', label: 'Start X (fXStartPosition)', t: 'num', d: 600 },
      { k: 'ys', label: 'Start Y (fYStartPosition)', t: 'num', d: 500 },
      { k: 'width', label: 'Szerokość w X [mm] (fWidth)', t: 'num', d: 1200 },
      { k: 'length', label: 'Długość w Y [mm] (fLength)', t: 'num', d: 800 },
      { k: 'jump', label: 'Skok [mm] (fJump)', t: 'num', d: 100 },
      { k: 'type', label: 'Rodzaj (PolishingType)', t: 'sel', d: 0, o: POLISH_TYPES, show: (v) => !v.queue },
      { k: 'vel', label: 'Prędkość [m/min] (fVelocityMillMode)', t: 'num', d: 3 },
      { k: 'heightMode', label: 'Z z wysokości materiału (bMaterialHeightMode)', t: 'bool', d: true },
      { k: 'height', label: 'Wysokość Z osi [mm] (fHeightPosition)', t: 'num', d: 0, show: (v) => !v.heightMode },
      { k: 'queue', label: 'Kolejka narzędzi (aQueueTools)', t: 'bool', d: false },
      { k: 'reps', label: 'Powtórzenia narzędzi 1–10 (aToolRepetitions)', t: 'list', d: '1', show: (v) => !v.queue },
      { k: 'qXY', label: 'Kolejka: XY na narzędzie 1–10 (Actions[XY])', t: 'list', d: '1', show: (v) => v.queue },
      { k: 'qYX', label: 'Kolejka: YX na narzędzie 1–10 (Actions[YX])', t: 'list', d: '0', show: (v) => v.queue },
      { k: 'qCCW', label: 'Kolejka: prostokąt CCW na narzędzie 1–10', t: 'list', d: '0', show: (v) => v.queue },
      { k: 'qCW', label: 'Kolejka: prostokąt CW na narzędzie 1–10', t: 'list', d: '0', show: (v) => v.queue },
      { k: 'change', label: 'Wymiana narzędzia [s] (PolishingToolChange – postój)', t: 'num', d: 10 },
      { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterAboveMaterialPosition)', t: 'num', d: 20 },
    ],
    path(v) {
      const types = [...new Set(polishingJobs(v).map((j) => j.type))];
      return (types.length ? types : [v.type]).map((type) => polishingPath({ ...v, type }));
    },
    // Polishing: dla kazdego narzedzia (rosnaco) i powtorzenia MOVE_TO_START_POSITION (A 0, B 90, Z z wysokosci
    // materialu albo fHeightPosition + ActiveTool.Height), linie X / Y z fVelocityMillMode, END_MOVE_ABOVE_MATERIAL;
    // miedzy narzedziami PolishingToolChange (magazyn - pozycje nieznane: Z w gore i postoj)
    build(pb, v) {
      const m = pb.m;
      const zWork = v.heightMode === false ? polishAxisZ(v.height, m) : workAxisZ(0, 90, m);
      const zAbove = zWork - v.above;
      const vel = Math.max(v.vel, 0.01) * 1000 / 60;
      let tool = null;
      for (const job of polishingJobs(v)) {
        pb.label = `Narzędzie ${job.tool}, ${POLISH_TYPES[job.type][1].split(' ')[0]}`;
        if (tool !== null && job.tool !== tool) {
          pb.zUp(zAbove, 'END_MOVE_ABOVE_MATERIAL');
          pb.dwell(Math.max(0, v.change), 'CHANGE_TOOL');
        }
        tool = job.tool;
        const pts = polishingPath({ ...v, type: job.type }).map(([x, y]) => toolXY(m, x, y));
        pb.goto({ x: pts[0][0], y: pts[0][1], a: 0, b: 90, z: zWork }, v.above, 'MOVE_TO_START_POSITION');
        pb.dwell(1, 'CHECK_START_POSITION');
        for (let i = 1; i < pts.length; i++) {
          const step = pts[i][0] !== pts[i - 1][0] ? 'MOVE_POLISHING_X' : 'MOVE_POLISHING_Y';
          pb.linearTo({ x: pts[i][0], y: pts[i][1] }, step, vel);
        }
        pb.zUp(zAbove, 'END_MOVE_ABOVE_MATERIAL');
      }
      pb.label = null;
    },
  },
];

export const toolOpsFor = (mode) => TOOL_OPS.filter((o) => o.mode === mode);
