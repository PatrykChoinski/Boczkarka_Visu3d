// Przekroj krawedzi plyty po kolejnych przejsciach (plaszczyzna (u, v)):
//   u - poziomo, na zewnatrz od krawedzi (glowica po stronie u > 0), krawedz pierwotna u = 0, plyta u <= 0,
//   v - pionowo, spod plyty v = 0, wierzch v = T (grubosc).
// Przejscie pod katem B = theta (0 - bok, + gora, - dol) zostawia material n.p <= d, n = (cos theta, sin theta):
// tarcza garnkowa szlifuje plaszczyzna styczna do docelowego profilu (luk walka / faza / bok).
import { PROFILE_TYPE } from './edgeprofile.js';

const rad = (deg) => (deg * Math.PI) / 180;
export const normal = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

// Promien i srodek luku dla profili walkowych (null dla faz i boku)
export function arcOf(kind, thickness, shape) {
  if (kind === PROFILE_TYPE.HalfRound) return { r: thickness / 2, c: [-thickness / 2, thickness / 2] };
  const r = Math.min(shape.quarterRadius, thickness);
  if (kind === PROFILE_TYPE.TopQuarterRound) return { r, c: [-r, thickness - r] };
  if (kind === PROFILE_TYPE.BottomQuarterRound) return { r, c: [-r, r] };
  return null;
}

// Polplaszczyzna przejscia {n, d} i punkt styku tarczy (srodek odcinka szlifowanego)
export function passPlane(kind, angleB, thickness, shape) {
  const n = normal(angleB);
  const arc = arcOf(kind, thickness, shape);
  if (arc) return { n, d: dot(n, arc.c) + arc.r, contact: [arc.c[0] + arc.r * n[0], arc.c[1] + arc.r * n[1]] };
  if (Math.abs(angleB) < 0.01) {
    // bok prosty (albo kat 0 w recepturze wlasnej): cienka warstwa z calej krawedzi
    return { n, d: -shape.straightDepth, contact: [-shape.straightDepth, thickness / 2] };
  }
  // faza: odcinek o pionowym boku chamferSize przy gornym (B > 0) albo dolnym (B < 0) narozu
  const c = Math.min(shape.chamferSize, thickness);
  const p = angleB > 0 ? [0, thickness - c] : [0, c];
  const d = dot(n, p);
  const corner = angleB > 0 ? [0, thickness] : [0, 0];
  const k = dot(n, corner) - d;
  return { n, d, contact: [corner[0] - k * n[0], corner[1] - k * n[1]] };
}

// Obciecie wielokata polplaszczyzna n.p <= d (Sutherland-Hodgman)
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

// Przekroj pasa krawedzi o szerokosci width po przejsciach o katach angles
export function edgeSection(kind, angles, thickness, shape, width = 60) {
  let poly = [[-width, 0], [0, 0], [0, thickness], [-width, thickness]];
  for (const a of angles) poly = clip(poly, passPlane(kind, a, thickness, shape));
  return poly;
}

// Stan obrobki z migawki maszyny (symulator albo PLC): ile przejsc (roznych katow) wykonanych w calosci
// i biezacy przejazd (kat, odcinek X juz zeszlifowany). passIndex jak w PLC: numer biezacego przejscia (1..),
// po ostatnim = passCount + 1; 0 - przed pierwszym cyklem.
export function cutState(s, passes) {
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
