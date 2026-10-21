// Zapis obrobki narzedziem na wrzecionie (frez, wiertlo, polerka) - slad czola narzedzia w materiale.
//
// Jedno przejscie = ciagly ruch czola narzedzia w materiale: punkty srodka czola [x, y] z glebokoscia
// (od gornej powierzchni, w pionie). Widok rysuje rowek o szerokosci srednicy narzedzia (sciany, dno,
// pasek na gornej powierzchni), wiercenie - otwor (jedno przejscie, jeden punkt). Polerka pracuje na
// powierzchni (glebokosc 0) - slad zapisywany juz przy styku z materialem.

import { toolFrame, penetration, topZ } from './geometry.js';

const MIN_PENETRATION = 0.05;      // mm - frez / wiertlo ponizej nie skrawa
const POLISH_CONTACT = -0.5;       // mm - polerka: styk z powierzchnia (czolo na wysokosci materialu)
const MIN_STEP = 2;                // mm - nowy punkt przejscia co tyle wzdluz toru

export class ToolRecorder {
  constructor(maxPoints = 40000) {
    this.maxPoints = maxPoints;
    this.passes = [];           // [{radius, polish, top, points: [[x, y, depth]], maxDepth, rev}]; top - gora materialu (z swiata)
    this.open = null;           // przejscie w toku (narzedzie w materiale)
    this.box = null;
    this.points = 0;
    this.version = 0;
  }

  clear() {
    this.passes = [];
    this.open = null;
    this.box = null;
    this.points = 0;
    this.version++;
  }

  update(pose, m) {
    const frame = toolFrame(pose, m);
    if (!(frame.radius > 0)) return false;
    const polish = m.mode === 'polishing';
    let depth = penetration(frame, m);
    if (depth <= (polish ? POLISH_CONTACT : MIN_PENETRATION)) { this.open = null; return false; }
    depth = Math.min(Math.max(depth, 0), m.materialThickness);
    const [x, y] = frame.tip;
    let pass = this.open;
    const top = topZ(m);
    if (pass && (pass.radius !== frame.radius || pass.polish !== polish || pass.top !== top)) pass = null;
    if (!pass) {
      pass = { radius: frame.radius, polish, top, points: [], maxDepth: 0, rev: 0 };
      this.passes.push(pass);
      this.open = pass;
    }
    const last = pass.points[pass.points.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP) {
      if (depth <= last[2] + 1e-3) return false;
      last[2] = depth;
    } else {
      pass.points.push([x, y, depth]);
      this.points++;
      if (this.points > this.maxPoints) this.dropOldest();
    }
    pass.maxDepth = Math.max(pass.maxDepth, depth);
    pass.rev++;
    this.grow(x, y, frame.radius);
    this.version++;
    return true;
  }

  dropOldest() {
    const p = this.passes[0];
    if (!p || p === this.open) return;
    this.passes.shift();
    this.points -= p.points.length;
  }

  grow(x, y, r) {
    if (!this.box) this.box = [x - r, y - r, x + r, y + r];
    const b = this.box;
    b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y - r);
    b[2] = Math.max(b[2], x + r); b[3] = Math.max(b[3], y + r);
  }

  // Ostatnie przejscie: {length, depth, count} jak CutRecorder.summary (count - liczba przejsc)
  summary() {
    const last = this.passes[this.passes.length - 1];
    if (!last) return null;
    let length = 0;
    for (let i = 1; i < last.points.length; i++) {
      length += Math.hypot(last.points[i][0] - last.points[i - 1][0], last.points[i][1] - last.points[i - 1][1]);
    }
    return { length, depth: last.maxDepth, count: this.passes.length, polish: last.polish };
  }

  bounds() {
    return this.box ? [...this.box] : null;
  }
}
