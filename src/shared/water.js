// Woda i laser na glowicy (#141): dwa niebieskie weze z woda do dysz po obu stronach oslony tarczy (frez / wiertlo /
// polerka - przy kolnierzu narzedzia), strumien z dysz na tarcze (narzedzie) przy wlaczonych obrotach, modul lasera
// zamontowany na oslonie tarczy od strony lasera. W PLC zawory: IOVars.yWaterCut (pila), IOVars.yWaterMill (frez,
// wiercenie) - polozenie dysz i lasera nie jest w PLC, tylko w modelu (laser.mountAngle w configu).

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

// Uklad wody: {hoses: [[p0, p1, p2, p3], x2], nozzles: [p, p], targets: [p, p]} - punkty w ukladzie swiata.
// Pila: dysze na brzegu oslony z przodu (75 stopni od gory w strone u) po obu stronach tarczy, woda na tarcze
// przy krawedzi wchodzacej w material (95 stopni, 0.85 promienia). Narzedzie: dysze przy kolnierzu po obu stronach,
// woda na czolo narzedzia.
export function waterLayout(pose, m) {
  const f = headFrame(pose, m);
  const { ramW } = headDims(m);
  const top = add(f.pivot, mul(UP, ramW * 0.7));            // wyjscie wezy z korpusu obrotu A
  const hoses = [];
  const nozzles = [];
  const targets = [];
  for (const s of [1, -1]) {
    let nozzle;
    let target;
    let over;
    if (isToolMode(m)) {
      const side = mul(f.u, s * (f.radius + 60));
      nozzle = add(add(f.flange, mul(f.normal, Math.min(80, f.length * 0.4))), side);
      target = add(f.tip, mul(f.u, s * f.radius * 0.5));
      over = add(add(f.flange, mul(f.normal, -60)), mul(side, 1.3));
    } else {
      const off = mul(f.normal, s * (m.bladeWidth / 2 + 45));
      const R = f.radius;
      nozzle = add(inPlane(f, 75, R * 1.02), off);
      target = add(inPlane(f, 95, R * 0.85), mul(f.normal, s * (m.bladeWidth / 2 + 0.5)));
      over = add(inPlane(f, 55, R * 1.25), mul(off, 1.4));
    }
    const start = add(top, add(mul(f.normal, s * 40), mul(f.u, ramW * 0.3)));
    hoses.push([start, add(mul(add(start, over), 0.5), mul(UP, 120)), over, nozzle]);
    nozzles.push(nozzle);
    targets.push(target);
  }
  return { hoses, nozzles, targets };
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

// Modul lasera: na oslonie tarczy od strony lasera (side = laser.side), mountAngle stopni od gory w strone kierunku
// lasera; narzedzie - nad kolnierzem w strone lasera. -> {pos, u, normal, up}
export function laserMount(pose, m, side = 1, mountAngle = 50) {
  const f = headFrame(pose, m);
  if (isToolMode(m)) {
    const pos = add(add(f.flange, mul(UP, 80)), mul(f.u, side * (f.radius + 160)));
    return { pos, u: mul(f.u, side), normal: f.normal, up: UP };
  }
  const pos = inPlane(f, side * mountAngle, f.radius * 1.08 + 40);
  return { pos, u: mul(f.u, side), normal: f.normal, up: norm(sub(pos, f.center)) };
}
