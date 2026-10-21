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
    let lo = 0; let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (t < segs[mid].start + segs[mid].duration) hi = mid; else lo = mid + 1;
    }
    const seg = segs[lo];
    const local = Math.min(Math.max(t - seg.start, 0), seg.duration);
    return { pose: seg.poseAt(local), step: seg.step, label: seg.label ?? null, index: seg.index ?? null, velocity: seg.velocityAt(local), done: t >= this.duration };
  }
}

// Parametry dynamiki dla ruchu osi pojedynczych: {x: [v, a], ...}
export function fastAxes(d) {
  return { x: [d.fastVel, d.fastAcc], y: [d.fastVel, d.fastAcc], z: [d.zVel, d.zAcc], a: [d.aVel, d.aAcc], b: [d.bVel, d.bAcc] };
}

// Ruch po luku w XY (interpolacja kolowa), Z / A / B proporcjonalnie do drogi; A podane jawnie
// (aFn(k) - kat glowicy dla k = 0..1 drogi), bo glowica idzie stycznie do luku
function arcSegment(from, arc, vel, acc, dec, step) {
  const { cx, cy, r, t0, t1 } = arc;           // srodek osi X/Y, promien, katy poczatku / konca [rad]
  const L = Math.abs(t1 - t0) * r;
  const prof = new Profile(L, vel, acc, dec);
  const end = arc.end;
  return {
    step,
    duration: prof.duration,
    end: copyPose(end),
    poseAt(t) {
      const k = prof.L > 0 ? prof.s(t) / prof.L : 1;
      const th = t0 + (t1 - t0) * k;
      return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th), z: from.z + (end.z - from.z) * k, a: from.a + (end.a - from.a) * k, b: from.b + (end.b - from.b) * k };
    },
    velocityAt: (t) => prof.v(t),
  };
}

// Ruch ciagly po lamanej (kolejne bloki buforowane bez zatrzymania): jeden profil na cala droge XYZ,
// osie A / B interpolowane miedzy punktami
function pathSegment(poses, vel, acc, dec, step) {
  const cum = [0];
  for (let i = 1; i < poses.length; i++) {
    const p = poses[i - 1]; const q = poses[i];
    cum.push(cum[i - 1] + Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z));
  }
  const L = cum[cum.length - 1];
  const prof = new Profile(L, vel, acc, dec);
  return {
    step,
    duration: prof.duration,
    end: copyPose(poses[poses.length - 1]),
    poseAt(t) {
      const s = prof.L > 0 ? prof.s(t) : L;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1];
      const k = seg > 0 ? Math.min(1, Math.max(0, (s - cum[i - 1]) / seg)) : 1;
      const p = {};
      for (const ax of AXES) p[ax] = poses[i - 1][ax] + (poses[i][ax] - poses[i - 1][ax]) * k;
      return p;
    },
    velocityAt: (t) => prof.v(t),
  };
}

// Kreator programu: kolejne ruchy od aktualnej pozycji, m - maszyna, dyn - dynamika (mm/s, mm/s2)
export class ProgramBuilder {
  constructor(from, m, dyn) {
    this.cur = copyPose(from);
    this.m = m;
    this.dyn = dyn;
    this.axes = fastAxes(dyn);
    this.segs = [];
  }

  push(seg) {
    seg.label = this.label ?? null;          // krok automatu (opis) i jego indeks - do paska stanu i podswietlenia
    seg.index = this.stepIndex ?? null;
    if (seg.duration > 0 || !this.segs.length) this.segs.push(seg);
    this.cur = copyPose(seg.end);
    return this;
  }

  // osie osobno (MC_MoveAbsolute), tylko podane osie; override - inne {os: [v, a]} (np. Z dojazdowa)
  axesTo(target, step, override = null) {
    const to = { ...this.cur, ...target };
    if (AXES.every((ax) => Math.abs(to[ax] - this.cur[ax]) < 1e-9)) return this;
    return this.push(axesSegment(this.cur, to, override ? { ...this.axes, ...override } : this.axes, step));
  }

  // Z z predkoscia dojazdowa (fVelocityAxisZApproach) - wyjazd nad material
  zUp(z, step) {
    return this.axesTo({ z }, step, { z: [this.dyn.zUpVel || this.dyn.zVel, this.dyn.zAcc] });
  }

  // prosta XYZ w interpolacji z predkoscia ciecia (albo vel / acc / dec podanymi)
  linearTo(target, step, vel = this.dyn.cutVel, acc = this.dyn.cutAcc, dec = this.dyn.cutDec) {
    const to = { ...this.cur, ...target };
    return this.push(linearSegment(this.cur, to, vel, acc, dec, step));
  }

  // luk w XY: srodek (cx, cy) osi X/Y, kat koncowy t1 [rad] (kierunek z t1 - t0), A / Z / B koncowe w target
  arcTo(cx, cy, t1, target, step, vel = this.dyn.cutVel) {
    const r = Math.hypot(this.cur.x - cx, this.cur.y - cy);
    const t0 = Math.atan2(this.cur.y - cy, this.cur.x - cx);
    const end = { ...this.cur, ...target, x: cx + r * Math.cos(t1), y: cy + r * Math.sin(t1) };
    return this.push(arcSegment(this.cur, { cx, cy, r, t0, t1, end }, vel, this.dyn.cutAcc, this.dyn.cutDec, step));
  }

  // ruch ciagly przez punkty (pozycje osi, brakujace osie = jak poprzednie)
  pathTo(points, step, vel = this.dyn.cutVel) {
    const poses = [copyPose(this.cur)];
    for (const p of points) poses.push({ ...poses[poses.length - 1], ...p });
    return this.push(pathSegment(poses, vel, this.dyn.cutAcc, this.dyn.cutDec, step));
  }

  dwell(duration, step) {
    return this.push(dwellSegment(this.cur, duration, step));
  }

  // Z w gore na wysokosc bezpieczna dla obrotu B od aktualnego do b (najnizszy punkt tarczy above mm nad materialem)
  liftFor(b, above, step = 'MoveToStartPosition') {
    const z = safeZ(this.cur.b, b, above, this.m);
    if (this.cur.z > z) this.zUp(z, step);
    return this;
  }

  // Dojazd jak GoToPositionST: Z nad material, X/Y/A, B, zjazd Z (gdy z podane)
  goto(target, above, step = 'GoToPosition') {
    const b = target.b ?? this.cur.b;
    this.liftFor(b, above, step);
    this.axesTo({ x: target.x ?? this.cur.x, y: target.y ?? this.cur.y, a: target.a ?? this.cur.a }, step);
    this.axesTo({ b }, step);
    if (target.z !== undefined) this.axesTo({ z: target.z }, step);
    return this;
  }

  build() {
    return new Program(this.segs.length ? this.segs : [dwellSegment(this.cur, 0, 'CutFinish')]);
  }
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
// cut = {x0, y0, x1, y1, b, depths: [...], above}
export function addStraightCut(pb, cut) {
  const m = pb.m;
  const a = lineAngle(cut.x0, cut.y0, cut.x1, cut.y1);
  const ends = [plcAxisXY(cut.x0, cut.y0, a, cut.b, m), plcAxisXY(cut.x1, cut.y1, a, cut.b, m)];
  const zAbove = plcAxisZ(-cut.above, cut.b, m);
  // dojazd na wysokosci bezpiecznej dla calego obrotu B (tarcza nie moze zahaczyc materialu)
  const zSafe = Math.min(zAbove, safeZ(pb.cur.b, cut.b, cut.above, m));
  if (pb.cur.z > zSafe) pb.axesTo({ z: zSafe }, 'MoveToStartPosition');
  pb.axesTo({ x: ends[0][0], y: ends[0][1], a, b: cut.b }, 'MoveToStartPosition');
  pb.axesTo({ z: zAbove }, 'MoveToStartPosition');
  let side = 0;
  cut.depths.forEach((depth, i) => {
    pb.axesTo({ z: plcAxisZ(depth, cut.b, m) }, 'StartCutDepth');
    side = 1 - side;
    const last = i === cut.depths.length - 1;
    pb.linearTo({ x: ends[side][0], y: ends[side][1] }, last ? 'StartLastCut' : 'StartSingleCut');
  });
  pb.axesTo({ z: zAbove }, 'StartMoveAboveMaterial');
  return pb;
}

export function cutProgram(from, cut, m, dyn) {
  const pb = new ProgramBuilder(from, m, dyn);
  addStraightCut(pb, cut);
  pb.dwell(0.5, 'CutFinish');
  return pb.build();
}
