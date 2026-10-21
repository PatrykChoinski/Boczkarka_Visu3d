// Zapis wycietego materialu - pojedyncze ciecia tarcza.
//
// Jedno ciecie = jedna plaszczyzna tarczy (stale A, B i polozenie w poprzek). W tej plaszczyznie
// trzymana jest obwiednia glebokosci e(s): dla kazdego punktu s wzdluz linii ciecia najwieksza
// glebokosc (wzdluz d, od gornej powierzchni materialu), na jaka zeszla tarcza. Z obwiedni powstaje
// sciana rzazu (wycinek tarczy przeciagniety wzdluz ciecia) i pasek rzazu na gornej powierzchni.
// Przy wychyle kazda glebokosc lezy w troche innej plaszczyznie (zjazd w Z jest pionowy) - wtedy
// jest kilka plaszczyzn o tym samym kierunku, liczonych w podsumowaniu jako jedno ciecie.

import { add, mul, sub, dot, bladeFrame, penetration, topZ } from './geometry.js';

const ANGLE_TOL = Math.cos(0.3 * Math.PI / 180);   // zmiana A / B wieksza = nowe ciecie
const MIN_PENETRATION = 0.05;                        // mm - ponizej tarcza nie tnie

export class Cut {
  constructor(frame, m, resolution) {
    this.origin = frame.center;
    this.u = frame.u;
    this.d = frame.d;
    this.normal = frame.normal;
    this.cosB = Math.max(frame.cosB, 0.05);
    this.res = resolution;
    // gorna powierzchnia materialu w plaszczyznie tarczy: t = bTop (wzdluz d od origin)
    this.bTop = (this.origin[2] - topZ(m)) / this.cosB;
    this.tBottom = m.materialThickness / this.cosB;
    this.bladeWidth = m.bladeWidth;
    this.bins = new Map();      // indeks s -> glebokosc e
    this.maxDepth = 0;          // mm w pionie (najnizszy punkt tarczy pod gora materialu)
  }

  sameDirection(u, normal) {
    return dot(this.u, u) >= ANGLE_TOL && dot(this.normal, normal) >= ANGLE_TOL;
  }

  matches(frame) {
    if (!this.sameDirection(frame.u, frame.normal)) return false;
    return Math.abs(dot(sub(frame.center, this.origin), this.normal)) <= Math.max(0.5, this.bladeWidth / 2);
  }

  addSample(frame, depth) {
    const rel = sub(frame.center, this.origin);
    const si = dot(rel, this.u);
    const mi = dot(rel, this.d);
    const r = frame.radius;
    const lowest = mi + r - this.bTop;
    if (lowest <= 0) return false;
    let changed = false;
    const k0 = Math.floor((si - r) / this.res);
    const k1 = Math.ceil((si + r) / this.res);
    for (let k = k0; k <= k1; k++) {
      const ds = k * this.res - si;
      const h = r * r - ds * ds;
      if (h <= 0) continue;
      let e = mi + Math.sqrt(h) - this.bTop;
      if (e <= 0) continue;
      if (e > this.tBottom) e = this.tBottom;
      if (e > (this.bins.get(k) ?? 0) + 1e-6) {
        this.bins.set(k, e);
        changed = true;
      }
    }
    if (changed) this.maxDepth = Math.max(this.maxDepth, Math.min(depth, this.tBottom * this.cosB));
    return changed;
  }

  pointAt(s, e, offset = 0) {
    return add(add(this.origin, add(mul(this.u, s), mul(this.d, this.bTop + e))), mul(this.normal, offset));
  }

  // Ciagle odcinki obwiedni: [[s, e], ...]
  runs() {
    const keys = [...this.bins.keys()].sort((p, q) => p - q);
    const out = [];
    let run = [];
    let last = null;
    for (const k of keys) {
      if (last !== null && k !== last + 1) { out.push(run); run = []; }
      run.push([k * this.res, this.bins.get(k)]);
      last = k;
    }
    if (run.length) out.push(run);
    return out;
  }

  // Sciana rzazu jako pasy [gora, dol] (do triangulacji), offset wzdluz normalnej (+-polowa szerokosci)
  wallStrips(offset = 0, maxPoints = 200) {
    return this.runs().map((run) => {
      const step = Math.max(1, Math.floor(run.length / maxPoints));
      const pts = run.filter((_, i) => i % step === 0);
      if (pts[pts.length - 1] !== run[run.length - 1]) pts.push(run[run.length - 1]);
      return pts.map(([s, e]) => [this.pointAt(s, 0, offset), this.pointAt(s, e, offset)]);
    });
  }

  // Rzaz na gornej powierzchni (szerokosc tarczy): czworokaty
  topBands() {
    const half = (this.bladeWidth / 2) / this.cosB;
    const across = [this.u[1], -this.u[0], 0];
    return this.runs().map((run) => {
      const p0 = this.pointAt(run[0][0], 0);
      const p1 = this.pointAt(run[run.length - 1][0], 0);
      return [add(p0, mul(across, half)), add(p1, mul(across, half)), add(p1, mul(across, -half)), add(p0, mul(across, -half))];
    });
  }
}

export class CutRecorder {
  constructor(resolution = 1, maxCuts = 60) {
    this.resolution = resolution;
    this.maxCuts = maxCuts;
    this.cuts = [];
    this.version = 0;           // rosnie przy kazdej zmianie (odswiezanie widoku)
  }

  clear() {
    this.cuts = [];
    this.version++;
  }

  update(pose, m) {
    if (!(m.discDiameter > 0)) return false;
    const frame = bladeFrame(pose, m);
    const depth = penetration(frame, m);
    if (depth <= MIN_PENETRATION) return false;
    let cut = null;
    for (let i = this.cuts.length - 1; i >= 0; i--) {
      if (this.cuts[i].matches(frame)) { cut = this.cuts[i]; break; }
    }
    if (!cut) {
      cut = new Cut(frame, m, this.resolution);
      this.cuts.push(cut);
      if (this.cuts.length > this.maxCuts) this.cuts.shift();
    }
    if (cut.addSample(frame, depth)) {
      this.version++;
      return true;
    }
    return false;
  }

  // Ostatnie ciecie (wszystkie plaszczyzny o tym samym A i B): {length, depth, count} albo null
  summary() {
    if (!this.cuts.length) return null;
    const last = this.cuts[this.cuts.length - 1];
    const group = this.cuts.filter((c) => c.sameDirection(last.u, last.normal));
    const along = [];
    for (const c of group) {
      for (const run of c.runs()) {
        along.push(dot(c.pointAt(run[0][0], 0), last.u), dot(c.pointAt(run[run.length - 1][0], 0), last.u));
      }
    }
    let count = 0;
    let prev = null;
    for (const c of this.cuts) {
      if (!prev || !c.sameDirection(prev.u, prev.normal)) count++;
      prev = c;
    }
    return { length: Math.max(...along) - Math.min(...along), depth: Math.max(...group.map((c) => c.maxDepth)), count };
  }

  // Zakres XY wszystkich ciec [minX, minY, maxX, maxY] albo null
  bounds() {
    const pts = this.cuts.flatMap((c) => c.topBands().flat());
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
}
