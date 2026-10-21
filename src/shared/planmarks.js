// Znaczniki planu (#137): punkty poczatkowe i koncowe kolejnych akcji (operacja, kroki automatu) na materiale,
// z wartosciami X / Y. Punkt wspolny (koniec akcji i = poczatek akcji i+1) - jeden znacznik.

const SAME = 0.5;      // mm - punkty blizej siebie to jeden znacznik

// Wspolrzedna do etykiety: calkowite bez miejsc po przecinku, reszta z jednym
export const fmtXY = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
export const markLabel = (x, y) => `X ${fmtXY(x)}  Y ${fmtXY(y)}`;

// Odleglosci miedzy punktami: dla kazdej akcji odleglosc od punktu poczatkowego do koncowego (w linii prostej),
// etykieta w polowie toru akcji (luk - na luku). Bez etykiety: akcja zamknieta (okrag), wlasne punkty (wiercenie),
// odleglosc < 1 mm. -> [{x, y, d, active, label}]
export function planDistances(items, max = 120) {
  const out = [];
  for (const it of items || []) {
    if (out.length >= max) break;
    if (it.marks?.length) continue;
    const pts = (it.path || []).filter(Boolean);
    if (pts.length < 2) continue;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 1) continue;
    const [x, y] = pathMiddle(pts);
    out.push({ x, y, d, active: Boolean(it.active), label: `${fmtXY(d)} mm` });
  }
  return out;
}

// Punkt w polowie dlugosci lamanej
export function pathMiddle(pts) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l);
    total += l;
  }
  let rest = total / 2;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(1, rest / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    rest -= seg[i];
  }
  return pts[0];
}

// items: [{path: [[x, y] | null, ...], marks?: [[x, y], ...], active}] -> [{x, y, start, end, active, order, label}]
// marks - wlasne punkty akcji (np. wiercenie: punkt otworu), inaczej pierwszy i ostatni punkt sciezki;
// order - numer akcji (od 1), w ktorej punkt pojawia sie pierwszy raz; max - limit znacznikow
export function planMarks(items, max = 120) {
  const out = [];
  const add = (p, kind, active, order) => {
    const m = out.find((q) => Math.hypot(q.x - p[0], q.y - p[1]) <= SAME);
    if (m) {
      m[kind] = true;
      m.active ||= active;
      return;
    }
    if (out.length < max) out.push({ x: p[0], y: p[1], start: kind === 'start', end: kind === 'end', active, order, label: markLabel(p[0], p[1]) });
  };
  (items || []).forEach((it, k) => {
    const pts = (it.path || []).filter(Boolean);
    const active = Boolean(it.active);
    if (it.marks?.length) {
      for (const p of it.marks) add(p, 'start', active, k + 1);
      return;
    }
    if (!pts.length) return;
    add(pts[0], 'start', active, k + 1);
    add(pts[pts.length - 1], 'end', active, k + 1);
  });
  return out;
}
