// Profile krawedzi (ProgramAutoProfileST: ProfileConvex/ConcaveX/Y) i wygladzanie (SmoothingShape / SmoothingShapeFull).
//
// Profil: N+1 rownoleglych ciec prostych CutST (B = 0) od P0 do P1 co fProfileJump, kazde o dlugosci Lc,
// glebokosc ciecia z okregu przez (P0, glebokosc poczatku) i (P1, glebokosc konca) o promieniu R:
// wypukly - srodek glebiej (zaokraglenie), wklesly - srodek wyzej (wyzlobienie). Ciecia X zawsze odwrocone.
// Wygladzanie: tarcza pionowo wzdluz krawedzi (A 90 dla X, 0 dla Y), luk w plaszczyznie XZ / YZ po profilu,
// przejscia tam i z powrotem co fSmoothingJump wzdluz krawedzi.

import { cutParams } from './common.js';
import { getAngleFun } from './sawlines.js';
import { plcAxisXY, plcAxisZ } from './geometry.js';
import { addCutST, choosePrimary } from './cutst.js';

const DEG = Math.PI / 180;

// Srodek okregu w ukladzie (u, glebokosc) przez S i E, promien R; wypukly - srodek glebiej
export function profileCircle(S, E, R, convex) {
  const mx = (S[0] + E[0]) / 2; const mz = (S[1] + E[1]) / 2;
  const dx = E[0] - S[0]; const dz = E[1] - S[1];
  const c = Math.hypot(dx, dz);
  const h = Math.sqrt(Math.max(0, R * R - (c / 2) ** 2));
  const n = c > 0 ? [-dz / c, dx / c] : [0, 1];
  const c1 = [mx + n[0] * h, mz + n[1] * h];
  const c2 = [mx - n[0] * h, mz - n[1] * h];
  const deeper = c1[1] >= c2[1] ? c1 : c2;
  const upper = deeper === c1 ? c2 : c1;
  return { center: convex ? deeper : upper, R: Math.max(R, c / 2), convex };
}

// Glebokosc profilu w punkcie u (GetProfileDepthValue)
export function profileDepth(circle, u) {
  const du = Math.max(-circle.R, Math.min(circle.R, u - circle.center[0]));
  const s = Math.sqrt(Math.max(0, circle.R ** 2 - du * du));
  return circle.convex ? circle.center[1] - s : circle.center[1] + s;
}

// Lista ciec profilu (GetProgramProfileCutNumber + GetPositions)
// p: {P0, P1, d0, d1, R, length, convex, xProfile, jump}
export function profileCuts(p) {
  let dist = Math.hypot(p.P1[0] - p.P0[0], p.P1[1] - p.P0[1]);
  const jumpAbs = p.jump > 0 ? p.jump : 1;
  const n = Math.ceil(dist / jumpAbs - 1e-9);
  let a = p.P0[0] === p.P1[0] ? 90 : (p.P0[1] === p.P1[1] ? 0 : getAngleFun(p.P0[0], p.P0[1], p.P1[0], p.P1[1]));
  let jump = jumpAbs;
  if (p.P1[0] < p.P0[0] || p.P1[1] < p.P0[1]) { jump = -jump; dist = -dist; }
  a *= DEG;
  const u0 = p.xProfile ? p.P0[0] : p.P0[1];
  const u1 = p.xProfile ? p.P1[0] : p.P1[1];
  const circle = profileCircle([u0, p.d0], [u1, p.d1], p.R, p.convex);
  const cuts = [];
  for (let c = 0; c <= n; c++) {
    const off = c < n ? jump * c : dist;
    const x0 = p.P0[0] + off * Math.cos(a); const y0 = p.P0[1] + off * Math.sin(a);
    const x1 = x0 + p.length * Math.sin(a); const y1 = y0 + p.length * Math.cos(a);
    const depth = profileDepth(circle, p.xProfile ? x0 : y0);
    cuts.push({ x0, y0, x1, y1, depth, reverse: Boolean(p.xProfile) });
  }
  return { cuts, circle };
}

// Tablica glebokosci ciecia profilu (GetProfileDepth): co h, ostatnia = D; druga tablica Np+1 rownych
export function profileTables(D, h) {
  const step = h > 0 ? h : 1;
  const np = Math.max(1, Math.ceil(D / step - 1e-9));
  const primary = Array.from({ length: np }, (_, i) => (i === np - 1 ? D : step * (i + 1)));
  const secondary = Array.from({ length: np + 1 }, (_, k) => D / (np + 1) * (k + 1));
  return { primary, secondary };
}

// Profil: ciecia przez CutST z tablica glebokosci profilu; po pierwszym cieciu, gdy seria skonczyla sie
// po stronie konca - kolejne od konca do poczatku (bProgramProfilesSwap)
export function addProfile(pb, p, common) {
  const { cuts } = profileCuts(p);
  let swap = false;
  cuts.forEach((cut, i) => {
    if (!(cut.depth > 0.01)) return;
    let line = swap ? { ...cut, x0: cut.x1, y0: cut.y1, x1: cut.x0, y1: cut.y0 } : cut;
    const tables = profileTables(cut.depth, common.step);
    const base = cutParams(line, { ...common, tilt: false, reserve: 0 }, { total: cut.depth });
    const primary = choosePrimary(base, tables);
    const table = primary ? tables.primary : tables.secondary;
    addCutST(pb, { ...base, table });
    if (i === 0 && table.length % 2 === 1) swap = true;
    line = null;
  });
  return cuts;
}

// Punkty luku wygladzania w plaszczyznie pionowej: od (u0, z0) do (u1, z1) (glebokosci), promien R, wypukly / wklesly
function smoothingArc(u0, d0, u1, d1, R, convex) {
  const circle = profileCircle([u0, d0], [u1, d1], R, convex);
  const [cu, cd] = circle.center;
  let t0 = Math.atan2(d0 - cd, u0 - cu);
  let t1 = Math.atan2(d1 - cd, u1 - cu);
  // krotszy luk po stronie profilu (wypukly - gora okregu = mniejsza glebokosc)
  let sweep = t1 - t0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(sweep) * circle.R / 5));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = t0 + sweep * i / n;
    out.push([cu + circle.R * Math.cos(t), cd + circle.R * Math.sin(t)]);
  }
  t1 = t0 + sweep;
  return out;
}

// Jedno wygladzanie (SmoothingShape). s: {P0, P1, d0, d1, R, length, jump, convex, xProfile}
// segments (SmoothingShapeFull) - lista takich wierszy laczonych w jedno przejscie
export function addSmoothing(pb, rows, common) {
  const m = pb.m;
  const first = rows[0];
  const xProfile = first.xProfile;
  const A = xProfile ? 90 : 0;
  const L = first.length;
  const jumpAbs = Math.abs(first.jump || 0);
  const n = jumpAbs > 0 ? Math.ceil(Math.abs(L) / jumpAbs - 1e-9) : 0;
  const jw = Math.sign(L) * jumpAbs;
  const above = common.above ?? 20;
  const zAt = (d) => plcAxisZ(d, 0, m);
  for (let k = 0; k <= n; k++) {
    const s = k >= n ? L : jw * k;
    const plus = k % 2 === 0;
    const order = plus ? rows : [...rows].reverse();
    order.forEach((r, idx) => {
      // punkty na krawedzi przesuniete o s wzdluz krawedzi (prostopadle do profilu)
      const shift = [Math.cos(A * DEG) * s, Math.sin(A * DEG) * s];
      const S = [r.P0[0] + shift[0], r.P0[1] + shift[1]];
      const E = [r.P1[0] + shift[0], r.P1[1] + shift[1]];
      const [from, to, dFrom, dTo] = plus ? [S, E, r.d0, r.d1] : [E, S, r.d1, r.d0];
      const [fx, fy] = plcAxisXY(from[0], from[1], A, 0, m);
      if (idx === 0) {
        if (k === 0) pb.goto({ x: fx, y: fy, a: A, b: 0, z: zAt(dFrom) }, above, 'MoveToBasePosition');
        else {
          // kolejne przejscia: bez wyjazdu w Z, predkosci robocze
          pb.axesTo({ x: fx, y: fy, a: A }, 'MoveToBasePosition', { x: [pb.dyn.cutVel, pb.dyn.cutAcc], y: [pb.dyn.cutVel, pb.dyn.cutAcc] });
          pb.axesTo({ z: zAt(dFrom) }, 'MoveToBasePosition');
        }
        pb.dwell(0.5, 'MoveToStartPosition');
      } else {
        pb.axesTo({ x: fx, y: fy }, 'MoveToStartPosition');
      }
      const u0 = xProfile ? from[0] : from[1];
      const u1 = xProfile ? to[0] : to[1];
      const pts = smoothingArc(u0, dFrom, u1, dTo, r.R, r.convex);
      const len = Math.abs(u1 - u0);
      const poses = pts.map(([u, d]) => {
        const kk = len > 0 ? Math.abs(u - u0) / len : 1;
        const lx = from[0] + (to[0] - from[0]) * kk; const ly = from[1] + (to[1] - from[1]) * kk;
        const [x, y] = plcAxisXY(lx, ly, A, 0, m);
        return { x, y, z: zAt(d) };
      });
      pb.pathTo(poses, 'StartSingleCut');
    });
  }
  pb.zUp(zAt(-above), 'StartMoveAboveMaterial');
}
