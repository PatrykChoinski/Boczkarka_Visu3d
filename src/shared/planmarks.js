// Znaczniki planu (#137): punkty poczatkowe i koncowe kolejnych akcji (operacja, kroki automatu) na materiale,
// z wartosciami X / Y. Punkt wspolny (koniec akcji i = poczatek akcji i+1) - jeden znacznik.

const SAME = 0.5;      // mm - punkty blizej siebie to jeden znacznik

// Wspolrzedna do etykiety: calkowite bez miejsc po przecinku, reszta z jednym
export const fmtXY = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
export const markLabel = (x, y) => `X ${fmtXY(x)}  Y ${fmtXY(y)}`;

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
