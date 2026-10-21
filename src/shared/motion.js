// Ruch w trybie offline - profil trapezowy jak w napedach (przyspieszenie, predkosc, hamowanie).
//
// Parametry (jak w PLC, Settings/VelocityAcceleration i CutST):
//   ciecie XY - predkosc fVelocitySawMode [mm/s], przyspieszenie Acc, hamowanie Dec [mm/s2]
//               (w PLC Acc := Vel/TAccXY, Dec := Vel/TDecXY)
//   szybki dojazd XY - fVelocityFast, DecX / DecY
//   os Z - fVelocityAxisZWork, DecZ
//   os A / B - VelA / VelB [deg/s], DecA / DecB [deg/s2]

import { plcAxisXY, plcAxisZ, lineAngle } from './geometry.js';

export const AXES = ['x', 'y', 'z', 'a', 'b'];

// Profil trapezowy (albo trojkatny, gdy droga za krotka na osiagniecie predkosci)
export class Profile {
  constructor(distance, vel, acc, dec = acc) {
    this.L = Math.abs(distance);
    this.acc = acc;
    this.dec = dec;
    if (this.L < 1e-9 || !(vel > 0) || !(acc > 0) || !(dec > 0)) {
      this.vMax = 0; this.tAcc = 0; this.tCruise = 0; this.tDec = 0; this.duration = 0;
      return;
    }
    const sAcc = vel * vel / (2 * acc);
    const sDec = vel * vel / (2 * dec);
    if (sAcc + sDec <= this.L) {
      this.vMax = vel;
      this.tCruise = (this.L - sAcc - sDec) / vel;
    } else {
      this.vMax = Math.sqrt(2 * this.L * acc * dec / (acc + dec));
      this.tCruise = 0;
    }
    this.tAcc = this.vMax / acc;
    this.tDec = this.vMax / dec;
    this.duration = this.tAcc + this.tCruise + this.tDec;
  }

  // droga po czasie t
  s(t) {
    if (this.duration === 0) return this.L;
    if (t <= 0) return 0;
    if (t >= this.duration) return this.L;
    if (t < this.tAcc) return 0.5 * this.acc * t * t;
    const sA = 0.5 * this.vMax * this.tAcc;
    if (t < this.tAcc + this.tCruise) return sA + this.vMax * (t - this.tAcc);
    const td = this.duration - t;
    return this.L - 0.5 * this.dec * td * td;
  }

  // predkosc po czasie t
  v(t) {
    if (this.duration === 0 || t <= 0 || t >= this.duration) return 0;
    if (t < this.tAcc) return this.acc * t;
    if (t < this.tAcc + this.tCruise) return this.vMax;
    return this.dec * (this.duration - t);
  }
}

const copyPose = (p) => ({ x: p.x, y: p.y, z: p.z, a: p.a, b: p.b });

// Ruch po prostej w XYZ (interpolacja grupy), A i B przejezdzaja proporcjonalnie
function linearSegment(from, to, vel, acc, dec, step) {
  const L = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const prof = new Profile(L, vel, acc, dec);
  return {
    step,
    duration: prof.duration,
    end: copyPose(to),
    poseAt(t) {
      const k = prof.L > 0 ? prof.s(t) / prof.L : 1;
      const p = {};
      for (const ax of AXES) p[ax] = from[ax] + (to[ax] - from[ax]) * k;
      return p;
    },
    velocityAt: (t) => prof.v(t),
  };
}

// Kazda os osobno (jak MC_MoveAbsolute na kilku osiach naraz)
function axesSegment(from, to, params, step) {
  const profiles = {};
  let duration = 0;
  for (const ax of AXES) {
    const [vel, acc] = params[ax];
    profiles[ax] = new Profile(to[ax] - from[ax], vel, acc);
    duration = Math.max(duration, profiles[ax].duration);
  }
  return {
    step,
    duration,
    end: copyPose(to),
    poseAt(t) {
      const p = {};
      for (const ax of AXES) p[ax] = from[ax] + Math.sign(to[ax] - from[ax]) * profiles[ax].s(t);
      return p;
    },
    velocityAt(t) {
      return Math.hypot(profiles.x.v(t), profiles.y.v(t), profiles.z.v(t));
    },
  };
}

function dwellSegment(pose, duration, step) {
  return { step, duration, end: copyPose(pose), poseAt: () => copyPose(pose), velocityAt: () => 0 };
}

// Program = kolejne segmenty; poseAt(t) dla calego programu
export class Program {
  constructor(segments) {
    this.segments = segments;
    let t = 0;
    for (const s of segments) { s.start = t; t += s.duration; }
    this.duration = t;
  }

  at(t) {
    const segs = this.segments;
    let seg = segs[segs.length - 1];
    for (const s of segs) {
      if (t < s.start + s.duration) { seg = s; break; }
    }
    const local = Math.min(Math.max(t - seg.start, 0), seg.duration);
    return { pose: seg.poseAt(local), step: seg.step, velocity: seg.velocityAt(local), done: t >= this.duration };
  }
}

// Parametry dynamiki dla ruchu osi pojedynczych: {x: [v, a], ...}
function fastAxes(d) {
  return { x: [d.fastVel, d.fastAcc], y: [d.fastVel, d.fastAcc], z: [d.zVel, d.zAcc], a: [d.aVel, d.aAcc], b: [d.bVel, d.bAcc] };
}

// Dojazd do zadanej pozycji osi (zakladka "Pozycja"): najpierw Z do gory, jesli trzeba, potem reszta osi
export function gotoProgram(from, target, dyn) {
  const segs = [];
  let cur = copyPose(from);
  const axes = fastAxes(dyn);
  if (target.z < cur.z) {
    const up = { ...cur, z: target.z };
    segs.push(axesSegment(cur, up, axes, 'MoveToStartPosition'));
    cur = up;
  }
  segs.push(axesSegment(cur, copyPose(target), axes, 'MoveToStartPosition'));
  return new Program(segs);
}

// Najwyzsza (najmniejsza) pozycja Z potrzebna, zeby przy kazdym wychyle miedzy b0 i b1
// najnizszy punkt tarczy byl "above" mm nad materialem
export function safeZ(b0, b1, above, m) {
  let z = Infinity;
  for (let i = 0; i <= 60; i++) z = Math.min(z, plcAxisZ(-above, b0 + (b1 - b0) * i / 60, m));
  return z;
}

// Glebokosci przejsc: rowne przyrosty do glebokosci calkowitej
export function depthTable(totalDepth, passes) {
  const n = Math.max(1, Math.round(passes));
  return Array.from({ length: n }, (_, i) => totalDepth * (i + 1) / n);
}

// Pojedyncze ciecie jak CutST: dojazd nad poczatek (Z w gore, potem X/Y/A/B), dla kazdej glebokosci
// zjazd w Z i ciecie wzdluz linii (na zmiane w obie strony), na koniec wyjazd w Z.
// cut = {x0, y0, x1, y1, b, depths: [...], above}, m = machine, dyn = parametry dynamiki
export function cutProgram(from, cut, m, dyn) {
  const a = lineAngle(cut.x0, cut.y0, cut.x1, cut.y1);
  const ends = [plcAxisXY(cut.x0, cut.y0, a, cut.b, m), plcAxisXY(cut.x1, cut.y1, a, cut.b, m)];
  const zAbove = plcAxisZ(-cut.above, cut.b, m);
  const axes = fastAxes(dyn);
  const segs = [];
  let cur = copyPose(from);
  // dojazd na wysokosci bezpiecznej dla calego obrotu B (tarcza nie moze zahaczyc materialu)
  const zSafe = Math.min(zAbove, safeZ(cur.b, cut.b, cut.above, m));
  if (cur.z > zSafe) {
    const up = { ...cur, z: zSafe };
    segs.push(axesSegment(cur, up, axes, 'MoveToStartPosition'));
    cur = up;
  }
  const over = { x: ends[0][0], y: ends[0][1], z: cur.z, a, b: cut.b };
  segs.push(axesSegment(cur, over, axes, 'MoveToStartPosition'));
  cur = over;
  if (cur.z !== zAbove) {
    const start = { ...cur, z: zAbove };
    segs.push(axesSegment(cur, start, axes, 'MoveToStartPosition'));
    cur = start;
  }
  let side = 0;
  cut.depths.forEach((depth, i) => {
    const down = { ...cur, z: plcAxisZ(depth, cut.b, m) };
    segs.push(axesSegment(cur, down, axes, 'StartCutDepth'));
    side = 1 - side;
    const along = { ...down, x: ends[side][0], y: ends[side][1] };
    const last = i === cut.depths.length - 1;
    segs.push(linearSegment(down, along, dyn.cutVel, dyn.cutAcc, dyn.cutDec, last ? 'StartLastCut' : 'StartSingleCut'));
    cur = along;
  });
  const up = { ...cur, z: zAbove };
  segs.push(axesSegment(cur, up, axes, 'StartMoveAboveMaterial'));
  segs.push(dwellSegment(up, 0.5, 'CutFinish'));
  return new Program(segs);
}
