// Tryby maszyny po bazowaniu (BaseHomingST) i operacje narzedzi na wrzecionie: frez (MillST), wiercenie (DrillST),
// polerowanie (Polishing). Pila zostaje jak dotad (operacje z ops.js, CutST).

import { ProgramBuilder, depthTable } from './motion.js';
import { plcToolAxisXY, workAxisZ } from './geometry.js';

// Tryby: flaga trybu (bMode*) i bazowania (bBase*) w PLC, B po bazowaniu (BaseHomingST.MOVE_A_HOME_B: pila 0, reszta 90),
// zakladki widoczne w trybie (Stol i kamien, Pozycja, Parametry i Bazowanie - zawsze)
export const MODES = [
  { id: 'saw', name: 'Piła', flag: 'modeSaw', plc: 'bModeSaw', base: 'bBaseSaw', homeB: 0, tool: 'tarcza', tabs: ['cut', 'auto', 'man'] },
  { id: 'mill', name: 'Frez', flag: 'modeMill', plc: 'bModeMill', base: 'bBaseMill', homeB: 90, tool: 'frez', tabs: ['cut', 'auto', 'man'] },
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

export const TOOL_OPS = [
  {
    id: 'millLine', mode: 'mill', name: 'Frezowanie linii', plc: 'MillST',
    saves: [{ x: 'x0', y: 'y0', name: 'początek', plc: 'bManualXSaveZero, bManualYSaveZero' }, { x: 'x1', y: 'y1', name: 'koniec', plc: 'bManualEndPositionSave' }],
    fields: [
      { k: 'twoPoint', label: 'Dwa punkty (inaczej kąt i długość) – bManualTwoPoint', t: 'bool', d: true },
      { k: 'x0', label: 'Początek X', t: 'num', d: 600 }, { k: 'y0', label: 'Początek Y', t: 'num', d: 600 },
      { k: 'x1', label: 'Koniec X', t: 'num', d: 1600, show: (v) => v.twoPoint },
      { k: 'y1', label: 'Koniec Y', t: 'num', d: 600, show: (v) => v.twoPoint },
      { k: 'angle', label: 'Kąt [°] (fManualASetPosition)', t: 'num', d: 0, show: (v) => !v.twoPoint },
      { k: 'length', label: 'Długość [mm]', t: 'num', d: 1000, show: (v) => !v.twoPoint },
      { k: 'depth', label: 'Głębokość [mm]', t: 'num', d: 10 },
      { k: 'passes', label: 'Przejścia (iMillsNumber)', t: 'int', d: 2 },
      { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterZMoveAboveMaterial)', t: 'num', d: 20 },
    ],
    // MillST.GetPositions bez katu B: fMillAngle = 0 (A = 0), punkty narzedzia przesuniete o MillTiltDiameter/2
    points(v) {
      if (v.twoPoint !== false) return [[v.x0, v.y0], [v.x1, v.y1]];
      const a = v.angle * Math.PI / 180;
      return [[v.x0, v.y0], [v.x0 + Math.cos(a) * v.length, v.y0 + Math.sin(a) * v.length]];
    },
    path(v) { return [this.points(v)]; },
    build(pb, v) {
      const m = pb.m;
      const ends = this.points(v).map(([x, y]) => toolXY(m, x, y));
      pb.goto({ x: ends[0][0], y: ends[0][1], a: 0, b: 90 }, v.above, 'GoToPosition');
      pb.axesTo({ z: workAxisZ(-v.above, 90, m) }, 'GoToPosition');
      let side = 0;
      depthTable(v.depth, v.passes).forEach((d) => {
        pb.axesTo({ z: workAxisZ(d, 90, m) }, 'MillZDown');
        side = 1 - side;
        pb.linearTo({ x: ends[side][0], y: ends[side][1] }, 'Mill');
      });
      pb.zUp(workAxisZ(-v.above, 90, m), 'MoveAboveMaterial');
    },
  },
  {
    id: 'drill', mode: 'drill', name: 'Wiercenie', plc: 'DrillST',
    saves: [{ x: 'x', y: 'y', name: 'punkt', plc: 'bManualXSaveZero, bManualYSaveZero' }],
    fields: [
      { k: 'x', label: 'Punkt X (fManualXZeroPosition)', t: 'num', d: 1000 },
      { k: 'y', label: 'Punkt Y (fManualYZeroPosition)', t: 'num', d: 800 },
      { k: 'depth', label: 'Głębokość [mm] (fDrillDepth)', t: 'num', d: 40 },
      { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterZMoveAboveMaterial)', t: 'num', d: 20 },
    ],
    path(v) { return [[[v.x - 25, v.y], [v.x + 25, v.y], null, [v.x, v.y - 25], [v.x, v.y + 25]]]; },
    marks: (v) => [[v.x, v.y]],          // znacznik XY w punkcie otworu
    // DrillST: GoToPosition nad punkt na wysokosc materialu (A 0, B 90), wrzeciono 95 % obrotow, MOVE_DRILL, MOVE_ABOVE_MATERIAL
    build(pb, v) {
      const m = pb.m;
      const [x, y] = toolXY(m, v.x, v.y);
      pb.goto({ x, y, a: 0, b: 90, z: workAxisZ(0, 90, m) }, v.above, 'MOVE_TO_START_POSITION');
      pb.dwell(1, 'WAIT_MAIN_DRIVE');
      pb.axesTo({ z: workAxisZ(v.depth, 90, m) }, 'MOVE_DRILL');
      pb.zUp(workAxisZ(-v.above, 90, m), 'MOVE_ABOVE_MATERIAL');
    },
  },
  {
    id: 'polishing', mode: 'polishing', name: 'Polerowanie', plc: 'Polishing',
    saves: [{ x: 'xs', y: 'ys', name: 'start', plc: 'bSaveStartPosition' }],
    fields: [
      { k: 'xs', label: 'Start X (fXStartPosition)', t: 'num', d: 600 },
      { k: 'ys', label: 'Start Y (fYStartPosition)', t: 'num', d: 500 },
      { k: 'width', label: 'Szerokość w X [mm] (fWidth)', t: 'num', d: 1200 },
      { k: 'length', label: 'Długość w Y [mm] (fLength)', t: 'num', d: 800 },
      { k: 'jump', label: 'Skok [mm] (fJump)', t: 'num', d: 100 },
      { k: 'type', label: 'Rodzaj (PolishingType)', t: 'sel', d: 0, o: POLISH_TYPES },
      { k: 'vel', label: 'Prędkość [m/min] (fVelocity)', t: 'num', d: 3 },
      { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterAboveMaterialPosition)', t: 'num', d: 20 },
    ],
    path(v) { return [polishingPath(v)]; },
    // Polishing: MOVE_TO_START_POSITION (A 0, B 90, Z materialu z ActiveTool.Height - bMaterialHeightMode), linie X / Y
    // z fVelocity, END_MOVE_ABOVE_MATERIAL
    build(pb, v) {
      const m = pb.m;
      const pts = polishingPath(v).map(([x, y]) => toolXY(m, x, y));
      const vel = Math.max(v.vel, 0.01) * 1000 / 60;
      pb.goto({ x: pts[0][0], y: pts[0][1], a: 0, b: 90, z: workAxisZ(0, 90, m) }, v.above, 'MOVE_TO_START_POSITION');
      pb.dwell(1, 'CHECK_START_POSITION');
      for (let i = 1; i < pts.length; i++) {
        const step = pts[i][0] !== pts[i - 1][0] ? 'MOVE_POLISHING_X' : 'MOVE_POLISHING_Y';
        pb.linearTo({ x: pts[i][0], y: pts[i][1] }, step, vel);
      }
      pb.zUp(workAxisZ(-v.above, 90, m), 'END_MOVE_ABOVE_MATERIAL');
    },
  },
];

export const toolOpsFor = (mode) => TOOL_OPS.filter((o) => o.mode === mode);
