// Ciecia po krzywej jak CutArcST / CutCircleST / CutElipseST: interpolacja kolowa w XY (MC_MoveCircularAbsolute),
// glowica A styczna do toru, liniowo od wartosci poczatkowej do koncowej (bez modulo), B = 0.
// Os glowicy: P + (sin A, -cos A) * k0, k0 = -headRotation/2 (plcAxisXY z B = 0).

import { plcAxisXY, plcAxisZ } from './geometry.js';
import { depthTables } from './cutst.js';

const DEG = Math.PI / 180;
const norm180 = (a) => { let x = ((a + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180; return x; };

// Tablica glebokosci luku / okregu: nieparzysta liczba przejsc (koniec w punkcie koncowym),
// bManualLastCutWithDirection - parzysta (jak wybor tablicy w CutArcST / CutCircleST)
export function arcDepths(depth, lastCutWithDirection) {
  const t = depthTables(depth);
  if (!t.secondary.length) return t.primary;
  const wantEven = Boolean(lastCutWithDirection);
  return (t.primary.length % 2 === 0) === wantEven ? t.primary : t.secondary;
}

// Srodek okregu o promieniu R przez S i E (krotszy luk): CCW - srodek po lewej S->E, CW - po prawej (GetFullTanA)
export function arcCenter(S, E, R, cw) {
  const dx = E[0] - S[0]; const dy = E[1] - S[1];
  const c = Math.hypot(dx, dy);
  const h = Math.sqrt(Math.max(0, R * R - (c / 2) ** 2));
  const left = c > 0 ? [-dy / c, dx / c] : [0, 0];
  const sgn = cw ? -1 : 1;
  return [(S[0] + E[0]) / 2 + left[0] * h * sgn, (S[1] + E[1]) / 2 + left[1] * h * sgn];
}

// Kat A w punkcie P okregu o srodku C: (sin A, -cos A) = promien na zewnatrz
export const radialA = (P, C) => Math.atan2(P[0] - C[0], -(P[1] - C[1])) / DEG;

// Promien i kierunek z trzech punktow (GetRadiusFromThreePoints)
export function threePointArc(S, M, E) {
  const ax = S[0]; const ay = S[1]; const bx = M[0]; const by = M[1]; const cx = E[0]; const cy = E[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const cw = (cx - ax) * (by - ay) - (cy - ay) * (bx - ax) > 0;
  return { R: Math.hypot(ax - ux, ay - uy), cw, center: [ux, uy] };
}

// Promien z cieciwy i strzalki (GetMiddlePointsFromChord)
export const chordRadius = (S, E, sagitta) => {
  const c = Math.hypot(E[0] - S[0], E[1] - S[1]);
  return sagitta > 0 ? (c * c / 4 + sagitta * sagitta) / (2 * sagitta) : 0;
};

// Punkty luku (osie) od kata t0 do t1 wokol C, promien r; A liniowo a0 -> a1, Z stale
function arcPoses(C, r, t0, t1, a0, a1, z, extra = {}) {
  const sweep = t1 - t0;
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / (2 * DEG)), Math.ceil(Math.abs(sweep) * r / 20));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const t = t0 + sweep * k;
    out.push({ x: C[0] + r * Math.cos(t), y: C[1] + r * Math.sin(t), z, a: a0 + (a1 - a0) * k, b: 0, ...extra });
  }
  return out;
}

// kat (rad) punktu P wokol C, dopasowany do kierunku obiegu od t0
function sweepTo(t0, P, C, cw) {
  let t1 = Math.atan2(P[1] - C[1], P[0] - C[0]);
  if (cw) { while (t1 > t0 + 1e-12) t1 -= 2 * Math.PI; } else { while (t1 < t0 - 1e-12) t1 += 2 * Math.PI; }
  return t1;
}

// Plan luku: {S, E, R, cw, C, aS, aE, inner} (IsInnerCut: glowica odwrocona, gdy rampa A przeszlaby przez +-180)
export function arcPlan(S, E, R, cw) {
  const chord = Math.hypot(E[0] - S[0], E[1] - S[1]);
  if (!(R > 0) || chord < 1e-6) return null;
  const Rr = R >= chord / 2 ? R : chord / 2 + 0.01;
  const C = arcCenter(S, E, Rr, cw);
  let aS = radialA(S, C);
  let aE = radialA(E, C);
  const inner = cw ? aS >= aE : aS <= aE;
  if (!inner) { aS = norm180(aS + 180); aE = norm180(aE + 180); }
  return { S, E, R: Rr, cw, C, aS, aE, inner };
}

// CutArcST: N przejsc tam i z powrotem po tym samym luku, zjazd Z w miejscu na koncu
export function addArc(pb, arc, c) {
  const m = pb.m;
  const plan = arcPlan(arc.S, arc.E, arc.R, arc.cw);
  if (!plan) return null;
  const depths = arcDepths(c.depth, c.lastCutWithDirection);
  const above = c.above ?? 20;
  const axis = (P, a) => plcAxisXY(P[0], P[1], a, 0, m);
  const [sx, sy] = axis(plan.S, plan.aS);
  pb.goto({ x: sx, y: sy, a: plan.aS, b: 0, z: plcAxisZ(0, 0, m) }, above, 'MoveToStartPosition');
  depths.forEach((depth, i) => {
    const z = plcAxisZ(depth, 0, m);
    pb.axesTo({ z }, 'StartCutDepth');
    const plus = i % 2 === 0;
    const [P0, P1, a0, a1, cw] = plus ? [plan.S, plan.E, plan.aS, plan.aE, plan.cw] : [plan.E, plan.S, plan.aE, plan.aS, !plan.cw];
    const r = Math.hypot(pb.cur.x - plan.C[0], pb.cur.y - plan.C[1]);
    const t0 = Math.atan2(P0[1] - plan.C[1], P0[0] - plan.C[0]);
    // os glowicy lezy na promieniu punktu tarczy - ten sam kat wokol srodka
    const tA0 = Math.atan2(pb.cur.y - plan.C[1], pb.cur.x - plan.C[0]);
    const t1 = sweepTo(t0, P1, plan.C, cw);
    pb.pathTo(arcPoses(plan.C, r, tA0, tA0 + (t1 - t0), a0, a1, z), i === depths.length - 1 ? 'StartLastCut' : 'StartSingleCut');
  });
  pb.axesTo({ z: plcAxisZ(-above, 0, m) }, 'StartMoveAboveMaterial');
  return plan;
}

// CutCircleST: okrag (zewn. - start na gorze, wewn. / otwor - na dole), tarcza na promieniu R +- szer./2,
// kazde przejscie: zjazd, 1 s, pol okregu, stop 2 s, druga polowa; przejscia na zmiane CW / CCW
export function circlePlan(circle, bladeWidth) {
  const Rc = circle.inner ? circle.R - bladeWidth / 2 : circle.R + bladeWidth / 2;
  const C = circle.center ? [circle.x, circle.y] : [circle.x, circle.y - Rc];
  const top = [C[0], C[1] + Rc];
  const bottom = [C[0], C[1] - Rc];
  return { C, Rc, Ps: circle.inner ? bottom : top, Pm: circle.inner ? top : bottom, inner: circle.inner };
}

export function addCircle(pb, circle, c) {
  const m = pb.m;
  const plan = circlePlan(circle, m.bladeWidth);
  if (!(plan.Rc > 0)) return null;
  const depths = arcDepths(c.depth, c.lastCutWithDirection);
  const above = c.above ?? 20;
  const A0 = 179.999;
  const [sx, sy] = plcAxisXY(plan.Ps[0], plan.Ps[1], A0, 0, m);
  pb.goto({ x: sx, y: sy, a: A0, b: 0, z: plcAxisZ(0, 0, m) }, above, 'MoveToStartPosition');
  depths.forEach((depth, i) => {
    const z = plcAxisZ(depth, 0, m);
    pb.axesTo({ z }, 'StartCutDepth');
    pb.dwell(1, 'StartCutDepth');
    const cw = i % 2 === 0;
    const aStart = cw ? A0 : -A0;
    const aEnd = -aStart;
    const r = Math.hypot(pb.cur.x - plan.C[0], pb.cur.y - plan.C[1]);
    const t0 = Math.atan2(pb.cur.y - plan.C[1], pb.cur.x - plan.C[0]);
    const half = cw ? -Math.PI : Math.PI;
    pb.pathTo(arcPoses(plan.C, r, t0, t0 + half, aStart, 0, z), 'StartSingleCut');
    pb.dwell(2, 'StartSingleCut');
    pb.pathTo(arcPoses(plan.C, r, t0 + half, t0 + 2 * half, 0, aEnd, z), i === depths.length - 1 ? 'StartLastCut' : 'StartCutOvertaking');
  });
  pb.zUp(plcAxisZ(-above, 0, m), 'StartMoveAboveMaterial');
  return plan;
}

// GetElipsePositions: 120 odcinkow, gesciej przy wierzcholkach, start na gornym wierzcholku, obieg CW
export function ellipsePoints(xs, ys, length, width) {
  const a = length / 2; const b = width / 2;
  const xsUp = [];
  const range = (from, to, step) => { const out = []; const n = Math.round(Math.abs(to - from) / step); for (let i = 0; i < n; i++) out.push(from + Math.sign(to - from) * step * i); return out; };
  if (a >= b) {
    xsUp.push(...range(-a, -0.9 * a, a / 200), ...range(-0.9 * a, 0.9 * a, 0.09 * a), ...range(0.9 * a, a, a / 200));
  } else {
    xsUp.push(...range(-a, -0.1 * a, 0.09 * a), ...range(-0.1 * a, 0.1 * a, a / 200), ...range(0.1 * a, a, 0.09 * a));
  }
  const yOf = (x) => b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a)));
  const loop = [...xsUp.map((x) => [x, yOf(x)]), ...[a, ...xsUp.slice(1).map((x) => -x)].map((x) => [x, -yOf(x)])];
  // obrot tablicy: start w gornym wierzcholku (x = 0)
  let top = 0;
  loop.forEach((p, i) => { if (p[1] > 0 && Math.abs(p[0]) < Math.abs(loop[top][0])) top = i; });
  const pts = [...loop.slice(top), ...loop.slice(0, top)];
  pts[0] = [0, b];
  pts.push([0, b]);
  const cx = xs; const cy = ys - b;
  return { pts: pts.map(([x, y]) => [cx + x, cy + y]), center: [cx, cy], a, b };
}

// A w punkcie elipsy: (sin A, -cos A) = normalna na zewnatrz (glowica wewnatrz konturu)
function ellipseA(P, e) {
  const nx = (P[0] - e.center[0]) / (e.a * e.a);
  const ny = (P[1] - e.center[1]) / (e.b * e.b);
  return Math.atan2(nx, -ny) / DEG;
}

// CutElipseST: tylko tablica glowna, przejscia na zmiane CW / CCW, ciagly ruch po odcinkach; kolejne przejscia
// zaczynaja sie bez zatrzymania - Z schodzi na nowa glebokosc w pierwszym odcinku
export function addEllipse(pb, el, c) {
  const m = pb.m;
  if (!(el.length > 0 && el.width > 0)) return null;
  const e = ellipsePoints(el.xs, el.ys, el.length, el.width);
  const depths = depthTables(c.depth).primary;
  const above = c.above ?? 20;
  // A ciagle wzdluz toru (bez skokow +-360)
  const unwrap = (list) => { const out = []; let prev = null; for (const a of list) { let x = a; if (prev !== null) { while (x - prev > 180) x -= 360; while (x - prev < -180) x += 360; } out.push(x); prev = x; } return out; };
  const fwdA = unwrap(e.pts.map((P) => ellipseA(P, e)));
  const pose = (P, a, z) => { const [x, y] = plcAxisXY(P[0], P[1], a, 0, m); return { x, y, z, a, b: 0 }; };
  pb.goto({ ...pose(e.pts[0], fwdA[0], 0), z: plcAxisZ(0, 0, m) }, above, 'MoveToStartPosition');
  depths.forEach((depth, i) => {
    const z = plcAxisZ(depth, 0, m);
    const fwd = i % 2 === 0;
    const pts = fwd ? e.pts : [...e.pts].reverse();
    let as = fwd ? fwdA : [...fwdA].reverse();
    const shift = pb.cur.a - as[0];
    as = as.map((a) => a + shift);
    if (i === 0) pb.axesTo({ z }, 'CutDepthPrepare');
    const poses = pts.slice(1).map((P, k) => pose(P, as[k + 1], z));
    pb.pathTo(poses, i === depths.length - 1 ? 'StartLastCut' : 'StartSingleCut');
  });
  pb.zUp(plcAxisZ(-above, 0, m), 'StartMoveAboveMaterial');
  return e;
}
