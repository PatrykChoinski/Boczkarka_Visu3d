// Przekroj krawedzi plyty po kolejnych przejsciach (plaszczyzna (u, v)):
//   u - poziomo, na zewnatrz od krawedzi (glowica po stronie u > 0), krawedz pierwotna u = 0, plyta u <= 0,
//   v - pionowo, spod plyty v = 0, wierzch v = T (grubosc).
// Material pasa krawedzi: -width <= u <= f(v) dla v w 0..T (zarys f probkowany co T / SAMPLES) - obejmuje tez profile
// wklesle (Cove, Ogee, Dupont, Waterfall).
// Tarcza garnkowa pod katem B = theta (0 - bok, + gora, - dol) zostawia material n.p <= d, n = (cos theta, sin theta):
// plaszczyzna styczna do docelowego profilu (luk / faza / bok). Tarcza ksztaltowa (profile katalogowe przy B = 0)
// zostawia od razu zarys docelowy profilu.
import { PROFILE_TYPE as K, FORM_KINDS } from './edgeprofile.js';

const rad = (deg) => (deg * Math.PI) / 180;
export const normal = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const SAMPLES = 120;
const sq = (x) => Math.sqrt(Math.max(0, x));

// Promien i srodek luku dla profili walkowych (null dla faz, boku i profili ksztaltowych)
export function arcOf(kind, thickness, shape) {
  const t = thickness;
  if (kind === K.HalfRound) return { r: t / 2, c: [-t / 2, t / 2] };
  const radius = {
    [K.TopQuarterRound]: shape.quarterRadius, [K.BottomQuarterRound]: shape.quarterRadius,
    [K.QuarterRound]: shape.smallRadius ?? 6, [K.QuarterBullnose]: t / 2, [K.DemiBullnose]: 0.85 * t,
  }[kind];
  if (radius === undefined) return null;
  const r = Math.min(radius, t);
  return kind === K.BottomQuarterRound ? { r, c: [-r, r] } : { r, c: [-r, t - r] };
}

// Wysokosc fazy (pion przy narozu) dla rodzaju profilu
function chamferOf(kind, thickness, shape) {
  if (kind === K.HalfBevel) return thickness / 2;
  if (kind === K.European) return shape.easedSize ?? 2;
  return Math.min(shape.chamferSize, thickness);
}

// Zarys docelowy profili tarczy ksztaltowej: u = f(v) (u <= 0), proporcje do grubosci T
export function formOutline(kind, t) {
  const arcLeft = (cu, cv, r, v) => cu - sq(r * r - (v - cv) ** 2);		// lewa strona okregu (wkleslosc)
  const arcRight = (cu, cv, r, v) => cu + sq(r * r - (v - cv) ** 2);	// prawa strona (wypuklosc)
  const ogee = (r, v) => (v >= t - r ? arcRight(-2 * r, t - r, r, v) : v >= t - 2 * r ? arcLeft(0, t - r, r, v) : 0);
  switch (kind) {
    case K.Cove: { const r = 0.45 * t; return (v) => (v > t - r ? arcLeft(0, t, r, v) : 0); }
    case K.Dupont: {
      const s = 0.25 * t; const h = 0.15 * t;
      return (v) => (v > t - h ? -s : v > t - h - s ? arcRight(-s, t - h - s, s, v) : 0);
    }
    case K.CoveDupont: {
      const s = 0.2 * t; const h = 0.15 * t;
      return (v) => (v > t - h ? -s : v > t - h - s ? arcLeft(0, t - h, s, v) : 0);
    }
    case K.Ogee: return (v) => ogee(0.25 * t, v);
    case K.FlatOgee: return (v) => ogee(0.15 * t, v);
    case K.DeepOgee: return (v) => ogee(0.45 * t, v);
    case K.CoveOgee: {
      const r = 0.3 * t;
      return (v) => (v >= t - r ? arcLeft(-r, t, r, v) : v >= t - 2 * r ? arcRight(-r, t - 2 * r, r, v) : 0);
    }
    case K.OgeeBullnose: {
      const r = 0.2 * t; const rb = t - 2 * r;
      return (v) => (v >= t - 2 * r ? ogee(r, v) : v < rb ? arcRight(-rb, rb, rb, v) : 0);
    }
    case K.Waterfall: {
      const h = 0.2 * t; const w = 0.15 * t;
      return (v) => (v > t - h ? -2 * w : v > t - 2 * h ? -w : 0);
    }
    default: return null;
  }
}

// Polplaszczyzna przejscia tarczy garnkowej {n, d} i punkt styku tarczy (srodek odcinka szlifowanego).
// Profil ksztaltowy: {form} - zarys docelowy, styk na wierzcholku profilu.
export function passPlane(kind, angleB, thickness, shape) {
  const n = normal(angleB);
  const form = FORM_KINDS.includes(kind) ? formOutline(kind, thickness) : null;
  if (form) {
    let best = [form(thickness / 2), thickness / 2];
    for (let i = 0; i <= 40; i++) { const v = (i / 40) * thickness; if (form(v) > best[0]) best = [form(v), v]; }
    return { n, d: Infinity, form, contact: best };
  }
  const arc = arcOf(kind, thickness, shape);
  if (arc) return { n, d: dot(n, arc.c) + arc.r, contact: [arc.c[0] + arc.r * n[0], arc.c[1] + arc.r * n[1]] };
  if (Math.abs(angleB) < 0.01) {
    // bok prosty (tez European i kat 0 w recepturze wlasnej): cienka warstwa z calej krawedzi
    return { n, d: -shape.straightDepth, contact: [-shape.straightDepth, thickness / 2] };
  }
  // faza: odcinek o pionowym boku c przy gornym (B > 0) albo dolnym (B < 0) narozu
  const c = chamferOf(kind, thickness, shape);
  const p = angleB > 0 ? [0, thickness - c] : [0, c];
  const d = dot(n, p);
  const corner = angleB > 0 ? [0, thickness] : [0, 0];
  const k = dot(n, corner) - d;
  return { n, d, contact: [corner[0] - k * n[0], corner[1] - k * n[1]] };
}

// Obciecie wielokata polplaszczyzna n.p <= d (Sutherland-Hodgman) - pomocnicze (testy, rysunki)
export function clip(poly, { n, d }) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = dot(n, a) - d;
    const db = dot(n, b) - d;
    if (da <= 1e-9) out.push(a);
    if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

// Zarys u = f(v) pasa krawedzi po przejsciach (kat albo {angleB}); kazde przejscie scina zarys
export function edgeOutline(kind, angles, thickness, shape, width = 60) {
  const vs = Array.from({ length: SAMPLES + 1 }, (_, i) => (i * thickness) / SAMPLES);
  const f = vs.map(() => 0);
  for (const a of angles) {
    const pl = passPlane(kind, typeof a === 'number' ? a : a.angleB, thickness, shape);
    for (let i = 0; i < vs.length; i++) {
      let lim;
      if (pl.form) lim = pl.form(vs[i]);
      else if (Math.abs(pl.n[0]) < 1e-9) lim = pl.n[1] * vs[i] <= pl.d + 1e-9 ? Infinity : -width;
      else lim = (pl.d - pl.n[1] * vs[i]) / pl.n[0];
      f[i] = Math.max(-width, Math.min(f[i], lim));
    }
  }
  return { vs, f };
}

// Przekroj pasa krawedzi o szerokosci width po przejsciach (wielokat do rysunku i bryly)
export function edgeSection(kind, angles, thickness, shape, width = 60) {
  const { vs, f } = edgeOutline(kind, angles, thickness, shape, width);
  const right = vs.map((v, i) => [f[i], v]);
  // proste odcinki bez punktow posrednich (mniej wierzcholkow bryly)
  const pts = right.filter((p, i) => {
    if (i === 0 || i === right.length - 1) return true;
    const [a, b] = [right[i - 1], right[i + 1]];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
  return [[-width, 0], ...pts, [-width, thickness]];
}

// Stan obrobki z migawki maszyny (symulator albo PLC): ile przejsc (roznych katow) wykonanych w calosci
// i biezacy przejazd (kat, odcinek X juz zeszlifowany). passIndex jak w PLC: numer biezacego przejscia (1..),
// po ostatnim = passCount + 1; 0 - przed pierwszym cyklem. Etap polerowania (stage > 0): ksztalt juz gotowy.
export function cutState(s, passes) {
  if ((s.stage || 0) > 0) return { done: passes.length, partial: null };
  const done = Math.max(0, Math.min(passes.length, (s.passIndex || 0) - 1));
  const finished = (s.passIndex || 0) > passes.length && passes.length > 0;
  let partial = null;
  if (!finished && s.step === 50 && s.passIndex >= 1 && s.passIndex <= passes.length && s.passFrom != null) {
    const lo = Math.min(s.passFrom, s.x);
    const hi = Math.max(s.passFrom, s.x);
    if (hi - lo > 0.5) partial = { angle: passes[s.passIndex - 1].angleB, from: lo, to: hi };
  }
  return { done: finished ? passes.length : done, partial };
}
