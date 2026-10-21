// Linie ciec programow piły, ktore same nie ruszaja osiami, tylko wystawiaja kolejne linie dla CutST
// (fManualXZeroPosition / YZero / XEnd / YEnd + bCutReverse): CutStripesST, CutBlocksST, EdgesST.
// Linia = {x0, y0, x1, y1, reverse} na gornej powierzchni materialu (linia tarczy, nie pozycje osi).

const DEG = Math.PI / 180;

// GetAngleFun: kat linii (-90, 90], niezalezny od kierunku przejazdu
export function getAngleFun(x0, y0, x1, y1) {
  if (x1 === x0) return 90;
  const a = Math.atan(Math.abs(y1 - y0) / Math.abs(x1 - x0)) / DEG;
  if ((y0 > y1 && x0 < x1) || (y0 < y1 && x0 > x1)) return -a;
  return a;
}

// GetAngle (pasy pod katem z dwoch punktow) - jak GetAngleFun
export const getAngle = getAngleFun;

const swapLine = (l) => ({ ...l, x0: l.x1, y0: l.y1, x1: l.x0, y1: l.y0 });

// Zamiana poczatku z koncem kolejnych linii (bServiceAllowSwap): przy jednym przejsciu co druga linia,
// przy kilku przejsciach - gdy ciecie konczy sie po drugiej stronie (nieparzysta liczba przejsc),
// od drugiej linii wszystkie zamienione (flaga w PLC zapamietana do konca)
export function applySwap(lines, passes) {
  return lines.map((l, i) => {
    const swap = passes <= 1 ? i % 2 === 1 : (i >= 1 && passes % 2 === 1);
    return swap ? swapLine(l) : l;
  });
}

// --- CutStripesST ------------------------------------------------------------------------------
// p: xs, ys, xe, ye, twoPoint, xCut, angleCut, angle, length, constant, width, number,
//    widths[], numbers[], repeating, reverse, toLaser, bladeWidth, blocksReverse, passes
export function stripesLines(p) {
  const bw = p.bladeWidth ?? 0;
  // liczba pasow N (GetNumber), linie i = 0..N
  let n;
  const rows = [];
  if (p.constant) {
    n = Math.max(0, Math.round(p.number));
  } else {
    n = 0;
    (p.widths || []).forEach((w, k) => {
      const cnt = Math.max(0, Math.round(p.numbers?.[k] || 0));
      const c = p.repeating ? cnt : (w > 1 ? 1 : cnt);
      for (let j = 0; j < c; j++) rows.push(w);
      n += c;
    });
  }
  let angle = 0; let cosa = 1; let sina = 1;
  if (p.angleCut) {
    angle = p.twoPoint ? getAngle(p.xs, p.ys, p.xe, p.ye) : p.angle;
    cosa = Math.cos(angle * DEG); sina = Math.sin(angle * DEG);
  }
  const lines = [];
  let done = 0;
  for (let i = 0; i <= n; i++) {
    const width = p.constant ? p.width : (i === 0 ? 0 : rows[i - 1] ?? 0);
    const len = p.length;
    const L = p.toLaser ? -len : len;
    let x0 = p.xs; let y0 = p.ys; let x1; let y1;
    if (p.twoPoint) {
      if (p.angleCut) { x1 = p.xe; y1 = p.ye; } else if (p.xCut) { x1 = p.xe; y1 = p.ys; } else { x1 = p.xs; y1 = p.ye; }
    } else {
      const s = Math.sin(angle * DEG); const c = Math.cos(angle * DEG);
      if (p.angleCut && p.reverse) { x1 = p.xs + len * s * (p.xCut ? 1 : -1); y1 = p.ys + len * c; }
      else if (p.angleCut) { x1 = p.xs + L * c; y1 = p.ys + (p.xCut ? L * s : -L * s); }
      else if (p.xCut) { x1 = p.xs + L; y1 = p.ys; }
      else { x1 = p.xs; y1 = p.reverse ? p.ys + L : p.ys - L; }
    }
    // przesuniecie pasa prostopadle do osi ciecia
    let shift = p.constant ? width * i : done + width / (p.xCut ? cosa : sina);
    if (p.reverse) shift = -shift;
    if (p.xCut) { y0 += shift; y1 += shift; } else { x0 += shift; x1 += shift; }
    lines.push({ x0, y0, x1, y1 });
    done += p.angleCut ? width * (p.xCut ? cosa : sina) : width;
  }
  // zamiana + rzaz tarczy (po zamianie, jak w GetPositions)
  return applySwap(lines, p.passes ?? 1).map((l, i) => {
    const a = getAngleFun(l.x0, l.y0, l.x1, l.y1) * DEG;
    const width = p.constant ? p.width : 1;
    let off = bw * i;
    if ((width >= 0) === Boolean(p.reverse)) off = -off;
    const reverse = (p.reverse && !p.dontTurn) || (!p.xCut && p.blocksReverse !== false && !p.reverse);
    return {
      x0: l.x0 + Math.sin(a) * off, y0: l.y0 + Math.cos(a) * off,
      x1: l.x1 + Math.sin(a) * off, y1: l.y1 + Math.cos(a) * off,
      reverse,
    };
  });
}

// --- CutBlocksST -------------------------------------------------------------------------------
// p: xs, ys, lengths[] (rozmiary blokow wzdluz X -> linie Y), widths[] (wzdluz Y -> linie X),
//    bladeWidth, additional (mm, 0 = brak), swapOrder (bServiceBlockSwap), blocksReverse, passes
const leading = (arr) => {
  const out = [];
  for (const v of arr || []) { if (!(v > 0)) break; out.push(v); }
  return out;
};

export function blocksLines(p) {
  const bw = p.bladeWidth ?? 0;
  const lens = leading(p.lengths);
  const wids = leading(p.widths);
  const xLast = lens.reduce((s, v) => s + v + bw, 0);
  const yLast = wids.reduce((s, v) => s + v + bw, 0);
  const e = p.additional || 0;
  const xLines = [];
  let yDone = 0;
  for (let i = 0; i <= wids.length; i++) {
    if (i > 0) yDone += wids[i - 1];
    const y = p.ys + yDone + bw * i;
    xLines.push({ x0: p.xs - e, y0: y, x1: p.xs + xLast + e, y1: y, reverse: false });
  }
  const yLines = [];
  let xDone = 0;
  for (let j = 0; j <= lens.length; j++) {
    if (j > 0) xDone += lens[j - 1];
    const x = p.xs + xDone + bw * j;
    yLines.push({ x0: x, y0: p.ys - e, x1: x, y1: p.ys + yLast + e, reverse: p.blocksReverse !== false });
  }
  const passes = p.passes ?? 1;
  const xs = applySwap(xLines, passes);
  const ys = applySwap(yLines, passes);
  return p.swapOrder ? [...ys, ...xs] : [...xs, ...ys];
}

// --- EdgesST (GetRectanglePositions + GetEdgePositions) -----------------------------------------
// p: xs, ys, length, width, angle, internal (0 zewn., >= 1 wewn.), additional (mm), acbd, bladeWidth, blocksReverse
export function edgesLines(p) {
  const bw = p.bladeWidth ?? 0;
  const L = p.internal >= 1 ? p.length - bw : p.length + bw;
  const W = p.internal >= 1 ? p.width - bw : p.width + bw;
  const ang = (p.angle || 0) * DEG;
  const d = [Math.cos(ang), Math.sin(ang)];
  const n = [-Math.sin(ang), Math.cos(ang)];
  const P = (base, k1, v1, k2 = 0, v2 = [0, 0]) => [base[0] + k1 * v1[0] + k2 * v2[0], base[1] + k1 * v1[1] + k2 * v2[1]];
  const A = [p.xs, p.ys];
  const B = P(A, L, d);
  const C = P(A, L, d, W, n);
  const D = P(A, W, n);
  const e = p.additional || 0;
  let pairs;
  if (e > 0) {
    pairs = [[P(A, -e, d), P(B, e, d)], [P(B, -e, n), P(C, e, n)], [P(C, e, d), P(D, -e, d)], [P(D, e, n), P(A, -e, n)]];
    if (p.acbd) pairs = [pairs[0], pairs[2], pairs[1], pairs[3]];
  } else if (p.acbd) {
    pairs = [[A, B], [D, C], [B, C], [D, A]];
  } else {
    pairs = [[A, B], [B, C], [C, D], [D, A]];
  }
  // bCutReverse := bServiceBlocksReverse AND (n MOD 2 = 0), n po zwiekszeniu - krawedz 2 i 4
  return pairs.map(([s, t], i) => ({ x0: s[0], y0: s[1], x1: t[0], y1: t[1], reverse: p.blocksReverse !== false && (i + 1) % 2 === 0 }));
}
