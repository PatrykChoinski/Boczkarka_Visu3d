// Rejestr figur automatu (PLC: FiguresGeometric) - wybor figury na ekranie Automat wypelnia bufor krokow
// tak, jak PLC (FiguresGeometricSt -> aFigure* -> aProgram*, jak GetDemoProgram).

import { CONTEXT_DEFAULTS, MILL } from './common.js';
import { RECTANGLE } from './rectangle.js';
import { FIGURES_A } from './groupA.js';
import { FIGURES_B } from './groupB.js';
import { FIGURES_C } from './groupC.js';
import { INTERNAL } from '../common.js';
import { arcPlan, circlePlan } from '../arcs.js';

// Kolejnosc jak FigureType w PLC
export const FIGURES = [RECTANGLE, ...FIGURES_A, ...FIGURES_B, ...FIGURES_C].sort((a, b) => a.v - b.v);
export const figureById = (id) => FIGURES.find((f) => f.id === id);

// Zmienne globalne / serwisowe, ktore FiguresGeometricSt podaje figurom (pola "Parametry figury");
// modes - tryby, w ktorych pole ma znaczenie (#131: w pile ukryte pola frezu i odwrotnie)
export const FIGURE_CONTEXT_FIELDS = [
  { k: 'internal', label: 'Rodzaj (iManualInternal)', t: 'sel', d: 0, o: INTERNAL },
  { k: 'additional', label: 'Dodatkowa droga (bManualAdditionalDistance)', t: 'bool', d: false, modes: ['saw'] },
  { k: 'additionalDistance', label: 'Dodatkowa droga [mm] (fManualAdditionalDistance)', t: 'num', d: 50, show: (v) => v.additional, modes: ['saw'] },
  { k: 'rectangleACBD', label: 'Prostokąt w kolejności AC-BD (bServiceRectangleACBD)', t: 'bool', d: false, modes: ['saw'], svc: 'bServiceRectangleACBD' },
  { k: 'roofCorrectionX', label: 'Korekta daszków X (fParameterRoofCorrectionX)', t: 'num', d: 0, modes: ['saw'] },
  { k: 'roofCorrectionY', label: 'Korekta daszków Y (fParameterRoofCorrectionY)', t: 'num', d: 0, modes: ['saw'] },
  { k: 'newStart', label: 'Nowe punkty startu frezu (bServiceMillProgramNewStartPoints)', t: 'bool', d: false, modes: ['mill'], svc: 'bServiceMillProgramNewStartPoints' },
  { k: 'newStartX', label: 'Start frezu X względem programu', t: 'num', d: 0, show: (v) => v.newStart, modes: ['mill'] },
  { k: 'newStartY', label: 'Start frezu Y względem programu', t: 'num', d: 0, show: (v) => v.newStart, modes: ['mill'] },
  { k: 'machineNumber', label: 'Numer maszyny (iMachineNumber)', t: 'int', d: 0, modes: ['mill'] },
  { k: 'bookMinimalRadius', label: 'Książki: promień minimalny (bServiceBookMinimalRadius)', t: 'bool', d: false, modes: ['saw'], svc: 'bServiceBookMinimalRadius' },
];

// Kontekst figury: pola "Parametry figury" + szerokosc tarczy, srednica frezu (fParameterMillWidth), grubosc z parametrow
// maszyny, wyjazd ze wspolnych ustawien, bModeMill z trybu po bazowaniu
export function figureContext(v, m, common) {
  return {
    ...CONTEXT_DEFAULTS, ...v,
    bladeWidth: m.bladeWidth, materialThickness: m.materialThickness,
    blocksReverse: common.blocksReverse ?? CONTEXT_DEFAULTS.blocksReverse,
    zAbove: common.above ?? CONTEXT_DEFAULTS.zAbove,
    millWidth: m.millWidth ?? CONTEXT_DEFAULTS.millWidth,
    modeMill: m.mode === 'mill',
  };
}

// Kroki frezu (ProgramMillStep) - nazwy do tabeli bufora
const MILL_NAMES = {
  Nothing: 'Nic', Mill: 'Frez', GoToPosition: 'Przejazd', MillArcCW: 'Łuk CW', MillArcCCW: 'Łuk CCW', MillInnerFull: 'Frez wewn.',
  GoToPositionWithoutZ: 'Przejazd bez Z', MillSlopeDown: 'Skos w dół', MillSlopeUp: 'Skos w górę', Drilling: 'Wiercenie',
  ChangeDepth: 'Zmień głębokość', CircleTopPointOuter: 'Okrąg zewn. (góra)', CircleCenterPointOuter: 'Okrąg zewn. (środek)',
  Confirm: 'Potwierdź', MillWithoutZ: 'Frez bez Z', CircleTopPointInner: 'Okrąg wewn. (góra)', CircleCenterPointInner: 'Okrąg wewn. (środek)',
  ElipseOuter: 'Elipsa zewn.', ElipseInner: 'Elipsa wewn.',
};
export const MILL_STEPS = Object.entries(MILL).map(([id, v]) => ({ v, id, name: MILL_NAMES[id] || id }));

// Podglad toru bufora frezu (bez symulacji): odcinki i -> i+1, luki, okregi, wiercenie (krzyzyk)
export function previewMill(rows, count, origin, millWidth = 20) {
  const P = (r) => [origin[0] + r.x, origin[1] + r.y];
  const out = [];
  for (let i = 0; i < count && i < rows.length; i++) {
    const r = rows[i];
    const a = P(r);
    const b = P(rows[i + 1] || r);
    let path = null;
    if ([MILL.Mill, MILL.MillInnerFull, MILL.MillSlopeDown, MILL.MillSlopeUp, MILL.MillWithoutZ, MILL.GoToPosition, MILL.GoToPositionWithoutZ].includes(r.step)) {
      path = [a, b];
    } else if (r.step === MILL.MillArcCW || r.step === MILL.MillArcCCW) {
      const p = arcPlan(a, b, r.r, r.step === MILL.MillArcCW);
      if (p) {
        const t0 = Math.atan2(p.S[1] - p.C[1], p.S[0] - p.C[0]);
        let t1 = Math.atan2(p.E[1] - p.C[1], p.E[0] - p.C[0]);
        if (p.cw) { while (t1 > t0) t1 -= 2 * Math.PI; } else { while (t1 < t0) t1 += 2 * Math.PI; }
        path = Array.from({ length: 33 }, (_, k) => { const t = t0 + (t1 - t0) * k / 32; return [p.C[0] + p.R * Math.cos(t), p.C[1] + p.R * Math.sin(t)]; });
      } else {
        path = [a, b];
      }
    } else if ([MILL.CircleTopPointOuter, MILL.CircleCenterPointOuter, MILL.CircleTopPointInner, MILL.CircleCenterPointInner].includes(r.step)) {
      const c = circlePlan({ x: a[0], y: a[1], R: r.r, center: r.step === MILL.CircleCenterPointOuter || r.step === MILL.CircleCenterPointInner,
        inner: r.step === MILL.CircleTopPointInner || r.step === MILL.CircleCenterPointInner }, millWidth);
      path = Array.from({ length: 65 }, (_, k) => { const t = 2 * Math.PI * k / 64; return [c.C[0] + c.Rc * Math.cos(t), c.C[1] + c.Rc * Math.sin(t)]; });
    } else if (r.step === MILL.Drilling) {
      const d = Math.max(10, millWidth / 2);
      path = [[a[0] - d, a[1]], [a[0] + d, a[1]], null, [a[0], a[1] - d], [a[0], a[1] + d]];
      out.push({ i, step: r.step, path, marks: [a] });   // znacznik XY w punkcie otworu
      continue;
    } else if (r.step === MILL.ElipseOuter || r.step === MILL.ElipseInner) {
      path = [a, b];
    }
    out.push({ i, step: r.step, path });
  }
  return out;
}
