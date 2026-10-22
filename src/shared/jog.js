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

  // krok czasu dt [s]: nowa pozycja (pose nie jest zmieniane); limits - {os: [min, max]} (krancowki elektroniczne,
  // #154): ruch na zewnatrz zakresu zatrzymany na granicy; os juz poza zakresem nie przeskakuje na granice
  // (zatrzymany tylko ruch dalej na zewnatrz), ruch do srodka dozwolony
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
        const d = this.dir[ax] || 0;
        if ((d < 0 && out[ax] < lo) || (d > 0 && out[ax] > hi)) {
          const edge = d < 0 ? lo : hi;
          out[ax] = d < 0 ? Math.min(pose[ax], edge) : Math.max(pose[ax], edge);
          if ((d < 0 && pose[ax] < lo) || (d > 0 && pose[ax] > hi)) out[ax] = pose[ax];
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

// Predkosci ruchow recznych osi (#140) jak w PLC (SingleAxisMotion): jog i jazda "o" wartosc (MCJog / MCRelative)
// z fJog[XYZAB]Velocity, rampa jak dojazd X/Y, os Z, A, B
export const JOG_DYN = { x: ['jogXVel', 'fastAcc'], y: ['jogYVel', 'fastAcc'], z: ['jogZVel', 'zAcc'], a: ['jogAVel', 'aAcc'], b: ['jogBVel', 'bAcc'] };

// Predkosc i rampa jog osi ax z dynamiki d (mm/s, deg/s); rewrite - bServiceManualRewriteJogSpeed przy wlaczonej pile
// (ManualST: fJogX/YVelocity := fVelocitySawMode, fJogZVelocity := fVelocityAxisZWork)
export function jogVelocity(ax, d, rewrite = false) {
  const [velKey, accKey] = JOG_DYN[ax];
  let vel = d[velKey];
  if (rewrite && (ax === 'x' || ax === 'y')) vel = d.cutVel;
  if (rewrite && ax === 'z') vel = d.zVel;
  return { vel, acc: d[accKey] };
}

// Dynamika jazdy na kat A / B: "na" wartosc - MCAbsolute z VelA / VelB (bez zmian), "o" wartosc - MCRelative
// z fJogA/BVelocity
export const relativeMoveDynamics = (d) => ({ ...d, aVel: d.jogAVel, bVel: d.jogBVel });

// Pozycje A i B z ekranu reczny (bManualASetPosition0 / 90 / 180 / M90 / M180, bManualBSetPosition0 / 30 / 45 / 60 / 90)
export const A_PRESETS = [0, 90, -90, 180, -180];
export const B_PRESETS = [0, 30, 45, 60, 90];

// Przyciski skosne ekranu MPG (ManualInterpolationST): ruch XY pod stalym katem (bManualXYRightUp 45, LeftUp 135,
// LeftDown 225, RightDown 315)
export const DIAGONALS = { ru: 45, lu: 135, ld: 225, rd: 315 };
export const diagonalDir = (deg) => ({ x: Math.cos(deg * Math.PI / 180), y: Math.sin(deg * Math.PI / 180) });

// Ruch z wychylem (bManualMoveWithTiltUp / Down, ManualInterpolationST): przesuniecie XYZ wzdluz pochylonej tarczy
// o dist w Z (fManualMoveWithTiltDistance); up - wyjazd z materialu (Z w gore), inaczej w dol:
//   dx = s sin(A) tan(B) d,  dy = -s cos(A) tan(B) d,  dz = -s d   (s = 1 w gore, -1 w dol; Z w dol dodatnie)
export function tiltMoveVector(aDeg, bDeg, dist, up) {
  const s = up ? 1 : -1;
  const a = aDeg * Math.PI / 180;
  const t = Math.tan(bDeg * Math.PI / 180);
  return { x: s * Math.sin(a) * t * dist, y: -s * Math.cos(a) * t * dist, z: -s * dist };
}
