// G-kod (#124, wizualizacja CNC 3D w trybie frezu): parser pliku .nc -> lista ruchow we wspolrzednych programu.
//
// Jak preprocesor CNC w PLC (CNC/Preprocessing): G0 / G1 (domyslnie G1), G2 / G3 (luk w XY: I / J; R - w PLC
// nieobslugiwane, tu liczone z ostrzezeniem), Z liniowo (helisa), G90 / G91, G20 / G21 (cale / mm - w PLC kasuja G54 i
// odwrocenie Y - ostrzezenie), G53 - PLC kasuje reszte linii (np. "G00 G53 Z100" nie rusza osi), F (posuw mm/min),
// S, M03 / M04 / M05 / M30, komentarze ( ... ) i ; , numery linii N. Z jak w pliku (rosnie w glab - jak os Z maszyny).

const WORD = /([A-Z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;

// Linia bez komentarzy, wielkie litery
function clean(line) {
  return line.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, '').toUpperCase();
}

// text -> {moves: [{kind: 'rapid' | 'feed' | 'arc', from: [x, y, z], to: [x, y, z], f, line,
//          arc?: {cx, cy, cw}}], spindle: [{line, on}], end: nr linii M30 | null, warnings: [...], lines}
export function parseGcode(text) {
  const moves = [];
  const spindle = [];
  const warnings = [];
  let pos = [0, 0, 0];
  let started = false;                 // pierwsza pozycja z pliku (przed nia pozycja nieznana - start w punkcie 0)
  let motion = 1;                      // 0 / 1 / 2 / 3 (PLC: DEFAULT_MOTION_MODE := G01)
  let absolute = true;
  let scale = 1;
  let feed = 0;
  let end = null;
  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const src = clean(lines[n]);
    if (!src.trim()) continue;
    const words = {};
    const gs = [];
    const ms = [];
    for (const [, letter, num] of src.matchAll(WORD)) {
      const v = Number(num);
      if (letter === 'G') gs.push(v);
      else if (letter === 'M') ms.push(v);
      else words[letter] = v;
    }
    let machine = false;
    let dwell = false;
    let skip = false;
    for (const g of gs) {
      if (g === 0 || g === 1 || g === 2 || g === 3) motion = g;
      else if (g === 90) absolute = true;
      else if (g === 91) absolute = false;
      else if (g === 20 || g === 70) { scale = 25.4; warnings.push(`linia ${n + 1}: G${g} (cale) - w PLC kasuje G54 i odwrocenie Y`); }
      else if (g === 21 || g === 71) scale = 1;
      else if (g === 4) dwell = true;
      else if (g === 28) { skip = true; warnings.push(`linia ${n + 1}: G28 (bazowanie) pominiete - linia bez ruchu`); }
      else if (g >= 55 && g <= 59) warnings.push(`linia ${n + 1}: G${g} - uklad G54 z HMI (inne uklady pominiete)`);
      else if (g >= 81 && g <= 84) { skip = true; warnings.push(`linia ${n + 1}: cykl G${g} pominiety - linia bez ruchu`); }
      else if (g === 53) machine = true;
      else if (![17, 40, 49, 54, 80, 94, 64, 61].includes(g)) warnings.push(`linia ${n + 1}: G${g} pominiete`);
    }
    if (words.F !== undefined) feed = words.F * scale;
    for (const m of ms) {
      if (m === 3 || m === 4) spindle.push({ line: n + 1, on: true });
      else if (m === 5) spindle.push({ line: n + 1, on: false });
      else if (m === 30 || m === 2) end = n + 1;
    }
    if (skip) { if (end) break; continue; }
    // G4: postoj P [ms] (albo X [s]) - bez ruchu
    if (dwell) {
      const t = words.P !== undefined ? words.P / 1000 : (words.X ?? 0);
      if (t > 0) moves.push({ kind: 'dwell', from: [...pos], to: [...pos], t, f: feed, line: n + 1 });
      if (end) break;
      continue;
    }
    // G53: PLC kasuje reszte linii (M1053 + G53) - bez ruchu
    if (machine) { if (end) break; continue; }
    const has = ['X', 'Y', 'Z'].some((k) => words[k] !== undefined);
    if (!has) { if (end) break; continue; }
    const to = [...pos];
    ['X', 'Y', 'Z'].forEach((k, i) => {
      if (words[k] === undefined) return;
      const v = words[k] * scale;
      to[i] = absolute || machine ? v : pos[i] + v;
    });
    if (motion === 2 || motion === 3) {
      let cx;
      let cy;
      if (words.R !== undefined) {
        warnings.push(`linia ${n + 1}: luk z R - w PLC nieobslugiwany (tylko I / J)`);
        const c = arcCenterR(pos, to, words.R * scale, motion === 2);
        if (!c) { warnings.push(`linia ${n + 1}: luk R bez rozwiazania`); pos = to; continue; }
        [cx, cy] = c;
      } else {
        cx = pos[0] + (words.I ?? 0) * scale;
        cy = pos[1] + (words.J ?? 0) * scale;
      }
      moves.push({ kind: 'arc', from: [...pos], to, f: feed, line: n + 1, arc: { cx, cy, cw: motion === 2 } });
    } else {
      moves.push({ kind: motion === 0 ? 'rapid' : 'feed', from: started ? [...pos] : [...to], to, f: feed, line: n + 1 });
    }
    started = true;
    pos = to;
    if (end) break;
  }
  return { moves, spindle, end, warnings: warnings.slice(0, 50), lines: lines.length };
}

// Srodek luku z promienia R (R < 0 - luk > 180 stopni), cw - zgodnie z zegarem
export function arcCenterR(a, b, R, cw) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  const r = Math.abs(R);
  if (d < 1e-9 || d > 2 * r + 1e-6) return null;
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2));
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  // srodek po prawej (cw) albo lewej (ccw) stronie cieciwy; R < 0 - druga strona
  const side = (cw ? -1 : 1) * (R < 0 ? -1 : 1);
  return [mx - side * h * dy / d, my + side * h * dx / d];
}

// Punkty luku (w XY, Z liniowo) co najwyzej step mm
export function arcPoints(m, step = 2) {
  const { cx, cy, cw } = m.arc;
  const r = Math.hypot(m.from[0] - cx, m.from[1] - cy);
  const t0 = Math.atan2(m.from[1] - cy, m.from[0] - cx);
  let t1 = Math.atan2(m.to[1] - cy, m.to[0] - cx);
  if (cw) { while (t1 >= t0 - 1e-9) t1 -= 2 * Math.PI; } else { while (t1 <= t0 + 1e-9) t1 += 2 * Math.PI; }
  const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) * r / step));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = t0 + (t1 - t0) * k / n;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t), m.from[2] + (m.to[2] - m.from[2]) * k / n]);
  }
  return pts;
}

// Ruch jako lamana (punkty co najwyzej step mm dla lukow, odcinki - konce)
export const movePoints = (m, step = 2) => (m.kind === 'arc' ? arcPoints(m, step) : m.kind === 'dwell' ? [m.to] : [m.from, m.to]);

// Podsumowanie programu: zakres XYZ ruchow roboczych (bez G53), dlugosci, szacowany czas (rapid - podany posuw)
export function gcodeSummary(prog, rapidFeed = 9000) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  let feedLen = 0;
  let rapidLen = 0;
  let time = 0;
  for (const m of prog.moves) {
    const pts = movePoints(m, 5);
    for (const p of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
    if (m.kind === 'dwell') time += m.t;
    else if (m.kind === 'rapid') { rapidLen += len; time += len / rapidFeed * 60; } else { feedLen += len; time += m.f > 0 ? len / m.f * 60 : 0; }
  }
  return { lo, hi, feedLen, rapidLen, time, moves: prog.moves.length };
}
