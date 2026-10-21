// Narzedzie na wrzecionie (frez, wiertlo - koronka, polerka): uklad czesci wzdluz osi i znaczniki obrotu (#136).
//
// Punkt narzedzia: kolnierz + os * k + rho * (cos t * d + sin t * u), gdzie k - odleglosc od kolnierza wzdluz osi
// narzedzia (toolFrame.normal), rho - promien, t - kat wokol osi. Znaczniki obracaja sie o spin [rad] (kat wrzeciona).

const add3 = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const mul3 = (p, k) => [p[0] * k, p[1] * k, p[2] * k];

// Czesci narzedzia trybu: {shank: [k0, k1, promien], work: [k0, k1, promien], kind}
// frez - chwyt + czesc robocza, wiertlo - chwyt + koronka (rura), polerka - trzpien + talerz
export function toolLayout(mode, radius, length) {
  const r = Math.max(radius, 1);
  const len = Math.max(length, 1);
  if (mode === 'drill') {
    const shank = Math.min(60, len * 0.25);
    return { kind: 'drill', shank: [0, shank, Math.min(r * 0.5, 30)], work: [shank, len, r] };
  }
  if (mode === 'polishing') {
    const pad = Math.min(30, len);
    return { kind: 'polishing', shank: [0, len - pad, Math.min(r * 0.35, 40)], work: [len - pad, len, r] };
  }
  const cut = Math.min(len, Math.max(40, len * 0.35));
  return { kind: 'mill', shank: [0, len - cut, Math.min(r * 0.7, 25)], work: [len - cut, len, r] };
}

// Punkt narzedzia w ukladzie swiata
export function toolPoint(f, k, rho, t) {
  return add3(add3(f.flange, mul3(f.normal, k)), add3(mul3(f.d, rho * Math.cos(t)), mul3(f.u, rho * Math.sin(t))));
}

const FLUTES = 4;            // ostrza frezu
const HELIX = 0.9;           // skret ostrza na dlugosci czesci roboczej [rad]
const SEGMENTS = 6;          // segmenty koronki
const SECTORS = 8;           // sektory polerki

// Znaczniki obrotu: {lines: [p0, p1, p0, p1, ...], accent: [...]} - pary punktow (odcinki), accent - wyrozniony
// znacznik (pierwsze ostrze / segment / sektor, kreska na chwycie), zeby bylo widac kierunek i predkosc obrotu
export function toolSpinMarks(f, mode, spin = 0) {
  const lay = toolLayout(mode, f.radius, f.length);
  const [w0, w1, r] = lay.work;
  const [s0, s1, rs] = lay.shank;
  const lines = [];
  const accent = [];
  const seg = (out, a, b) => out.push(a, b);
  const P = (k, rho, t) => toolPoint(f, k, rho, t);
  // kreska wzdluz chwytu (widac obroty, gdy czolo jest schowane w materiale)
  seg(accent, P(s0 + (s1 - s0) * 0.1, rs * 1.04, spin), P(s1, rs * 1.04, spin));
  if (lay.kind === 'mill') {
    // spiralne ostrza na czesci roboczej
    for (let j = 0; j < FLUTES; j++) {
      const out = j === 0 ? accent : lines;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const k0 = w0 + (w1 - w0) * i / n; const k1 = w0 + (w1 - w0) * (i + 1) / n;
        const t0 = spin + j * 2 * Math.PI / FLUTES + HELIX * i / n;
        const t1 = spin + j * 2 * Math.PI / FLUTES + HELIX * (i + 1) / n;
        seg(out, P(k0, r * 1.01, t0), P(k1, r * 1.01, t1));
      }
      // ostrze na czole: od osi do obwodu, konczy sie tam, gdzie spirala
      const tEnd = spin + j * 2 * Math.PI / FLUTES + HELIX;
      seg(out, P(w1 + 0.5, r * 0.08, tEnd), P(w1 + 0.5, r * 0.99, tEnd));
    }
  } else if (lay.kind === 'drill') {
    // segmenty koronki na obwodzie czola (zarys: dwa luki + boki) i pasy wzdluz rury
    const h = Math.min(10, (w1 - w0) * 0.2);
    for (let j = 0; j < SEGMENTS; j++) {
      const out = j === 0 ? accent : lines;
      const tc = spin + j * 2 * Math.PI / SEGMENTS;
      const ta = tc - 0.16; const tb = tc + 0.16;
      const ro = r * 1.03;
      seg(out, P(w1, ro, ta), P(w1, ro, tb));
      seg(out, P(w1 - h, ro, ta), P(w1 - h, ro, tb));
      seg(out, P(w1, ro, ta), P(w1 - h, ro, ta));
      seg(out, P(w1, ro, tb), P(w1 - h, ro, tb));
      seg(out, P(w1 + 0.5, r * 0.9, tc), P(w1 + 0.5, r * 1.03, tc));
    }
    for (const t of [spin, spin + Math.PI]) seg(t === spin ? accent : lines, P(w0, r * 1.01, t), P(w1 - h, r * 1.01, t));
  } else {
    // sektory na talerzu polerki (od spodu) i znacznik na boku talerza
    for (let j = 0; j < SECTORS; j++) {
      const t = spin + j * 2 * Math.PI / SECTORS;
      seg(j === 0 ? accent : lines, P(w1 + 0.5, r * 0.15, t), P(w1 + 0.5, r * 0.97, t));
    }
    const n = 48;
    for (let i = 0; i < n; i++) seg(lines, P(w1 + 0.5, r * 0.55, 2 * Math.PI * i / n), P(w1 + 0.5, r * 0.55, 2 * Math.PI * (i + 1) / n));
    seg(accent, P(w0, r * 1.02, spin), P(w1, r * 1.02, spin));
  }
  return { lines, accent, layout: lay };
}
