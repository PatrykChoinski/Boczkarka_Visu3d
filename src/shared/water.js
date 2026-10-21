// Woda i laser na glowicy (#141): kanciasta oslona tarczy (oslonka na wode), dwa niebieskie weze segmentowe z woda
// do dysz pod oslona po obu stronach tarczy (frez / wiertlo / polerka - przy kolnierzu narzedzia), strumien z dysz na
// tarcze (narzedzie) przy wlaczonych obrotach, modul lasera zamontowany na oslonie tarczy od strony lasera.
// W PLC zawory: IOVars.yWaterCut (pila), IOVars.yWaterMill (frez, wiercenie) - polozenie oslony, dysz i lasera nie
// jest w PLC, tylko w modelu (wg zdjecia w #141; laser.mountAngle w configu).

import { headFrame, isToolMode, add, mul, sub } from './geometry.js';

const DEG = Math.PI / 180;
const UP = [0, 0, 1];
const norm = (p) => { const l = Math.hypot(...p) || 1; return p.map((c) => c / l); };

// Wielkosc glowicy wg tarczy (jak w machine3d - bez zmiany przy zamianie narzedzia)
export function headDims(m) {
  const r = Math.max(m.discDiameter / 2, 150);
  return { r, ramW: Math.max(160, r * 0.45) };
}

// Punkt w plaszczyznie tarczy: kat od gory (0 - nad srodkiem, 90 - w strone u), odleglosc od srodka
const inPlane = (f, angleDeg, dist) => add(f.center, add(mul(f.d, -Math.cos(angleDeg * DEG) * dist), mul(f.u, Math.sin(angleDeg * DEG) * dist)));

// Oslona tarczy (oslonka na wode, jak na zdjeciu w #141): kanciasta plyta w plaszczyznie tarczy - pionowa krawedz
// z przodu (strona u), skos w gore, plaska gora, z tylu w strone silnika; dol oslony troche ponizej piasty, tarcza
// pod spodem odslonieta. Punkty [s, t] w promieniach tarczy: s wzdluz u (przod), t w gore w plaszczyznie tarczy.
export const GUARD_OUTLINE = [[0.95, -0.18], [0.95, 0.45], [0.45, 1.12], [-0.85, 1.12], [-1.08, 0.62], [-1.08, -0.18]];
// grubosc oslony wzdluz normalnej tarczy: od strony silnika (-) i od zewnatrz (+) [mm poza polowa szerokosci tarczy]
export const GUARD_SIDES = { inner: 40, outer: 80 };

// Punkt w plaszczyznie tarczy z [s, t] w promieniach (s - przod, t - w gore) i odsunieciem wzdluz normalnej [mm]
const inGuard = (f, st, off = 0) => add(add(add(f.center, mul(f.u, st[0] * f.radius)), mul(f.d, -st[1] * f.radius)), mul(f.normal, off));

// Uklad wody: {supply, manifold, hoses: [[p...], x2], nozzles: [p, p], targets: [p, p]} - punkty w ukladzie swiata.
// Pila (#141, zdjecie): stalowy oplatany przewod z gory glowicy do rozdzielacza przy dolnym tylnym rogu oslony
// (za tarcza), z niego dwa niebieskie weze segmentowe (Loc-Line) wzdluz dolnej krawedzi oslony, po obu stronach
// tarczy, do dysz pod oslona przy piascie; woda na dolny przod tarczy (strona wejscia w material).
// Narzedzie: rozdzielacz nad kolnierzem, dysze po obu stronach narzedzia, woda na czolo.
export function waterLayout(pose, m) {
  const f = headFrame(pose, m);
  const { ramW } = headDims(m);
  const top = add(f.pivot, mul(UP, ramW * 0.7));            // wyjscie przewodu z korpusu obrotu A
  const hoses = [];
  const nozzles = [];
  const targets = [];
  let manifold;
  let supply;
  if (isToolMode(m)) {
    manifold = add(f.flange, add(mul(f.normal, -40), mul(UP, 60)));
    supply = [top, add(mul(add(top, manifold), 0.5), mul(f.u, -120)), manifold];
    for (const s of [1, -1]) {
      const side = mul(f.u, s * (f.radius + 60));
      const nozzle = add(add(f.flange, mul(f.normal, Math.min(80, f.length * 0.4))), side);
      hoses.push([manifold, add(add(f.flange, mul(f.normal, -10)), mul(side, 1.3)), nozzle]);
      nozzles.push(nozzle);
      targets.push(add(f.tip, mul(f.u, s * f.radius * 0.5)));
    }
    return { supply, manifold, hoses, nozzles, targets };
  }
  const bw2 = m.bladeWidth / 2;
  manifold = inGuard(f, [-1.12, -0.12]);
  supply = [top, inGuard(f, [-1.25, 0.9], bw2 + GUARD_SIDES.outer * 0.5), inGuard(f, [-1.2, 0.2], bw2 + 30), manifold];
  for (const s of [1, -1]) {
    const o = s * (bw2 + 45);
    const nozzle = inGuard(f, [0.32, -0.24], o);
    hoses.push([add(manifold, mul(f.normal, s * 20)), inGuard(f, [-0.85, -0.3], o * 1.25), inGuard(f, [-0.3, -0.38], o * 1.3),
      inGuard(f, [0.12, -0.33], o * 1.15), nozzle]);
    nozzles.push(nozzle);
    targets.push(inGuard(f, [0.68, -0.44], s * (bw2 + 0.5)));
  }
  return { supply, manifold, hoses, nozzles, targets };
}

// Strumien wody z dyszy na tarcze: n kropli, faza 0..1 (czas) - punkty na luku z lekkim opadem
export function waterDrops(nozzle, target, n, phase, spread = 6) {
  const out = [];
  const dir = sub(target, nozzle);
  const len = Math.hypot(...dir);
  for (let i = 0; i < n; i++) {
    const t = (phase + i / n) % 1;
    const sag = 4 * t * (1 - t) * Math.min(60, len * 0.15);
    const j = Math.sin(i * 12.9898) * spread;                 // stale odchylenie kropli (bez losowania - stabilny obraz)
    const k = Math.cos(i * 78.233) * spread;
    out.push([nozzle[0] + dir[0] * t + j, nozzle[1] + dir[1] * t + k, nozzle[2] + dir[2] * t - sag + (j + k) * 0.3]);
  }
  return out;
}

// Odleglosc od srodka tarczy do krawedzi oslony (w promieniach) w kierunku dir = [s, t] (jednostkowy)
export function guardRadius(dir) {
  let best = 0;
  const P = GUARD_OUTLINE;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    // promien z (0, 0) w kierunku dir przecina odcinek a-b: k * dir = a + w * (b - a)
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const det = dir[0] * -ey - dir[1] * -ex;
    if (Math.abs(det) < 1e-12) continue;
    const k = (a[0] * -ey - a[1] * -ex) / det;
    const w = (dir[0] * a[1] - dir[1] * a[0]) / det;
    if (k > 0 && w >= -1e-9 && w <= 1 + 1e-9) best = Math.max(best, k);
  }
  return best;
}

// Modul lasera: na krawedzi oslony tarczy od strony lasera (side = laser.side), mountAngle stopni od gory w strone
// kierunku lasera; narzedzie - nad kolnierzem w strone lasera. -> {pos, u, normal, up}
export function laserMount(pose, m, side = 1, mountAngle = 50) {
  const f = headFrame(pose, m);
  if (isToolMode(m)) {
    const pos = add(add(f.flange, mul(UP, 80)), mul(f.u, side * (f.radius + 160)));
    return { pos, u: mul(f.u, side), normal: f.normal, up: UP };
  }
  // na krawedzi oslony (GUARD_OUTLINE) w kierunku mountAngle od gory, 40 mm nad nia
  const dir = [Math.sin(side * mountAngle * DEG), Math.cos(mountAngle * DEG)];
  const edge = guardRadius(dir) * f.radius;
  const pos = inPlane(f, side * mountAngle, edge + 40);
  return { pos, u: mul(f.u, side), normal: f.normal, up: norm(sub(pos, f.center)) };
}
