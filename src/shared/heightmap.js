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

  // #152 tarcza (profil i wygladzanie): pionowy dysk - srodek c [x, y, z swiata], kierunek w plaszczyznie tarczy
  // u [ux, uy] (poziomy, jednostkowy), promien r, grubosc w. Komorki w pasie |(p - c) . n| <= w / 2 (n prostopadle
  // do u) obnizone do dolnego luku tarczy: z = cz - sqrt(r^2 - s^2), s = (p - c) . u
  bladeStamp(c, u, r, w) {
    if (c[2] - r >= this.top) return false;
    const n = [u[1], -u[0]];
    // pas co najmniej komorka (cienka tarcza na rzadkiej siatce)
    const hw = Math.max(w / 2, this.res * 0.75);
    const ex = Math.abs(u[0]) * r + Math.abs(n[0]) * hw;
    const ey = Math.abs(u[1]) * r + Math.abs(n[1]) * hw;
    const i0 = Math.max(0, Math.floor((c[0] - ex - this.x0) / this.res));
    const i1 = Math.min(this.nx - 1, Math.ceil((c[0] + ex - this.x0) / this.res));
    const j0 = Math.max(0, Math.floor((c[1] - ey - this.y0) / this.res));
    const j1 = Math.min(this.ny - 1, Math.ceil((c[1] + ey - this.y0) / this.res));
    const r2 = r * r;
    let changed = false;
    for (let j = j0; j <= j1; j++) {
      const dy = this.y0 + j * this.res - c[1];
      for (let i = i0; i <= i1; i++) {
        const dx = this.x0 + i * this.res - c[0];
        if (Math.abs(dx * n[0] + dy * n[1]) > hw) continue;
        const s = dx * u[0] + dy * u[1];
        if (s * s >= r2) continue;
        const z = Math.max(c[2] - Math.sqrt(r2 - s * s), this.bottom);
        const k = j * this.nx + i;
        if (z < this.z[k]) {
          if (this.z[k] === this.top) this.cut++;
          this.z[k] = z;
          changed = true;
          const d = this.dirty;
          if (!d) this.dirty = [i, j, i, j];
          else { d[0] = Math.min(d[0], i); d[1] = Math.min(d[1], j); d[2] = Math.max(d[2], i); d[3] = Math.max(d[3], j); }
        }
      }
    }
    if (changed) this.version++;
    return changed;
  }

  // Ruch tarczy c0 -> c1 (srodki), probki co najwyzej pol komorki - ruch w poprzek tarczy (wygladzanie) bez przerw
  bladeCarve(c0, c1, u, r, w) {
    const len = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
    const n = Math.max(1, Math.ceil(len / (this.res / 2)));
    let changed = false;
    for (let k = c0 === c1 ? n : 0; k <= n; k++) {
      const t = k / n;
      changed = this.bladeStamp([c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t], u, r, w) || changed;
    }
    return changed;
  }

  // Wysokosc w komorce (i, j) i najglebsze miejsce
  at(i, j) { return this.z[j * this.nx + i]; }
  minZ() { let m = this.top; for (const v of this.z) if (v < m) m = v; return m; }
}

// Podglad 2D (#124): cieniowanie mapy wysokosci jak plaskorzezba - swiatlo z lewej gory (spadki z roznic sasiadow)
// i kolor wg glebokosci. Wynik: RGBA nx x ny, wiersz 0 = najwieksze Y (+Y do gory jak w widoku "Gora").
// gain - wzmocnienie spadkow (plytkie reliefy wyrazniej)
export function shadeHeightMap(hm, gain = 0.6) {
  const { nx, ny, z } = hm;
  const out = new Uint8ClampedArray(nx * ny * 4);
  const depth = Math.max(1, hm.top - hm.bottom);
  for (let j = 0; j < ny; j++) {
    const row = (ny - 1 - j) * nx;
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const gx = (z[j * nx + Math.min(nx - 1, i + 1)] - z[j * nx + Math.max(0, i - 1)]) / (2 * hm.res);
      const gy = (z[Math.min(ny - 1, j + 1) * nx + i] - z[Math.max(0, j - 1) * nx + i]) / (2 * hm.res);
      // swiatlo z lewej gory (-X, +Y): normalna (-gx, -gy, 1) . (-1, 1, h) ~ gx - gy - jasniej sciany zwrocone w lewo-gore
      const light = Math.min(1, Math.max(0, 0.6 + (0.7 * gx - 0.7 * gy) * gain));
      const d = Math.min(1, Math.max(0, (hm.top - z[k]) / depth));
      const o = (row + i) * 4;
      out[o] = (205 - 140 * d) * light;
      out[o + 1] = (198 - 150 * d) * light;
      out[o + 2] = (184 - 160 * d) * light;
      out[o + 3] = 255;
    }
  }
  return out;
}
