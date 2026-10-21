// Mapa wysokosci materialu (#124, CNC 3D): siatka w XY nad obszarem programu, w kazdej komorce wysokosc powierzchni
// (z swiata, do gory). Frez (plaskie czolo o promieniu r) obniza powierzchnie wzdluz toru - rzezba z tysiecy
// nakladajacych sie przejsc (zamiast osobnych rowkow jak ToolRecorder).

export class HeightMap {
  // [x0, y0, x1, y1] - obszar (mm swiata), top - gora materialu (z swiata), bottom - spod (nizej nie obnizamy),
  // res - rozmiar komorki [mm]
  constructor(box, top, bottom, res = 2) {
    this.res = res;
    this.x0 = box[0];
    this.y0 = box[1];
    this.nx = Math.max(2, Math.ceil((box[2] - box[0]) / res) + 1);
    this.ny = Math.max(2, Math.ceil((box[3] - box[1]) / res) + 1);
    this.top = top;
    this.bottom = bottom;
    this.z = new Float32Array(this.nx * this.ny).fill(top);
    this.version = 0;
    this.cut = 0;                       // liczba obnizonych komorek (do podsumowania)
    this.dirty = null;                  // [i0, j0, i1, j1] - komorki zmienione od ostatniego odczytu (takeDirty)
  }

  // Czolo frezu w (x, y) na wysokosci zTip (z swiata) - komorki w promieniu r nie wyzej niz zTip
  stamp(x, y, zTip, r) {
    if (zTip >= this.top) return false;
    const z = Math.max(zTip, this.bottom);
    const i0 = Math.max(0, Math.floor((x - r - this.x0) / this.res));
    const i1 = Math.min(this.nx - 1, Math.ceil((x + r - this.x0) / this.res));
    const j0 = Math.max(0, Math.floor((y - r - this.y0) / this.res));
    const j1 = Math.min(this.ny - 1, Math.ceil((y + r - this.y0) / this.res));
    const r2 = r * r;
    let changed = false;
    for (let j = j0; j <= j1; j++) {
      const dy = this.y0 + j * this.res - y;
      for (let i = i0; i <= i1; i++) {
        const dx = this.x0 + i * this.res - x;
        if (dx * dx + dy * dy > r2) continue;
        const k = j * this.nx + i;
        if (z < this.z[k]) {
          if (this.z[k] === this.top) this.cut++;
          this.z[k] = z;
          changed = true;
        }
      }
    }
    if (changed) {
      this.version++;
      const d = this.dirty;
      if (!d) this.dirty = [i0, j0, i1, j1];
      else { d[0] = Math.min(d[0], i0); d[1] = Math.min(d[1], j0); d[2] = Math.max(d[2], i1); d[3] = Math.max(d[3], j1); }
    }
    return changed;
  }

  // Zakres zmienionych komorek od ostatniego wywolania (null - bez zmian), zeruje zakres
  takeDirty() {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }

  // Odcinek toru a -> b (z swiata czubka narzedzia), probki co najwyzej step mm
  carve(a, b, r, step = this.res) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    let changed = false;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      changed = this.stamp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, r) || changed;
    }
    return changed;
  }

  // Wysokosc w komorce (i, j) i najglebsze miejsce
  at(i, j) { return this.z[j * this.nx + i]; }
  minZ() { let m = this.top; for (const v of this.z) if (v < m) m = v; return m; }
}
