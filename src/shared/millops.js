// Frez (#131): programy frezu jak w PLC (MillST, MillArcST, MillCircleST, MillElipseST, MillStripesST, MillBlocksST,
// EdgesST w trybie frezu, ProgramAutoMillST + MillShapeST) - tryb frezu po bazowaniu (A 0, B 90 - A nie idzie za
// styczna luku). Punkty w polach to punkty narzedzia, os = narzedzie + (0, -fParameterMillTiltDiameter/2) (A 0).
// Z dla glebokosci d: Zd(d) = fMillMaterialHeight - (CutTiltDiameter/2 + MillLength + Correction) + d (MillST.GetNextDepth).
// Tablica glebokosci frezu (Depths): T = fParameterMaterialThickness + fMillDepthMillReserve - rowne przejscia,
// staly skok (fMillDepthMillHeight, fMillDepthMinLastJumpDistance) albo jedno przejscie.
// Przejscia na zmiane w obie strony; bez bServiceMillZFirst zjazd w Z w trakcie ruchu (fCutOvertakingPrecent dlugosci)
// i przejscie czyszczace na koncowej glebokosci, z bServiceMillZFirst - najpierw Z, potem przejscie (bez czyszczacego).
// Predkosc toru: fVelocityMillMode (Parametry: praca XY), Z w dol fVelocityAxisZWork, w gore fVelocityAxisZApproach.

import { plcToolAxisXY, workAxisZ, lineAngle } from './geometry.js';
import { arcCenter, threePointArc, chordRadius } from './arcs.js';
import { MILL } from './figures/common.js';
import { INTERNAL } from './common.js';

const DEG = Math.PI / 180;

// Wspolne parametry frezu (Depths frezu, serwis MillST) - w zakladce Operacja zamiast parametrow ciecia
export const MILL_COMMON_FIELDS = [
  { k: 'reserve', label: 'Zapas głębokości [mm] (fMillDepthMillReserve)', t: 'num', d: 0 },
  { k: 'depthMode', label: 'Tablica głębokości frezu', t: 'sel', d: 'same', o: [['same', 'równe przejścia'], ['step', 'stały skok'], ['one', 'jedno przejście']] },
  { k: 'passes', label: 'Przejścia (iMillDepthPrimaryNumber)', t: 'int', d: 3, show: (v) => v.depthMode === 'same' },
  { k: 'step', label: 'Skok głębokości [mm] (fMillDepthMillHeight)', t: 'num', d: 10, show: (v) => v.depthMode === 'step' },
  { k: 'minLast', label: 'Min. ostatni skok [mm] (fMillDepthMinLastJumpDistance)', t: 'num', d: 2, show: (v) => v.depthMode === 'step' },
  { k: 'zFirst', label: 'Najpierw Z, potem przejście (bServiceMillZFirst)', t: 'bool', d: false, svc: 'bServiceMillZFirst' },
  { k: 'overtaking', label: 'Zjazd na % długości (fCutOvertakingPrecent)', t: 'num', d: 70, show: (v) => !v.zFirst },
  { k: 'above', label: 'Wyjazd nad materiał [mm] (fParameterZMoveAboveMaterial)', t: 'num', d: 20 },
];
export const MILL_COMMON_DEFAULTS = { reserve: 0, depthMode: 'same', passes: 3, step: 10, minLast: 2, zFirst: false, overtaking: 70, above: 20 };

// Tablica glebokosci frezu (aMillDepthPrimary) dla grubosci thickness
export function millDepths(c, thickness) {
  const T = Math.max(0, thickness + (c.reserve || 0));
  if (c.depthMode === 'one' || T <= 0) return [T];
  if (c.depthMode === 'step') {
    const h = c.step > 0 ? c.step : T;
    let n = Math.max(1, Math.ceil(T / h - 1e-9));
    if (n > 1 && T - h * (n - 1) < (c.minLast || 0)) n -= 1;
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? T : h * (i + 1)));
  }
  const n = Math.max(1, Math.round(c.passes || 1));
  return Array.from({ length: n }, (_, i) => T / n * (i + 1));
}

// Kontekst programu frezu: pozycje osi z punktow narzedzia, Z glebokosci
function ctx(pb, common) {
  const m = pb.m;
  const c = { ...MILL_COMMON_DEFAULTS, ...(common || {}) };
  return {
    m, c,
    Zd: (d) => workAxisZ(d, 90, m),
    pose: (P, z) => { const [x, y] = plcToolAxisXY(P[0], P[1], 0, 90, m); return { x, y, z, a: 0, b: 90 }; },
    depths: millDepths(c, c.thickness ?? m.materialThickness),
    vel: pb.dyn.cutVel,
  };
}

// GoToPositionST: Z nad material (gdy nizej), XY + A 0, B 90, Z na powierzchnie
function approach(pb, k, P, step = 'GoToPosition') {
  const p = k.pose(P, k.Zd(0));
  pb.goto({ x: p.x, y: p.y, a: 0, b: 90, z: p.z }, k.c.above, step);
}

const finish = (pb, k, step = 'MoveAboveMaterial') => pb.zUp(k.Zd(-k.c.above), step);

// --- MillST: linia ----------------------------------------------------------------------------------------------
// opts.onePass - jedno przejscie na glebokosci opts.depth (bMillWiithoutZUp / MillWithoutZ), opts.noLift - bez wyjazdu
export function addMillLine(pb, A, B, common, opts = {}) {
  const k = ctx(pb, common);
  const depths = opts.onePass ? [opts.depth ?? k.depths[k.depths.length - 1]] : k.depths;
  const zFirst = opts.zFirst ?? k.c.zFirst;
  approach(pb, k, A);
  let last = null;
  depths.forEach((d, i) => {
    const plus = i % 2 === 0;
    const [P0, P1] = plus ? [A, B] : [B, A];
    const z = k.Zd(d);
    if (zFirst) {
      pb.axesTo({ z }, 'MillZDown');
      pb.linearTo(k.pose(P1, z), 'Mill', k.vel);
    } else {
      // zjazd w trakcie ruchu: do punktu posredniego (fCutOvertakingPrecent dlugosci) na glebokosci, dalej do konca
      const t = Math.min(1, Math.max(0, k.c.overtaking / 100));
      const mid = [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
      pb.pathTo([k.pose(mid, z), k.pose(P1, z)], 'Mill', k.vel);
    }
    last = { P0, P1, z };
  });
  // przejscie czyszczace na koncowej glebokosci (bez ZFirst): z powrotem po linii
  if (!zFirst && last) pb.linearTo(k.pose(last.P0, last.z), 'MillLast', k.vel);
  if (!opts.noLift) finish(pb, k);
  return pb;
}

// --- MillArcST: luk (promien, trzy punkty, strzalka) ------------------------------------------------------------
// Zejscie helikalne na calym luku, kierunek na zmiane, przejscie czyszczace w druga strone; includeTool -
// bManualArcIncludeToolDiameter: promien - fParameterMillWidth/2, konce zblizone o polowe szerokosci wzdluz cieciwy
export function arcGeometry(S, E, R, cw, includeTool, millWidth) {
  let s = S;
  let e = E;
  let r = R;
  if (includeTool) {
    r = R - millWidth / 2;
    const L = Math.hypot(E[0] - S[0], E[1] - S[1]) || 1;
    const u = [(E[0] - S[0]) / L, (E[1] - S[1]) / L];
    s = [S[0] + u[0] * millWidth / 2, S[1] + u[1] * millWidth / 2];
    e = [E[0] - u[0] * millWidth / 2, E[1] - u[1] * millWidth / 2];
  }
  const chord = Math.hypot(e[0] - s[0], e[1] - s[1]);
  if (!(r > 0) || chord < 1e-6) return null;
  r = Math.max(r, chord / 2 + 0.01);
  return { S: s, E: e, R: r, cw, C: arcCenter(s, e, r, cw) };
}

// Punkty luku od P0 do P1 wokol C w kierunku cw (narzedzie), Z liniowo z0 -> z1
function arcPts(C, P0, P1, cw, z0, z1, k, full = false) {
  const r = Math.hypot(P0[0] - C[0], P0[1] - C[1]);
  const t0 = Math.atan2(P0[1] - C[1], P0[0] - C[0]);
  let t1 = Math.atan2(P1[1] - C[1], P1[0] - C[0]);
  if (full) t1 = t0 + (cw ? -2 * Math.PI : 2 * Math.PI);
  else if (cw) { while (t1 > t0 - 1e-9) t1 -= 2 * Math.PI; } else { while (t1 < t0 + 1e-9) t1 += 2 * Math.PI; }
  const n = Math.max(4, Math.ceil(Math.abs(t1 - t0) * r / 10));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = t0 + (t1 - t0) * i / n;
    out.push(k.pose([C[0] + r * Math.cos(t), C[1] + r * Math.sin(t)], z0 + (z1 - z0) * i / n));
  }
  return out;
}

export function addMillArc(pb, arc, common, opts = {}) {
  const k = ctx(pb, common);
  const g = arcGeometry(arc.S, arc.E, arc.R, arc.cw, arc.includeTool, k.m.millWidth);
  if (!g) return null;
  const zFirst = k.c.zFirst;
  approach(pb, k, g.S);
  let zPrev = k.Zd(0);
  let last = null;
  k.depths.forEach((d, i) => {
    const plus = i % 2 === 0;
    const [P0, P1, cw] = plus ? [g.S, g.E, g.cw] : [g.E, g.S, !g.cw];
    const z = k.Zd(d);
    if (zFirst) { pb.axesTo({ z }, 'MillZDown'); zPrev = z; }
    pb.pathTo(arcPts(g.C, P0, P1, cw, zPrev, z, k), plus ? 'MillArc' : 'MillArcBack', k.vel);
    zPrev = z;
    last = { P0, P1, cw, z };
  });
  if (!zFirst && last) pb.pathTo(arcPts(g.C, last.P1, last.P0, !last.cw, last.z, last.z, k), 'MillArcLast', k.vel);
  if (!opts.noLift) finish(pb, k);
  return g;
}

// --- MillCircleST: okrag ------------------------------------------------------------------------------------------
// promien + / - fParameterMillWidth/2 (zewn. / wewn.), bez bManualCircleCenter punkt = gora toru (srodek przesuwa sie),
// pierwsza polowa okregu z zejsciem Z, druga na stalym Z, na koncu pelny okrag czyszczacy; CW (serwis: CCW)
export function circleGeometry(c, millWidth) {
  const r = c.internal === 0 ? c.r + millWidth / 2 : c.internal === 1 ? c.r - millWidth / 2 : c.r;
  if (!(r > 0)) return null;
  const C = c.center ? [c.x, c.y] : [c.x, c.y - r];
  return { C, r, start: [C[0], C[1] + r], mid: [C[0], C[1] - r], cw: !c.reverse };
}

export function addMillCircle(pb, circle, common, opts = {}) {
  const k = ctx(pb, common);
  const g = circleGeometry(circle, k.m.millWidth);
  if (!g) return null;
  approach(pb, k, g.start);
  let z = k.Zd(0);
  for (const d of k.depths) {
    const z1 = k.Zd(d);
    if (k.c.zFirst) { pb.axesTo({ z: z1 }, 'MillZDown'); z = z1; }
    pb.pathTo([...arcPts(g.C, g.start, g.mid, g.cw, z, z1, k), ...arcPts(g.C, g.mid, g.start, g.cw, z1, z1, k)], 'MillCircle', k.vel);
    z = z1;
  }
  if (!k.c.zFirst) pb.pathTo(arcPts(g.C, g.start, g.start, g.cw, z, z, k, true), 'MillCircleLast', k.vel);
  if (!opts.noLift) finish(pb, k);
  return g;
}

// --- MillElipseST: elipsa ------------------------------------------------------------------------------------------
// start = lewy wierzcholek, dlugosc / szerokosc + / - fParameterMillWidth (iInner >= 1 - minus), polowa gorna (+Y) i
// powrot dolna, 120 odcinkow (gesciej przy wierzcholkach); zejscie Z na pierwszym odcinku, na koncu odcinek 0 jeszcze raz
export function ellipseGeometry(e, millWidth) {
  const comp = e.internal >= 1 ? -millWidth : millWidth;
  const a = (e.length + comp) / 2;
  const b = (e.width + comp) / 2;
  if (!(a > 0) || !(b > 0)) return null;
  const pts = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - Math.PI * i / n;                // od lewego wierzcholka gora do prawego
    pts.push([e.xs + a + a * Math.cos(t), e.ys + b * Math.sin(t)]);
  }
  for (let i = 1; i <= n; i++) {
    const t = -Math.PI * i / n;                          // dolem z powrotem
    pts.push([e.xs + a + a * Math.cos(t), e.ys + b * Math.sin(t)]);
  }
  pts[pts.length - 1] = pts[0];
  return { pts, a, b };
}

export function addMillEllipse(pb, ell, common, opts = {}) {
  const k = ctx(pb, common);
  const g = ellipseGeometry(ell, k.m.millWidth);
  if (!g) return null;
  approach(pb, k, g.pts[0]);
  let z = k.Zd(0);
  for (const d of k.depths) {
    const z1 = k.Zd(d);
    if (k.c.zFirst) { pb.axesTo({ z: z1 }, 'MillZDown'); z = z1; }
    pb.pathTo([k.pose(g.pts[1], z1), ...g.pts.slice(2).map((p) => k.pose(p, z1))], 'MillElipse', k.vel);
    z = z1;
  }
  if (!k.c.zFirst) pb.linearTo(k.pose(g.pts[1], z), 'MillElipseLast', k.vel);
  if (!opts.noLift) finish(pb, k);
  return g;
}

// --- MillShapeST: zamkniety ksztalt z automatu (wszystkie segmenty na kazdej glebokosci) ------------------------
// segs: [{type: MILL.*, P: [x, y], r}], ostatni punkt = pierwszy; Z w dol na pierwszym segmencie (bez ZFirst - w trakcie)
export function addMillShape(pb, segs, common) {
  const k = ctx(pb, common);
  if (segs.length < 2) return null;
  const pathAt = (z0, z1, only0 = false) => {
    const out = [];
    let zc = z0;
    for (let i = 0; i + 1 < segs.length && (!only0 || i === 0); i++) {
      const s = segs[i];
      const P0 = s.P;
      const P1 = segs[i + 1].P;
      if (s.type === MILL.MillArcCW || s.type === MILL.MillArcCCW) {
        const g = arcGeometry(P0, P1, s.r, s.type === MILL.MillArcCW, false, 0);
        if (g) out.push(...arcPts(g.C, P0, P1, g.cw, zc, z1, k));
        else out.push(k.pose(P1, z1));
      } else {
        out.push(k.pose(P1, z1));
      }
      zc = z1;
    }
    return out;
  };
  approach(pb, k, segs[0].P);
  let z = k.Zd(0);
  for (const d of k.depths) {
    const z1 = k.Zd(d);
    if (k.c.zFirst) { pb.axesTo({ z: z1 }, 'MillZDown'); z = z1; }
    pb.pathTo(pathAt(z, z1), 'MillShape', k.vel);
    z = z1;
  }
  if (!k.c.zFirst) pb.pathTo(pathAt(z, z, true), 'MillShapeLast', k.vel);
  finish(pb, k);
  return segs;
}

// --- linie programow (pasy, bloki, krawedzie) -------------------------------------------------------------------

// MillStripesST: linie stalej szerokosci (W = szerokosc pasa; odstep W + fParameterMillWidth - kompensacja frezu),
// wzdluz X (xCut) albo Y; kat + dlugosc (kat od osi Y: X += L sin a, Y += L cos a) albo dwa punkty; tryb stolu
// (bMillTableStart): N = tableWidth / fParameterMillWidth linii co szerokosc frezu, jedno przejscie na pelna glebokosc
export function millStripesLines(v, millWidth) {
  const table = Boolean(v.table);
  const n = table ? Math.trunc(v.tableWidth / millWidth) : Math.max(0, Math.round(v.number));
  const W = table ? 0 : v.width;
  const L = table ? v.tableLength : v.length;
  const out = [];
  for (let i = 0; i <= n; i++) {
    let zero;
    let end;
    if (!table && v.twoPoint) {
      zero = [v.xs, v.ys];
      end = [v.xe, v.ye];
      if (!v.angleCut) end = v.xCut ? [v.xe, v.ys] : [v.xs, v.ye];
    } else if (!table && v.angleCut) {
      const a = v.angle * DEG;
      zero = [v.xs, v.ys];
      end = [v.xs + L * Math.sin(a), v.ys + L * Math.cos(a)];
    } else {
      zero = [v.xs, v.ys];
      end = v.xCut ? [v.xs + L, v.ys] : [v.xs, v.ys + L];
    }
    const shift = v.xCut ? [0, W * i] : [W * i, 0];
    zero = [zero[0] + shift[0], zero[1] + shift[1]];
    end = [end[0] + shift[0], end[1] + shift[1]];
    // kompensacja frezu: przesuniecie o szerokosc frezu * i w strone kolejnych pasow (GetAngleFun linii)
    const ang = lineAngle(zero[0], zero[1], end[0], end[1]) * DEG;
    const cx = Math.abs(Math.sin(ang)) * millWidth * i;
    const cy = Math.abs(Math.cos(ang)) * millWidth * i;
    zero = [zero[0] + (v.xCut ? 0 : cx), zero[1] + (v.xCut ? cy : 0)];
    end = [end[0] + (v.xCut ? 0 : cx), end[1] + (v.xCut ? cy : 0)];
    out.push({ zero, end });
  }
  return out;
}

// MillBlocksST: faza X - linie od (Xs, Ys + suma szerokosci) dlugosci XLast, faza Y - od (Xs + suma dlugosci, Ys)
// dlugosci YLast; przesuniecie o fParameterMillWidth * n (w fazie Y w PLC takze Y calej linii - jak w PLC)
export function millBlocksLines(v, millWidth) {
  const out = [];
  let yDone = 0;
  const widths = v.widths || [];
  for (let n = 0; n <= widths.length; n++) {
    if (n > 0) yDone += widths[n - 1];
    const y = v.ys + yDone + Math.sign(widths[0] || 1) * millWidth * n;
    out.push({ zero: [v.xs, y], end: [v.xs + v.xLast, y], phase: 'X' });
  }
  let xDone = 0;
  const lengths = v.lengths || [];
  for (let n = 0; n <= lengths.length; n++) {
    if (n > 0) xDone += lengths[n - 1];
    const s = Math.sign(lengths[0] || 1) * millWidth * n;
    const x = v.xs + xDone + s;
    out.push({ zero: [x, v.ys + s], end: [x, v.ys + v.yLast + s], phase: 'Y' });
  }
  return out;
}

// EdgesST w trybie frezu: prostokat od naroznika S, dlugosc / szerokosc + / - fParameterMillWidth (zewn. / wewn.),
// kat; krawedzie P0-P1, P1-P2, P2-P3, P3-P0 - kazda MillST (dwa punkty)
export function millEdgesLines(v, millWidth) {
  const comp = v.internal === 1 ? -millWidth : millWidth;
  const L = v.length + comp;
  const W = v.width + comp;
  const a = v.angle * DEG;
  const S = [v.xs, v.ys];
  const P1 = [S[0] + L * Math.cos(a), S[1] + L * Math.sin(a)];
  const P2 = [P1[0] - W * Math.sin(a), P1[1] + W * Math.cos(a)];
  const P3 = [S[0] - W * Math.sin(a), S[1] + W * Math.cos(a)];
  const P = [S, P1, P2, P3];
  return [0, 1, 2, 3].map((e) => ({ zero: P[e], end: P[(e + 1) % 4] }));
}

// Kolejne linie przez MillST z 1-2 s przerwy (start po zatrzymaniu osi), swap - zaczynaj od konca poprzedniej
function millLines(pb, lines, common, opts = {}) {
  const k = ctx(pb, common);
  const odd = k.depths.length % 2 === 1 && !opts.onePass;
  lines.forEach((l, i) => {
    if (i > 0) pb.dwell(opts.wait ?? 2, 'WAIT_START');
    const swap = opts.swap && odd && i % 2 === 1;
    const [A, B] = swap ? [l.end, l.zero] : [l.zero, l.end];
    addMillLine(pb, A, B, common, opts);
  });
}

// --- operacje (zakladka Operacja w trybie frezu) ----------------------------------------------------------------
const lineFields = [
  { k: 'twoPoint', label: 'Dwa punkty (inaczej kąt i długość) – bManualTwoPoint', t: 'bool', d: true },
  { k: 'x0', label: 'Początek X (fManualXZeroPosition)', t: 'num', d: 600 }, { k: 'y0', label: 'Początek Y (fManualYZeroPosition)', t: 'num', d: 600 },
  { k: 'x1', label: 'Koniec X (fManualXEndPosition)', t: 'num', d: 1600, show: (v) => v.twoPoint },
  { k: 'y1', label: 'Koniec Y (fManualYEndPosition)', t: 'num', d: 600, show: (v) => v.twoPoint },
  { k: 'angle', label: 'Kąt [°] (fManualASetPosition)', t: 'num', d: 0, show: (v) => !v.twoPoint },
  { k: 'length', label: 'Długość [mm] (fManualLenght)', t: 'num', d: 1000, show: (v) => !v.twoPoint },
];
const lineEnds = (v) => {
  if (v.twoPoint !== false) return [[v.x0, v.y0], [v.x1, v.y1]];
  const a = v.angle * DEG;
  return [[v.x0, v.y0], [v.x0 + Math.cos(a) * v.length, v.y0 + Math.sin(a) * v.length]];
};
const circlePath = (C, r) => Array.from({ length: 97 }, (_, i) => [C[0] + r * Math.cos(2 * Math.PI * i / 96), C[1] + r * Math.sin(2 * Math.PI * i / 96)]);
const MILL_INTERNAL = [[0, 'zewnętrzny (+ promień frezu)'], [1, 'wewnętrzny (− promień frezu)'], [2, 'po linii']];

export const MILL_OPS = [
  {
    id: 'millLine', mode: 'mill', name: 'Frezowanie linii', plc: 'MillST',
    saves: [{ x: 'x0', y: 'y0', name: 'początek', plc: 'bManualXSaveZero, bManualYSaveZero' }, { x: 'x1', y: 'y1', name: 'koniec', plc: 'bManualEndPositionSave' }],
    fields: lineFields,
    points: lineEnds,
    path(v) { return [lineEnds(v)]; },
    build(pb, v, common) { const [A, B] = lineEnds(v); addMillLine(pb, A, B, common); },
  },
  {
    id: 'millArc', mode: 'mill', name: 'Frezowanie łuku', plc: 'MillArcST',
    saves: [{ x: 'x0', y: 'y0', name: 'początek', plc: 'bManualArcZeroPositionSave' }, { x: 'x1', y: 'y1', name: 'koniec', plc: 'bManualArcEndPositionSave' },
      { x: 'xm', y: 'ym', name: 'punkt środkowy', plc: 'bManualArcMiddlePositionSave' }],
    fields: [
      { k: 'x0', label: 'Początek X (fManualArcXZeroPosition)', t: 'num', d: 600 }, { k: 'y0', label: 'Początek Y (fManualArcYZeroPosition)', t: 'num', d: 500 },
      { k: 'x1', label: 'Koniec X (fManualArcXEndPosition)', t: 'num', d: 1600 }, { k: 'y1', label: 'Koniec Y (fManualArcYEndPosition)', t: 'num', d: 500 },
      { k: 'type', label: 'Rodzaj łuku', t: 'sel', d: 0, o: [[0, 'promień'], [1, 'trzy punkty (bManualArcThreePoints)'], [2, 'cięciwa (bManualArcChord)']] },
      { k: 'r', label: 'Promień R [mm] (fManualArcRadius)', t: 'num', d: 800, show: (v) => v.type === 0 },
      { k: 'cw', label: 'Zgodnie z zegarem (bManualArcClockwise)', t: 'bool', d: true, show: (v) => v.type !== 1 },
      { k: 'xm', label: 'Punkt środkowy X', t: 'num', d: 1100, show: (v) => v.type === 1 },
      { k: 'ym', label: 'Punkt środkowy Y', t: 'num', d: 700, show: (v) => v.type === 1 },
      { k: 'sagitta', label: 'Strzałka [mm] (fManualArcChord)', t: 'num', d: 150, show: (v) => v.type === 2 },
      { k: 'includeTool', label: 'Uwzględnij średnicę frezu (bManualArcIncludeToolDiameter)', t: 'bool', d: false },
    ],
    arc(v) {
      const S = [v.x0, v.y0]; const E = [v.x1, v.y1];
      if (v.type === 1) { const t = threePointArc(S, [v.xm, v.ym], E); return t && { S, E, R: t.R, cw: t.cw, includeTool: v.includeTool }; }
      if (v.type === 2) return { S, E, R: chordRadius(S, E, v.sagitta), cw: v.cw, includeTool: v.includeTool };
      return { S, E, R: v.r, cw: v.cw, includeTool: v.includeTool };
    },
    path(v, common, m) {
      const a = this.arc(v);
      const g = a && arcGeometry(a.S, a.E, a.R, a.cw, a.includeTool, m?.millWidth ?? 0);
      if (!g) return [];
      const k = { pose: (P) => ({ x: P[0], y: P[1] }) };
      return [[g.S, ...arcPts(g.C, g.S, g.E, g.cw, 0, 0, k).map((p) => [p.x, p.y])]];
    },
    build(pb, v, common) { const a = this.arc(v); if (a) addMillArc(pb, a, common); },
  },
  {
    id: 'millCircle', mode: 'mill', name: 'Frezowanie okręgu', plc: 'MillCircleST',
    saves: [{ x: 'x', y: 'y', name: 'punkt', plc: 'bManualArcZeroPositionSave' }],
    fields: [
      { k: 'x', label: 'Punkt X (fManualArcXZeroPosition)', t: 'num', d: 1500 }, { k: 'y', label: 'Punkt Y (fManualArcYZeroPosition)', t: 'num', d: 1200 },
      { k: 'center', label: 'Punkt = środek (bManualCircleCenter, inaczej góra toru)', t: 'bool', d: true },
      { k: 'r', label: 'Promień R [mm] (fManualArcRadius)', t: 'num', d: 300 },
      { k: 'internal', label: 'Rodzaj (iManualInternal)', t: 'sel', d: 1, o: MILL_INTERNAL },
      { k: 'reverse', label: 'Przeciwnie do zegara (bServiceMillCircleReverse)', t: 'bool', d: false, svc: 'bServiceMillCircleReverse' },
    ],
    path(v, common, m) { const g = circleGeometry(v, m?.millWidth ?? 0); return g ? [circlePath(g.C, g.r)] : []; },
    marks: (v) => [[v.x, v.y]],
    build(pb, v, common) { addMillCircle(pb, v, common); },
  },
  {
    id: 'millEllipse', mode: 'mill', name: 'Frezowanie elipsy', plc: 'MillElipseST',
    saves: [{ x: 'xs', y: 'ys', name: 'start', plc: 'bManualElipseSaveZeroPosition' }],
    fields: [
      { k: 'xs', label: 'Lewy wierzchołek X (fManualElipseXStartPosition)', t: 'num', d: 800 },
      { k: 'ys', label: 'Lewy wierzchołek Y (fManualElipseYStartPosition)', t: 'num', d: 1000 },
      { k: 'length', label: 'Długość (oś X) [mm] (fManualElipseLength)', t: 'num', d: 1000 },
      { k: 'width', label: 'Szerokość (oś Y) [mm] (fManualElipseWidth)', t: 'num', d: 600 },
      { k: 'internal', label: 'Rodzaj (iManualInternal)', t: 'sel', d: 1, o: MILL_INTERNAL.slice(0, 2) },
    ],
    path(v, common, m) { const g = ellipseGeometry(v, m?.millWidth ?? 0); return g ? [g.pts] : []; },
    build(pb, v, common) { addMillEllipse(pb, v, common); },
  },
  {
    id: 'millStripes', mode: 'mill', name: 'Frezowanie pasów', plc: 'MillStripesST',
    saves: [{ x: 'xs', y: 'ys', name: 'start', plc: 'bManualStripesStartSaveX, bManualStripesStartSaveY' }, { x: 'xe', y: 'ye', name: 'koniec', plc: 'bCutStripesEndPositionSave' }],
    fields: [
      { k: 'table', label: 'Frezowanie stołu (bMillTableStart)', t: 'bool', d: false },
      { k: 'xs', label: 'Start X (fManualStripesXStartPosition)', t: 'num', d: 500 }, { k: 'ys', label: 'Start Y (fManualStripesYStartPosition)', t: 'num', d: 500 },
      { k: 'xCut', label: 'Linie wzdłuż X (bManualStripesXCut)', t: 'bool', d: true },
      { k: 'twoPoint', label: 'Dwa punkty (bManualStripesTwoPoint)', t: 'bool', d: false, show: (v) => !v.table },
      { k: 'xe', label: 'Koniec X (fManualStripesXEndPosition)', t: 'num', d: 1500, show: (v) => !v.table && v.twoPoint },
      { k: 'ye', label: 'Koniec Y (fManualStripesYEndPosition)', t: 'num', d: 500, show: (v) => !v.table && v.twoPoint },
      { k: 'angleCut', label: 'Pod kątem (bManualStripesAngleCut)', t: 'bool', d: false, show: (v) => !v.table },
      { k: 'angle', label: 'Kąt [°] od osi Y (fManualStripesAngleSet)', t: 'num', d: 90, show: (v) => !v.table && v.angleCut && !v.twoPoint },
      { k: 'length', label: 'Długość [mm] (fManualStripesLength)', t: 'num', d: 1000, show: (v) => !v.table && !v.twoPoint },
      { k: 'width', label: 'Szerokość pasa [mm] (fManualStripesWidthSet)', t: 'num', d: 200, show: (v) => !v.table },
      { k: 'number', label: 'Liczba pasów (iManualStripesNumberSet)', t: 'int', d: 3, show: (v) => !v.table },
      { k: 'tableLength', label: 'Długość stołu [mm] (fManualTableLength)', t: 'num', d: 1000, show: (v) => v.table },
      { k: 'tableWidth', label: 'Szerokość stołu [mm] (fManualTableWidth)', t: 'num', d: 300, show: (v) => v.table },
      { k: 'swap', label: 'Zamiana kierunku linii (bServiceAllowSwap)', t: 'bool', d: false, svc: 'bServiceAllowSwap' },
    ],
    lines(v, common, m) { return millStripesLines(v, m?.millWidth ?? 0).map((l) => ({ x0: l.zero[0], y0: l.zero[1], x1: l.end[0], y1: l.end[1] })); },
    build(pb, v, common) {
      const lines = millStripesLines(v, pb.m.millWidth);
      millLines(pb, lines, common, v.table ? { onePass: true, swap: v.swap } : { swap: v.swap });
    },
  },
  {
    id: 'millBlocks', mode: 'mill', name: 'Frezowanie bloków', plc: 'MillBlocksST',
    saves: [{ x: 'xs', y: 'ys', name: 'start', plc: 'bManualBlocksStartPositionSave90, bManualBlocksStartPositionSave' }],
    fields: [
      { k: 'xs', label: 'Start X (fManualBlocksXStartPosition)', t: 'num', d: 500 }, { k: 'ys', label: 'Start Y (fManualBlocksYStartPosition)', t: 'num', d: 400 },
      { k: 'xLast', label: 'Długość linii X [mm] (fManualBlocksXLastPosition)', t: 'num', d: 1200 },
      { k: 'yLast', label: 'Długość linii Y [mm] (fManualBlocksYLastPosition)', t: 'num', d: 800 },
      { k: 'widths', label: 'Szerokości bloków w Y (aManualBlocksWidths)', t: 'list', d: '400, 400' },
      { k: 'lengths', label: 'Długości bloków w X (aManualBlocksLengths)', t: 'list', d: '600, 600' },
    ],
    lines(v, common, m) { return millBlocksLines(v, m?.millWidth ?? 0).map((l) => ({ x0: l.zero[0], y0: l.zero[1], x1: l.end[0], y1: l.end[1] })); },
    build(pb, v, common) { millLines(pb, millBlocksLines(v, pb.m.millWidth), common, { wait: 1, swap: true }); },
  },
  {
    id: 'millEdges', mode: 'mill', name: 'Frezowanie krawędzi (prostokąt)', plc: 'EdgesST (frez)',
    saves: [{ x: 'xs', y: 'ys', name: 'narożnik', plc: 'bEdgesStartPositionSave' }],
    fields: [
      { k: 'xs', label: 'Narożnik X (fEdgesXStartPosition)', t: 'num', d: 600 }, { k: 'ys', label: 'Narożnik Y (fEdgesYStartPosition)', t: 'num', d: 500 },
      { k: 'length', label: 'Długość [mm] (fEdgesLength)', t: 'num', d: 1200 }, { k: 'width', label: 'Szerokość [mm] (fEdgesWidth)', t: 'num', d: 700 },
      { k: 'angle', label: 'Kąt [°] (fEdgesAngle)', t: 'num', d: 0 },
      { k: 'internal', label: 'Rodzaj (iManualInternal)', t: 'sel', d: 0, o: INTERNAL.slice(0, 2) },
    ],
    lines(v, common, m) { return millEdgesLines(v, m?.millWidth ?? 0).map((l) => ({ x0: l.zero[0], y0: l.zero[1], x1: l.end[0], y1: l.end[1] })); },
    build(pb, v, common) { millLines(pb, millEdgesLines(v, pb.m.millWidth), common); },
  },
];

// --- ProgramAutoMillST: automat frezu (bufor krokow ProgramMillStep) ----------------------------------------------
const NEEDS_NEXT = new Set([MILL.Mill, MILL.MillInnerFull, MILL.GoToPosition, MILL.MillArcCW, MILL.MillArcCCW, MILL.GoToPositionWithoutZ,
  MILL.MillSlopeDown, MILL.MillSlopeUp, MILL.MillWithoutZ]);
const SHAPE_STEPS = new Set([MILL.Mill, MILL.MillArcCW, MILL.MillArcCCW]);
const SHAPE_END = new Set([MILL.Nothing, MILL.GoToPosition, MILL.GoToPositionWithoutZ, MILL.MillSlopeDown, MILL.MillSlopeUp]);

// Kolejne kroki od punktu i do i+1 (punkty wzgledem punktu startowego). opts.closedShapes - bProgramReapitingOver:
// zamkniete ksztalty (linie / luki do punktu startowego) w calosci przez MillShapeST
export function addAutomatMill(pb, rows, count, origin, common, opts = {}) {
  const P = (r) => [origin[0] + r.x, origin[1] + r.y];
  let c = { ...MILL_COMMON_DEFAULTS, ...(common || {}) };
  let i = opts.startIndex || 0;
  while (i < count) {
    const row = rows[i];
    const st = row.step;
    if (NEEDS_NEXT.has(st) && i + 1 >= rows.length) { i++; continue; }
    pb.label = `Krok ${i + 1}`;
    pb.stepIndex = i;
    // zamkniety ksztalt (CheckClosedShape): od i do pierwszego wiersza konczacego, punkt koncowy = punkt i
    if (opts.closedShapes && SHAPE_STEPS.has(st)) {
      let j = i;
      while (j < count && !SHAPE_END.has(rows[j].step)) j++;
      const end = rows[j] || rows[count];
      if (end && j > i && Math.abs(end.x - row.x) < 1e-6 && Math.abs(end.y - row.y) < 1e-6) {
        const segs = rows.slice(i, j + 1).map((r) => ({ type: r.step, P: P(r), r: r.r }));
        addMillShape(pb, segs, c);
        i = j;
        continue;
      }
    }
    const A = P(row);
    const B = rows[i + 1] ? P(rows[i + 1]) : A;
    const k = ctx(pb, c);
    if (st === MILL.Mill || st === MILL.MillInnerFull) {
      addMillLine(pb, A, B, c);
    } else if (st === MILL.GoToPosition) {
      // GoToPosition do punktu i+1, Z na powierzchni bez ostatniego ruchu (zostaje nad materialem)
      const p = k.pose(B, k.Zd(-c.above));
      pb.goto({ x: p.x, y: p.y, a: 0, b: 90 }, c.above, 'GoToPosition');
    } else if (st === MILL.MillArcCW || st === MILL.MillArcCCW) {
      addMillArc(pb, { S: A, E: B, R: row.r, cw: st === MILL.MillArcCW, includeTool: true }, c);
    } else if (st === MILL.GoToPositionWithoutZ) {
      const b = 90 - (row.angle || 0);
      const [x, y] = plcToolAxisXY(B[0], B[1], 0, b, k.m);
      pb.axesTo({ x, y, b, z: workAxisZ(row.depthEnd || 0, b, k.m) }, 'GoToPositionWithoutZ');
    } else if (st === MILL.MillSlopeDown || st === MILL.MillSlopeUp) {
      addMillSlope(pb, A, B, row, st === MILL.MillSlopeUp, c);
    } else if (st === MILL.Drilling) {
      addMillDrill(pb, A, row.depth, c);
    } else if (st === MILL.ChangeDepth) {
      // ChangeDepth: grubosc z wiersza (tablica glebokosci rowna, ta sama liczba przejsc)
      if (row.depth > 0) c = { ...c, thickness: row.depth, depthMode: 'same', passes: k.depths.length };
    } else if ([MILL.CircleTopPointOuter, MILL.CircleCenterPointOuter, MILL.CircleTopPointInner, MILL.CircleCenterPointInner].includes(st)) {
      addMillCircle(pb, {
        x: A[0], y: A[1], r: row.r,
        center: st === MILL.CircleCenterPointOuter || st === MILL.CircleCenterPointInner,
        internal: st === MILL.CircleTopPointInner || st === MILL.CircleCenterPointInner ? 1 : 0,
      }, c);
    } else if (st === MILL.Confirm) {
      pb.dwell(1, 'Confirm');
    } else if (st === MILL.MillWithoutZ) {
      addMillLine(pb, A, B, c, { onePass: true, depth: k.m.materialThickness + (row.depth || 0), zFirst: true, noLift: true });
    } else if (st === MILL.ElipseOuter || st === MILL.ElipseInner) {
      addMillEllipse(pb, { xs: A[0], ys: A[1], length: row.length, width: row.angle, internal: st === MILL.ElipseInner ? 1 : 0 }, c);
    }
    i++;
  }
  pb.label = null;
  pb.stepIndex = null;
  return pb;
}

// MillSlopeDown / Up (MillST z bManualBAngle): jedno przejscie pod katem B = 90 - kat, A = kat linii -/+ 90,
// Z od glebokosci poczatkowej do koncowej (Up - od konca, bMillReverse)
export function addMillSlope(pb, A, B, row, up, common) {
  const k = ctx(pb, common);
  const bAngle = row.angle || 0;
  const b = 90 - bAngle;
  const la = lineAngle(A[0], A[1], B[0], B[1]);
  const a = up ? la + 90 : la - 90;
  const [P0, P1] = up ? [B, A] : [A, B];
  const d0 = row.depth || 0;
  const d1 = row.depthEnd || (Math.tan(bAngle * DEG) * Math.hypot(B[0] - A[0], B[1] - A[1]) + d0);
  const axis = (P, d) => { const [x, y] = plcToolAxisXY(P[0], P[1], a, b, k.m); return { x, y, z: workAxisZ(d, b, k.m), a, b }; };
  const s = axis(P0, d0);
  pb.goto({ x: s.x, y: s.y, a, b }, k.c.above, 'GoToPosition');
  pb.axesTo({ z: s.z }, 'GoToPosition');
  pb.linearTo(axis(P1, d1), up ? 'MillSlopeUp' : 'MillSlopeDown', k.vel);
  pb.zUp(workAxisZ(-k.c.above, b, k.m), 'MoveAboveMaterial');
}

// Drilling w automacie frezu: DrillST w punkcie wiersza, glebokosc z wiersza
export function addMillDrill(pb, A, depth, common, opts = {}) {
  const k = ctx(pb, common);
  approach(pb, k, A, 'MOVE_TO_START_POSITION');
  pb.dwell(1, 'WAIT_MAIN_DRIVE');
  pb.axesTo({ z: k.Zd(depth) }, 'MOVE_DRILL', opts.zVel ? { z: [opts.zVel, pb.dyn.zAcc] } : null);
  finish(pb, k, 'MOVE_ABOVE_MATERIAL');
}
