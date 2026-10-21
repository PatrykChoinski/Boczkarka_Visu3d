// Ruchy reczne offline (jak Manual / ManualInterpolationST w PLC): ruch trwa, dopoki przycisk jest
// wcisniety - rozpedzanie z przyspieszeniem do predkosci, po puszczeniu hamowanie do zatrzymania.
//   jog osi:        jeden kierunek na jednej osi (X / Y / Z w mm, A / B w stopniach)
//   interpolacja:   kierunek w XY (wzdluz lasera, przeciwnie, prostopadle, prostopadle odwrotnie)

import { AXES } from './motion.js';
import { headFrame } from './geometry.js';

export class JogMotion {
  // dir - wektor kierunku na osiach, np. {x: 1} albo {x: 0.6, y: 0.8} (normalizowany), vel / acc / dec > 0
  constructor(dir, vel, acc, dec = acc) {
    const len = Math.hypot(...AXES.map((ax) => dir[ax] || 0));
    this.dir = Object.fromEntries(AXES.map((ax) => [ax, len > 0 ? (dir[ax] || 0) / len : 0]));
    this.vmax = Math.max(0, vel);
    this.acc = Math.max(1e-9, acc);
    this.dec = Math.max(1e-9, dec);
    this.v = 0;
    this.pressed = true;
    this.distance = 0;
  }

  release() {
    this.pressed = false;
  }

  get done() {
    return !this.pressed && this.v <= 0;
  }

  // krok czasu dt [s]: nowa pozycja (pose nie jest zmieniane); limits - {os: [min, max]} (krancowki)
  step(pose, dt, limits = null) {
    const v0 = this.v;
    let v1;
    if (this.pressed) v1 = Math.min(this.vmax, v0 + this.acc * dt);
    else v1 = Math.max(0, v0 - this.dec * dt);
    const ds = (v0 + v1) / 2 * dt;
    this.v = v1;
    this.distance += ds;
    const out = { ...pose };
    for (const ax of AXES) out[ax] = pose[ax] + this.dir[ax] * ds;
    if (limits) {
      for (const [ax, [lo, hi]] of Object.entries(limits)) {
        if (out[ax] < lo || out[ax] > hi) {
          out[ax] = Math.min(hi, Math.max(lo, out[ax]));
          this.v = 0;
          this.pressed = false;
        }
      }
    }
    return out;
  }
}

// Kierunek lasera w XY: wzdluz kierunku ciecia (os A), side = 1 - w prawa strone (+u), -1 - w lewa
export function laserDirection(aDeg, side = 1) {
  const a = aDeg * Math.PI / 180;
  return [side * Math.cos(a), side * Math.sin(a)];
}

// Linia lasera na powierzchni: od miejsca, gdzie plaszczyzna tarczy przecina powierzchnie pod srodkiem
// tarczy (frez / wiertlo / polerka - od osi narzedzia), wzdluz kierunku lasera; surfaceZ(x, y) - wysokosc
// powierzchni w ukladzie swiata (kamien / stol)
export function laserLine(pose, m, side, length, surfaceZ, step = 25) {
  const f = headFrame(pose, m);
  const p0 = f.kind === 'tool' ? f.tip : f.point(0, (f.center[2] - surfaceZ(f.center[0], f.center[1])) / Math.max(f.cosB, 0.05));
  const [dx, dy] = laserDirection(pose.a, side);
  const n = Math.max(2, Math.ceil(length / step) + 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const s = length * i / (n - 1);
    const x = p0[0] + dx * s;
    const y = p0[1] + dy * s;
    pts.push([x, y, surfaceZ(x, y)]);
  }
  return pts;
}

// Ruchy interpolowane wzgledem lasera: wektor {x, y}
export function interpolationDir(kind, aDeg, side = 1) {
  const [lx, ly] = laserDirection(aDeg, side);
  switch (kind) {
    case 'along': return { x: lx, y: ly };
    case 'back': return { x: -lx, y: -ly };
    case 'perp': return { x: -ly, y: lx };        // 90 stopni w lewo od lasera
    case 'perpBack': return { x: ly, y: -lx };
    default: throw new Error(`nieznany ruch: ${kind}`);
  }
}

// Pozycje A i B z ekranu reczny (bManualASetPosition0 / 90 / 180 / M90 / M180, bManualBSetPosition0 / 30 / 45 / 60 / 90)
export const A_PRESETS = [0, 90, -90, 180, -180];
export const B_PRESETS = [0, 30, 45, 60, 90];
