// CNC 3D (#124): program z G-kodu jak modul CNC w PLC (CNC/Preprocessing, CNCManager) - tylko osie X, Y, Z
// (A i B bez zmian, w trybie frezu B 90 po bazowaniu). Pozycja osi dla punktu programu (preprocesor PLC zamienia
// pierwszy blok na "G54 X<G54_X> Y<G54_Y> Z<G54_Z> I1 J-1 K1"):
//   X osi = G54_X + X,   Y osi = G54_Y - Y (odwrocona os Y),   Z osi = G54_Z + Z (Z w dol)
// G54 ustawiany z HMI aktualna pozycja osi (bSetG54_X / Y / Z; "bez promienia" + fParameterMillWidth / 2).
// Przed startem Z w gore na G54_Z - fParameterZMoveAboveMaterial (waitingFSM), potem ruchy z pliku.
// Predkosci: F w mm/min, G0 - predkosc dojazdu; sciezka ograniczona do 200 mm/s w XY i 20 mm/s w Z (limitDyn w PLC).

import { ProgramBuilder } from './motion.js';
import { movePoints } from './gcode.js';
import { toolFrame } from './geometry.js';

export const CNC_LIMITS = { xy: 200, z: 20 };     // mm/s (readFile: limitDynX / Y / Z dMaxVel)

// Pozycja osi X / Y / Z dla punktu programu p = [x, y, z]
export const cncAxis = (g54, p) => ({ x: g54.x + p[0], y: g54.y - p[1], z: g54.z + p[2] });

// G54 z aktualnej pozycji osi (bSetG54_X / Y / Z), "bez promienia" - X / Y + srednica frezu / 2
export const g54FromPose = (pose, millWidth = 0, noRadius = false) => ({
  x: pose.x + (noRadius ? millWidth / 2 : 0), y: pose.y + (noRadius ? millWidth / 2 : 0), z: pose.z,
});

// Predkosc odcinka: posuw ograniczony limitami osi (skladowa Z najwyzej 20 mm/s, XY 200 mm/s)
function segVel(a, b, v) {
  const dxy = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dz = Math.abs(b[2] - a[2]);
  const len = Math.hypot(dxy, dz);
  if (len < 1e-9) return v;
  return Math.min(v, dxy > 0 ? CNC_LIMITS.xy * len / dxy : Infinity, dz > 0 ? CNC_LIMITS.z * len / dz : Infinity);
}

// Program ruchu z G-kodu w kreatorze pb (pozycja startowa - aktualna, A / B bez zmian). Kolejne ruchy tego samego
// rodzaju z ta sama predkoscia - jedna ciagla sciezka (CNC wygladza naroza, nie zatrzymuje sie w kazdym punkcie).
// opts: {zAbove (fParameterZMoveAboveMaterial), rapidVel [mm/s], step [mm] - punkty lukow}
export function addCncProgram(pb, prog, g54, opts = {}) {
  const zAbove = opts.zAbove ?? 20;
  const rapid = opts.rapidVel ?? pb.dyn.fastVel;
  const zSafe = g54.z - zAbove;
  if (pb.cur.z > zSafe) pb.zUp(zSafe, 'CNC: Z nad material');
  let run = null;
  const flush = () => {
    if (!run || run.pts.length < 1) { run = null; return; }
    pb.label = run.lines[0] === run.lines[1] ? `G-kod: linia ${run.lines[0]}` : `G-kod: linie ${run.lines[0]}-${run.lines[1]}`;
    pb.stepIndex = run.lines[0];
    const acc = run.kind === 'rapid' ? pb.dyn.fastAcc : pb.dyn.cutAcc;
    pb.pathTo(run.pts.map((p) => cncAxis(g54, p)), run.kind === 'rapid' ? 'G0' : 'G1', run.vel, acc);
    run = null;
  };
  for (const m of prog.moves) {
    const pts = movePoints(m, opts.step ?? 2);
    const kind = m.kind === 'rapid' ? 'rapid' : 'feed';
    for (let k = 1; k < pts.length; k++) {
      const v = segVel(pts[k - 1], pts[k], kind === 'rapid' ? rapid : Math.max(m.f, 1) / 60);
      if (!run || run.kind !== kind || Math.abs(run.vel - v) > 1e-6 || run.pts.length > 4000) {
        flush();
        run = { kind, vel: v, pts: [], lines: [m.line, m.line] };
      }
      run.pts.push(pts[k]);
      run.lines[1] = m.line;
    }
  }
  flush();
  pb.label = null;
  pb.stepIndex = null;
  return pb;
}

export function cncProgram(from, prog, g54, m, dyn, opts) {
  const pb = new ProgramBuilder(from, m, dyn);
  addCncProgram(pb, prog, g54, opts);
  pb.dwell(0.3, 'M30');
  return pb.build();
}

// Tor czola narzedzia (z swiata) dla calego programu - do "Wynik od razu" i podgladu toru: [{kind, pts: [[x, y, z]]}]
// pose - aktualna pozycja (A / B), m - maszyna w trybie frezu
export function cncTipPath(prog, g54, pose, m, step = 2) {
  const tip = (p) => toolFrame({ ...pose, ...cncAxis(g54, p) }, m).tip;
  const out = [];
  let cur = null;
  for (const mv of prog.moves) {
    const kind = mv.kind === 'rapid' ? 'rapid' : 'feed';
    const pts = movePoints(mv, step);
    if (!cur || cur.kind !== kind) {
      cur = { kind, pts: [tip(pts[0])] };
      out.push(cur);
    }
    for (let k = 1; k < pts.length; k++) cur.pts.push(tip(pts[k]));
  }
  return out;
}
