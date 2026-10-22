// Pojedyncze ciecie tarcza jak CutST (PLC): tablice glebokosci (Depths / IsPrimaryTable), ciecie zewnetrzne,
// wewnetrzne (iManualInternal), odwrocone (bCutReverse), skos (bManualBAngle), wolniejsza koncowka ostatniego
// przejscia (bServiceLastCutSlower). Dojazd jak GoToPositionST, wyjazd 'above' mm nad material.

import { plcAxisXY, plcAxisZ } from './geometry.js';
import { getAngleFun } from './sawlines.js';

const DEG = Math.PI / 180;

// --- tablice glebokosci (program Depths) ------------------------------------------------------

// d = {mode: 'same' | 'step' | 'one', total (T + rezerwa), passes (Np), maxJump [%], step (h), minLast}
// -> {primary: [...], secondary: [...]}
export function depthTables(d) {
  const T = Math.max(0, d.total);
  if (d.mode === 'one' || T <= 0) return { primary: [T], secondary: [] };
  if (d.mode === 'step') {
    const h = d.step > 0 ? d.step : T;
    let np = Math.max(1, Math.ceil(T / h - 1e-9));
    if (np > 1 && T - h * (np - 1) < (d.minLast || 0)) np -= 1;
    const primary = Array.from({ length: np }, (_, i) => (i === np - 1 ? T : h * (i + 1)));
    let ns = Math.ceil(T / h - 1e-9) + 1;
    if (ns % 2 === np % 2) ns += 1;
    return { primary, secondary: Array.from({ length: ns }, (_, j) => T / ns * (j + 1)) };
  }
  const np = Math.max(1, Math.round(d.passes || 1));
  const primary = Array.from({ length: np }, (_, i) => T / np * (i + 1));
  const maxJump = T / np * (1 + (d.maxJump || 0) / 100);
  let ns = Math.ceil(T / maxJump - 1e-9);
  // jak w Depths: przy parzystym Np zawsze +1, przy nieparzystym - gdy Ns nieparzyste
  if (np % 2 === 0) ns += 1; else if (ns % 2 === 1) ns += 1;
  return { primary, secondary: Array.from({ length: ns }, (_, j) => T / ns * (j + 1)) };
}

// IsPrimaryTable: tablica o parzystosci, przy ktorej (domyslnie) ostatnie przejscie konczy sie w punkcie koncowym
export function choosePrimary(c, tables) {
  if (!tables.secondary.length) return true;
  const even = tables.primary.length % 2 === 0;
  const reversePositions = c.x0 > c.x1 || c.y0 > c.y1;
  return !(Boolean(c.lastCutWithDirection) !== even !== reversePositions !== Boolean(c.reverse));
}

// Odsuniecie konca ciecia wewnetrznego: pol cieciwy tarczy na gornej powierzchni przy glebokosci z (GetSawOffset)
export function sawOffset(z, len, disc, corr) {
  const h = disc * z - z * z;
  return Math.min(len / 2, (h > 0 ? Math.sqrt(h) : 0) + corr);
}

// GetMaxZDepth: najwieksza glebokosc ciecia wewnetrznego, przy ktorej cieciwa tarczy miesci sie w dlugosci
export function innerMaxDepth(len, disc, corr, total, thickness) {
  const d = len - corr;
  let z = d <= disc ? disc / 2 - Math.sqrt(Math.max(0, (disc / 2) ** 2 - (d / 2) ** 2)) : total;
  if (z > thickness) z = total;
  return z;
}

// Kat glowicy A dla linii (GetAngleFun z dwoch punktow albo kat zadany przy kat + dlugosc, odwrocone +-180)
export function cutAngle(c) {
  let a = Number.isFinite(c.angle) ? c.angle : getAngleFun(c.x0, c.y0, c.x1, c.y1);
  if (c.reverse) a = a <= 0 ? a + 180 : a - 180;
  return a;
}

// Plan ciecia (bez ruchu): kat, wychyl, lista przejsc {depth, from: [x, y], to: [x, y]} na linii (powierzchnia)
// c: {x0, y0, x1, y1, b, internal, reverse, lastCutWithDirection, depth: {...depthTables}, thickness,
//     innerCorr, innerCorrB, outerAdd, innerSlant}
// outerAdd - wydluzenie koncow zewnetrznych (fCutOuterAdditionalDistance), innerSlant - odsuniecie koncow
// wewnetrznych przy skosie z glebokosci w plaszczyznie tarczy (z / cos B), zeby rzaz nie wychodzil za punkt
// (w PLC GetSawOffset liczy z glebokosci pionowej - przy skosie rzaz na gorze wychodzi za punkt)
export function cutPlan(c, m) {
  const tilt = c.b > 0 && c.b < 90;
  const b = tilt ? c.b : 0;
  const a = cutAngle(c);
  const L = Math.hypot(c.x1 - c.x0, c.y1 - c.y0);
  const u = L > 0 ? [(c.x1 - c.x0) / L, (c.y1 - c.y0) / L] : [1, 0];
  const internal = c.internal || 0;
  const corr = tilt ? (c.innerCorrB ?? 15) : (c.innerCorr ?? 0);
  const tables = depthTables(c.depth);
  const primary = choosePrimary(c, tables);
  let table = c.table ?? (primary ? tables.primary : tables.secondary);
  // glebokosc pionowa -> w plaszczyznie tarczy (dzielnik cos B), tylko przy innerSlant i skosie
  const slant = c.innerSlant && tilt ? Math.cos(b * DEG) : 1;
  if (internal >= 1) {
    const maxZ = innerMaxDepth(L, m.discDiameter, corr, c.depth.total / slant, (c.thickness ?? m.materialThickness) / slant) * slant;
    table = table.map((_, i) => maxZ / table.length * (i + 1));
  }
  if (!table.length) table = [c.depth.total];
  const n = table.length;
  const off = (z, k = corr) => sawOffset(z / slant, L, m.discDiameter, k);
  const add = internal === 1 ? 0 : (c.outerAdd || 0);
  // punkt startu / konca przejscia z odsunieciem (wewn.) albo wydluzeniem (zewn.)
  const startPt = (o) => {
    let s = 0;
    if (internal === 1 || internal === 2) s += o;
    if (internal === 0 || internal === 3) s -= add;
    return [c.x0 + u[0] * s, c.y0 + u[1] * s];
  };
  const endPt = (o) => {
    let s = 0;
    if (internal === 1 || internal === 3) s += o;
    if (internal === 0 || internal === 2) s -= add;
    return [c.x1 - u[0] * s, c.y1 - u[1] * s];
  };
  const passes = [];
  let at = startPt(off(table[0]));
  for (let p = 1; p <= n; p++) {
    const depth = table[p - 1];
    const plus = p % 2 === 1;
    const last = p === n;
    let to;
    if (last) {
      const o = off(depth, corr + 2);
      to = plus ? endPt(o) : startPt(o);
    } else {
      const o = off(table[p]);
      to = plus ? endPt(o) : startPt(o);
    }
    passes.push({ depth, from: at, to, last });
    at = to;
  }
  return { a, b, tilt, passes, table, primary, length: L };
}

// Zasieg rzazu na powierzchni materialu (plan ciecia): przejscia z cutPlan (srodek tarczy) wydluzone o polowe cieciwy
// tarczy na glebokosci przejscia (jak sawOffset bez korekty). Zewnetrzne - rzaz wychodzi za punkty linii (tarcza
// wychodzi poza material), wewnetrzne - konczy sie na punktach (linie sie nie przecinaja). Zwraca [[x, y], [x, y]].
export function cutSurfaceSpan(c, m) {
  const plan = cutPlan(c, m);
  const L = plan.length;
  const u = L > 0 ? [(c.x1 - c.x0) / L, (c.y1 - c.y0) / L] : [1, 0];
  // przy skosie tarcza tnie w plaszczyznie pochylonej - glebokosc w plaszczyznie tarczy z / cos B
  const slant = plan.tilt ? Math.cos(plan.b * DEG) : 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of plan.passes) {
    const h = sawOffset(p.depth / slant, Infinity, m.discDiameter, 0);
    for (const pt of [p.from, p.to]) {
      const s = (pt[0] - c.x0) * u[0] + (pt[1] - c.y0) * u[1];
      lo = Math.min(lo, s - h);
      hi = Math.max(hi, s + h);
    }
  }
  if (!Number.isFinite(lo)) { lo = 0; hi = L; }
  return [[c.x0 + u[0] * lo, c.y0 + u[1] * lo], [c.x0 + u[0] * hi, c.y0 + u[1] * hi]];
}

// Pozycja osi dla punktu linii na glebokosci depth (GetPositions + fBX/YOffset przy skosie)
export function axisPoint(pt, depth, plan, m) {
  const [x, y] = plcAxisXY(pt[0], pt[1], plan.a, plan.b, m);
  if (!plan.tilt) return [x, y];
  const t = Math.tan(plan.b * DEG) * depth;
  return [x - Math.sin(plan.a * DEG) * t, y + Math.cos(plan.a * DEG) * t];
}

// Ciecie CutST w kreatorze programu pb. c jak w cutPlan + above, slower {on, pct, speedPct}
export function addCutST(pb, c) {
  const m = pb.m;
  const plan = cutPlan(c, m);
  const above = c.above ?? 20;
  const zAt = (depth) => plcAxisZ(depth, plan.b, m);
  // MoveToStartPosition: GoToPosition (Z nad material, X/Y/A, B, Z na powierzchnie). #151 przy skosie start nad
  // materialem na przedluzeniu skosu tarczy (wyjazd nad material = glebokosc -above): wjazd w kamien jednym ruchem
  // XYZ pod katem nachylenia, bez pionowego zjazdu na powierzchnie
  const first = plan.passes[0].from;
  const startDepth = plan.tilt ? -above : 0;
  const [sx, sy] = axisPoint(first, startDepth, plan, m);
  pb.liftFor(plan.b, above, 'MoveToStartPosition');
  pb.axesTo({ x: sx, y: sy, a: plan.a }, 'MoveToStartPosition');
  pb.axesTo({ b: plan.b }, 'MoveToStartPosition');
  pb.axesTo({ z: zAt(startDepth) }, 'MoveToStartPosition');
  const zVel = [pb.dyn.zVel, pb.dyn.zAcc];
  for (const pass of plan.passes) {
    // zjazd: pionowo, przy skosie po skosie tarczy (interpolacja XYZ z predkoscia Z)
    const [px, py] = axisPoint(pass.from, pass.depth, plan, m);
    if (plan.tilt) pb.linearTo({ x: px, y: py, z: zAt(pass.depth) }, 'StartCutDepth', zVel[0], zVel[1], zVel[1]);
    else pb.axesTo({ z: zAt(pass.depth) }, 'StartCutDepth');
    const [tx, ty] = axisPoint(pass.to, pass.depth, plan, m);
    if (!pass.last) {
      pb.linearTo({ x: tx, y: ty }, 'StartSingleCut');
    } else if (c.slower?.on !== false) {
      const pct = (c.slower?.pct ?? 20) / 100;
      const mid = [tx + (px - tx) * pct, ty + (py - ty) * pct];
      pb.linearTo({ x: mid[0], y: mid[1] }, 'StartLastCut');
      pb.linearTo({ x: tx, y: ty }, 'StartCutOvertaking', pb.dyn.cutVel * (c.slower?.speedPct ?? 90) / 100);
    } else {
      pb.linearTo({ x: tx, y: ty }, 'StartLastCut');
    }
  }
  // MoveAboveMaterial: #151 przy skosie wyjazd z kamienia po skosie tarczy (interpolacja XYZ) az nad material
  if (plan.tilt) {
    const lastPass = plan.passes[plan.passes.length - 1];
    const [ux, uy] = axisPoint(lastPass.to, -above, plan, m);
    pb.linearTo({ x: ux, y: uy, z: zAt(-above) }, 'StartMoveAboveMaterial', zVel[0], zVel[1], zVel[1]);
  }
  pb.zUp(zAt(-above), 'StartMoveAboveMaterial');
  return plan;
}
