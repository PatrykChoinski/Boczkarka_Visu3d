// Operacje piły w trybie offline: pola formularza (jak na ekranach HMI) i budowa programu ruchu jak w PLC.
// Kazda operacja: {id, name, plc, fields: [...], build(pb, v, common)} - pb = ProgramBuilder,
// v - wartosci pol operacji, common - wspolne parametry ciecia (glebokosc, wychyl, wyjazd).

import { addCutST } from './cutst.js';
export { COMMON_FIELDS } from './common.js';
import { stripesLines, blocksLines, edgesLines } from './sawlines.js';
import { plcAxisXY, plcAxisZ } from './geometry.js';
import { addArc, addCircle, addEllipse, arcPlan, circlePlan, ellipsePoints, threePointArc, chordRadius } from './arcs.js';
import { addProfile, addSmoothing, profileCuts } from './profiles.js';

import { INTERNAL, cutParams } from './common.js';

// Liczba przejsc przy jednym przejsciu albo wielu (do zamiany linii w pasach / blokach)
const passCount = (common) => (common.depthMode === 'one' ? 1 : Math.max(1, common.passes));

// Kolejne linie przez CutST z 2 s przerwy (TON_Start w programach pasow / blokow / krawedzi)
function cutLines(pb, lines, common) {
  lines.forEach((l, i) => {
    if (i > 0) pb.dwell(2, 'WAIT_START');
    addCutST(pb, cutParams(l, common));
  });
}

export const OPS = [
  {
    id: 'cut', name: 'Cięcie proste', plc: 'CutST',
    fields: [
      { k: 'x0', label: 'Początek X', t: 'num', d: 400 }, { k: 'y0', label: 'Początek Y', t: 'num', d: 400 },
      { k: 'x1', label: 'Koniec X', t: 'num', d: 1400 }, { k: 'y1', label: 'Koniec Y', t: 'num', d: 400 },
      { k: 'internal', label: 'Rodzaj', t: 'sel', d: 0, o: INTERNAL },
      { k: 'reverse', label: 'Odwrócone (głowica +180°)', t: 'bool', d: false },
    ],
    lines: (v) => [{ x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1, reverse: v.reverse, internal: v.internal }],
    build(pb, v, common) { addCutST(pb, cutParams(this.lines(v)[0], common)); },
  },
  {
    id: 'stripes', name: 'Pasy', plc: 'CutStripesST',
    fields: [
      { k: 'xs', label: 'Start X', t: 'num', d: 400 }, { k: 'ys', label: 'Start Y', t: 'num', d: 400 },
      { k: 'xCut', label: 'Cięcia wzdłuż X', t: 'bool', d: true },
      { k: 'twoPoint', label: 'Dwa punkty (koniec)', t: 'bool', d: false },
      { k: 'xe', label: 'Koniec X', t: 'num', d: 1600 }, { k: 'ye', label: 'Koniec Y', t: 'num', d: 400 },
      { k: 'length', label: 'Długość [mm]', t: 'num', d: 1200 },
      { k: 'angleCut', label: 'Pod kątem', t: 'bool', d: false }, { k: 'angle', label: 'Kąt [°]', t: 'num', d: 0 },
      { k: 'constant', label: 'Stała szerokość', t: 'bool', d: true },
      { k: 'width', label: 'Szerokość pasa [mm]', t: 'num', d: 200 }, { k: 'number', label: 'Liczba pasów', t: 'int', d: 4 },
      { k: 'widths', label: 'Tabela: szerokości', t: 'list', d: '150, 300' },
      { k: 'numbers', label: 'Tabela: ilości', t: 'list', d: '2, 1' },
      { k: 'repeating', label: 'Tabela z powtórzeniami', t: 'bool', d: true },
      { k: 'reverse', label: 'Pasy w stronę ujemną', t: 'bool', d: false },
      { k: 'toLaser', label: 'Długość w stronę lasera', t: 'bool', d: false },
    ],
    lines: (v, common) => stripesLines({ ...v, bladeWidth: common.bladeWidth, blocksReverse: common.blocksReverse, passes: passCount(common) }),
    build(pb, v, common) { cutLines(pb, this.lines(v, common), common); },
  },
  {
    id: 'blocks', name: 'Bloki', plc: 'CutBlocksST',
    fields: [
      { k: 'xs', label: 'Start X', t: 'num', d: 400 }, { k: 'ys', label: 'Start Y', t: 'num', d: 300 },
      { k: 'lengths', label: 'Długości bloków w X', t: 'list', d: '500, 500, 400' },
      { k: 'widths', label: 'Szerokości bloków w Y', t: 'list', d: '400, 400' },
      { k: 'additional', label: 'Wydłużenie linii [mm]', t: 'num', d: 0 },
      { k: 'swapOrder', label: 'Najpierw linie Y (serwis)', t: 'bool', d: false },
    ],
    lines: (v, common) => blocksLines({ ...v, bladeWidth: common.bladeWidth, blocksReverse: common.blocksReverse, passes: passCount(common) }),
    build(pb, v, common) { cutLines(pb, this.lines(v, common), common); },
  },
  {
    id: 'edges', name: 'Krawędzie (prostokąt)', plc: 'EdgesST',
    fields: [
      { k: 'xs', label: 'Narożnik X', t: 'num', d: 500 }, { k: 'ys', label: 'Narożnik Y', t: 'num', d: 400 },
      { k: 'length', label: 'Długość [mm]', t: 'num', d: 1200 }, { k: 'width', label: 'Szerokość [mm]', t: 'num', d: 700 },
      { k: 'angle', label: 'Kąt [°]', t: 'num', d: 0 },
      { k: 'internal', label: 'Rodzaj', t: 'sel', d: 0, o: INTERNAL },
      { k: 'additional', label: 'Wydłużenie krawędzi [mm]', t: 'num', d: 0 },
      { k: 'acbd', label: 'Kolejność AB, CD, BC, DA (serwis)', t: 'bool', d: false },
    ],
    lines(v, common) {
      return edgesLines({ ...v, bladeWidth: common.bladeWidth, blocksReverse: common.blocksReverse })
        .map((l) => ({ ...l, internal: v.internal }));
    },
    build(pb, v, common) { cutLines(pb, this.lines(v, common), { ...common, tilt: false }); },
  },
  {
    id: 'mowing', name: 'Zakoszenie', plc: 'MowingST',
    fields: [
      { k: 'xs', label: 'Start X', t: 'num', d: 600 }, { k: 'ys', label: 'Start Y', t: 'num', d: 600 },
      { k: 'distance', label: 'Odległość D [mm]', t: 'num', d: 300 },
      { k: 'depth', label: 'Głębokość [mm]', t: 'num', d: 20 },
    ],
    lines: (v) => [{ x0: v.xs, y0: v.ys, x1: v.xs + 2 * v.distance, y1: v.ys }],
    // dwa zaglebienia na A 0 / B 0: z Xs do Xs+D i z Xs+2D do Xs+D (szczelina 0..2D)
    build(pb, v, common) {
      const m = pb.m;
      const zAt = (d) => plcAxisZ(d, 0, m);
      for (const x of [v.xs, v.xs + 2 * v.distance]) {
        const [ax, ay] = plcAxisXY(x, v.ys, 0, 0, m);
        const [cx] = plcAxisXY(v.xs + v.distance, v.ys, 0, 0, m);
        pb.goto({ x: ax, y: ay, a: 0, b: 0, z: zAt(0) }, common.above, 'MOVE_TO_START_POSITION');
        pb.axesTo({ z: zAt(v.depth) }, 'MOVE_Z_DOWN');
        pb.linearTo({ x: cx }, 'MOVE_CUT');
        pb.zUp(zAt(-common.above), 'MOVE_Z_UP');
      }
    },
  },
  {
    id: 'arc', name: 'Łuk', plc: 'CutArcST',
    fields: [
      { k: 'x0', label: 'Początek X', t: 'num', d: 600 }, { k: 'y0', label: 'Początek Y', t: 'num', d: 500 },
      { k: 'x1', label: 'Koniec X', t: 'num', d: 1600 }, { k: 'y1', label: 'Koniec Y', t: 'num', d: 500 },
      { k: 'type', label: 'Rodzaj łuku', t: 'sel', d: 0, o: [[0, 'promień'], [1, 'trzy punkty'], [2, 'cięciwa (strzałka)']] },
      { k: 'r', label: 'Promień R [mm]', t: 'num', d: 800 },
      { k: 'cw', label: 'Zgodnie z zegarem (CW)', t: 'bool', d: true },
      { k: 'xm', label: 'Punkt środkowy X', t: 'num', d: 1100 }, { k: 'ym', label: 'Punkt środkowy Y', t: 'num', d: 700 },
      { k: 'sagitta', label: 'Strzałka [mm]', t: 'num', d: 150 },
    ],
    arc(v) {
      const S = [v.x0, v.y0]; const E = [v.x1, v.y1];
      if (v.type === 1) { const t = threePointArc(S, [v.xm, v.ym], E); return t && { S, E, R: t.R, cw: t.cw }; }
      if (v.type === 2) return { S, E, R: chordRadius(S, E, v.sagitta), cw: v.cw };
      return { S, E, R: v.r, cw: v.cw };
    },
    path(v) { const a = this.arc(v); const p = a && arcPlan(a.S, a.E, a.R, a.cw); return p ? [arcPath(p)] : []; },
    build(pb, v, common) { const a = this.arc(v); if (a) addArc(pb, a, cutParams({ x0: 0, y0: 0, x1: 1, y1: 0 }, common)); },
  },
  {
    id: 'circle', name: 'Okrąg', plc: 'CutCircleST',
    fields: [
      { k: 'x', label: 'Punkt X', t: 'num', d: 1500 }, { k: 'y', label: 'Punkt Y', t: 'num', d: 1500 },
      { k: 'center', label: 'Punkt = środek (inaczej góra okręgu)', t: 'bool', d: true },
      { k: 'r', label: 'Promień R [mm]', t: 'num', d: 500 },
      { k: 'inner', label: 'Wewnętrzny (otwór)', t: 'bool', d: false },
    ],
    circle: (v) => ({ x: v.x, y: v.y, R: v.r, center: v.center, inner: v.inner }),
    path(v, common) { const p = circlePlan(this.circle(v), common.bladeWidth); return [circlePath(p.C, p.Rc)]; },
    build(pb, v, common) { addCircle(pb, this.circle(v), cutParams({ x0: 0, y0: 0, x1: 1, y1: 0 }, common)); },
  },
  {
    id: 'ellipse', name: 'Elipsa', plc: 'CutElipseST',
    fields: [
      { k: 'xs', label: 'Górny wierzchołek X', t: 'num', d: 1500 }, { k: 'ys', label: 'Górny wierzchołek Y', t: 'num', d: 1500 },
      { k: 'length', label: 'Długość (oś X) [mm]', t: 'num', d: 1400 }, { k: 'width', label: 'Szerokość (oś Y) [mm]', t: 'num', d: 900 },
    ],
    path(v) { return v.length > 0 && v.width > 0 ? [ellipsePoints(v.xs, v.ys, v.length, v.width).pts] : []; },
    build(pb, v, common) { addEllipse(pb, v, cutParams({ x0: 0, y0: 0, x1: 1, y1: 0 }, common)); },
  },
  {
    id: 'profile', name: 'Profil krawędzi', plc: 'ProgramAutoProfileST (kroki 8-11) + CutST',
    fields: [
      { k: 'x0', label: 'Początek profilu X', t: 'num', d: 600 }, { k: 'y0', label: 'Początek profilu Y', t: 'num', d: 400 },
      { k: 'x1', label: 'Koniec profilu X', t: 'num', d: 640 }, { k: 'y1', label: 'Koniec profilu Y', t: 'num', d: 400 },
      { k: 'd0', label: 'Głębokość na początku [mm]', t: 'num', d: 0 }, { k: 'd1', label: 'Głębokość na końcu [mm]', t: 'num', d: 30 },
      { k: 'r', label: 'Promień profilu [mm]', t: 'num', d: 40 }, { k: 'length', label: 'Długość cięć [mm]', t: 'num', d: 1000 },
      { k: 'convex', label: 'Wypukły (inaczej wklęsły)', t: 'bool', d: true },
      { k: 'jump', label: 'Skok między cięciami [mm]', t: 'num', d: 5 },
      { k: 'smooth', label: 'Wygładzanie po profilu', t: 'bool', d: true },
      { k: 'sJump', label: 'Skok wygładzania [mm]', t: 'num', d: 100 },
    ],
    row(v) {
      const xProfile = v.y0 === v.y1;
      return { P0: [v.x0, v.y0], P1: [v.x1, v.y1], d0: v.d0, d1: v.d1, R: v.r, length: v.length, convex: v.convex, xProfile, jump: v.jump };
    },
    lines(v) { return profileCuts(this.row(v)).cuts; },
    build(pb, v, common) {
      const row = this.row(v);
      addProfile(pb, row, common);
      if (v.smooth) addSmoothing(pb, [{ ...row, jump: v.sJump }], common);
    },
  },
];

// Podglad toru: luk (punkty tarczy) i okrag
function arcPath(p) {
  const t0 = Math.atan2(p.S[1] - p.C[1], p.S[0] - p.C[0]);
  let t1 = Math.atan2(p.E[1] - p.C[1], p.E[0] - p.C[0]);
  if (p.cw) { while (t1 > t0) t1 -= 2 * Math.PI; } else { while (t1 < t0) t1 += 2 * Math.PI; }
  return Array.from({ length: 65 }, (_, i) => { const t = t0 + (t1 - t0) * i / 64; return [p.C[0] + p.R * Math.cos(t), p.C[1] + p.R * Math.sin(t)]; });
}
function circlePath(C, R) {
  return Array.from({ length: 97 }, (_, i) => { const t = 2 * Math.PI * i / 96; return [C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)]; });
}

export const opById = (id) => OPS.find((o) => o.id === id);

// Wartosci domyslne pol
export function defaults(fields) {
  return Object.fromEntries(fields.map((f) => [f.k, parseField(f, f.d)]));
}

// Odczyt wartosci pola z tekstu / checkboxa
export function parseField(f, raw) {
  if (f.t === 'bool') return Boolean(raw);
  if (f.t === 'list') return String(raw).split(/[;,\s]+/).map(Number).filter((n) => Number.isFinite(n));
  if (f.t === 'sel') return Number.isFinite(Number(raw)) && raw !== '' && typeof f.d === 'number' ? Number(raw) : raw;
  const n = Number(raw);
  return f.t === 'int' ? Math.round(n) : n;
}
