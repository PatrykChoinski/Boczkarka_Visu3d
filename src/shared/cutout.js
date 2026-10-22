// #156 ukrywanie wycietych elementow: kamien podzielony cieciami przez cala grubosc na kawalki - najwiekszy to plyta,
// pozostale (prostokat, okrag, blat, odciety naroznik ...) to elementy wyciete. Widok rysuje wtedy kamien jako
// ksztalt z otworami (kontury z siatki), bez wycietych elementow.
//
// Siatka nad kamieniem (komorka res mm): komorki kamienia (punkty wielokata kamienia), komorki rzazu - wzdluz ciec
// tam, gdzie obwiednia glebokosci siega spodu kamienia (Cut.bins >= tBottom), pas szerokosci tarczy (co najmniej
// komorka - male przerwy przy narozach ciec wewnetrznych sie domykaja). Kawalki - spojne obszary kamienia bez rzazu.

import { pointInPolygon, bounds } from './area.js';

const THROUGH_TOL = 0.5;      // mm - rzaz "przez cala grubosc" z tolerancja

// Siatka i podzial na kawalki. rock - wielokat kamienia [[x, y], ...], cuts - Cut[] (cuts.js).
// Zwraca {res, x0, y0, nx, ny, stone, piece, sizes, keep} albo null (brak kamienia)
export function pieceGrid(rock, cuts, maxCells = 200000) {
  if (!rock || rock.length < 3) return null;
  const [bx0, by0, bx1, by1] = bounds(rock);
  const res = Math.max(2, Math.sqrt((bx1 - bx0) * (by1 - by0) / maxCells));
  const x0 = bx0 - res; const y0 = by0 - res;
  const nx = Math.ceil((bx1 - bx0) / res) + 3;
  const ny = Math.ceil((by1 - by0) / res) + 3;
  const stone = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) stone[j * nx + i] = pointInPolygon(x0 + (i + 0.5) * res, y0 + (j + 0.5) * res, rock) ? 1 : 0;
  }
  // rzazy przez cala grubosc
  const kerf = new Uint8Array(nx * ny);
  for (const c of cuts) {
    const half = Math.max(c.bladeWidth / 2, res * 0.75);
    for (const run of c.runs()) {
      let seg = null;
      const flush = () => {
        if (seg) markSegment(kerf, nx, ny, x0, y0, res, c.pointAt(seg[0], 0), c.pointAt(seg[1], 0), half);
        seg = null;
      };
      for (const [s, e] of run) {
        if (e >= c.tBottom - THROUGH_TOL) seg = seg ? [seg[0], s] : [s, s];
        else flush();
      }
      flush();
    }
  }
  // kawalki: spojne (4 sasiadow) komorki kamienia bez rzazu
  const piece = new Int32Array(nx * ny).fill(-1);
  const sizes = [];
  const queue = new Int32Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) {
    if (!stone[k] || kerf[k] || piece[k] >= 0) continue;
    const id = sizes.length;
    let head = 0; let tail = 0;
    queue[tail++] = k;
    piece[k] = id;
    while (head < tail) {
      const q = queue[head++];
      const i = q % nx; const j = (q - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di; const b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const n = b * nx + a;
        if (stone[n] && !kerf[n] && piece[n] < 0) { piece[n] = id; queue[tail++] = n; }
      }
    }
    sizes.push(tail);
  }
  const keep = sizes.length ? sizes.indexOf(Math.max(...sizes)) : -1;
  return { res, x0, y0, nx, ny, stone, kerf, piece, sizes, keep };
}

// Pas wokol odcinka a -> b (srodek rzazu na gorze kamienia), polowa szerokosci half
function markSegment(mask, nx, ny, x0, y0, res, a, b, half) {
  const minX = Math.min(a[0], b[0]) - half; const maxX = Math.max(a[0], b[0]) + half;
  const minY = Math.min(a[1], b[1]) - half; const maxY = Math.max(a[1], b[1]) + half;
  const i0 = Math.max(0, Math.floor((minX - x0) / res)); const i1 = Math.min(nx - 1, Math.floor((maxX - x0) / res));
  const j0 = Math.max(0, Math.floor((minY - y0) / res)); const j1 = Math.min(ny - 1, Math.floor((maxY - y0) / res));
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * res - a[0]; const py = y0 + (j + 0.5) * res - a[1];
      const t = l2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l2)) : 0;
      const ex = px - dx * t; const ey = py - dy * t;
      if (ex * ex + ey * ey <= half * half) mask[j * nx + i] = 1;
    }
  }
}

// Kontury maski (komorki 1): petle po krawedziach komorek, zgodnie z ruchem wskazowek (otwory) albo przeciwnie
// (obrys) - pole ze znakiem; punkty wspolliniowe usuniete. -> [[x, y], ...][]
export function maskContours(mask, nx, ny, x0, y0, res) {
  const at = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? mask[j * nx + i] : 0);
  // krawedzie skierowane (maska po lewej stronie): z punktu siatki (i, j) do sasiedniego
  const next = new Map();
  const key = (i, j) => j * (nx + 1) + i;
  const addEdge = (a, b) => { const k = key(...a); if (!next.has(k)) next.set(k, []); next.get(k).push(b); };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!at(i, j)) continue;
      if (!at(i, j - 1)) addEdge([i, j], [i + 1, j]);
      if (!at(i + 1, j)) addEdge([i + 1, j], [i + 1, j + 1]);
      if (!at(i, j + 1)) addEdge([i + 1, j + 1], [i, j + 1]);
      if (!at(i - 1, j)) addEdge([i, j + 1], [i, j]);
    }
  }
  const loops = [];
  for (const [k0, outs] of next) {
    while (outs.length) {
      const start = [k0 % (nx + 1), Math.floor(k0 / (nx + 1))];
      const loop = [start];
      let cur = outs.pop();
      let prev = start;
      while (cur[0] !== start[0] || cur[1] !== start[1]) {
        loop.push(cur);
        const cand = next.get(key(...cur));
        if (!cand || !cand.length) break;
        // przy dwoch wyjsciach (styk komorek po przekatnej) - skret w prawo (petle sie nie przecinaja)
        let pick = cand.length - 1;
        if (cand.length > 1) {
          const din = [cur[0] - prev[0], cur[1] - prev[1]];
          pick = cand.findIndex((c) => (din[0] * (c[1] - cur[1]) - din[1] * (c[0] - cur[0])) < 0);
          if (pick < 0) pick = cand.length - 1;
        }
        prev = cur;
        cur = cand.splice(pick, 1)[0];
      }
      loops.push(simplify(loop).map(([i, j]) => [x0 + i * res, y0 + j * res]));
    }
  }
  return loops;
}

// usuwa punkty lezace na prostej miedzy sasiadami
function simplify(loop) {
  const n = loop.length;
  return loop.filter((p, k) => {
    const a = loop[(k + n - 1) % n]; const b = loop[(k + 1) % n];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

export const signedArea = (pts) => pts.reduce((s, p, k) => { const q = pts[(k + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

// Ksztalt kamienia bez wycietych elementow: [{outer, holes}] albo null (nic wycietego). minCells - mniejsze kawalki
// (np. miedzy bliskimi rzazami) tez ukryte, ale nie licza sie jako element
export function cutoutShapes(rock, cuts, minCells = 4) {
  const g = pieceGrid(rock, cuts);
  if (!g || g.sizes.length < 2) return null;
  const hidden = g.sizes.map((s, id) => id !== g.keep && s > 0);
  const elements = g.sizes.filter((s, id) => hidden[id] && s >= minCells).length;
  if (!elements) return null;
  const vis = new Uint8Array(g.nx * g.ny);
  for (let k = 0; k < vis.length; k++) vis[k] = g.stone[k] && !(g.piece[k] >= 0 && hidden[g.piece[k]]) ? 1 : 0;
  const loops = maskContours(vis, g.nx, g.ny, g.x0, g.y0, g.res);
  // obrysy (pole > 0 w ukladzie Y w gore - maska po lewej) i otwory (pole < 0) przypisane do obrysu, ktory je zawiera
  const outers = loops.filter((l) => signedArea(l) > 0).map((outer) => ({ outer, holes: [] }));
  for (const h of loops.filter((l) => signedArea(l) < 0)) {
    const o = outers.find((s) => pointInPolygon(h[0][0] + 1e-6, h[0][1] + 1e-6, s.outer) || pointInPolygon(...mid(h), s.outer));
    if (o) o.holes.push(h);
  }
  return { shapes: outers, elements, res: g.res };
}

const mid = (loop) => [(loop[0][0] + loop[1][0]) / 2, (loop[0][1] + loop[1][1]) / 2];
