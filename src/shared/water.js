// Woda i laser na glowicy (#141): kanciasta oslona tarczy (oslonka na wode), dwa niebieskie weze segmentowe z woda
// do dysz pod oslona po obu stronach tarczy (frez / wiertlo / polerka - przy kolnierzu narzedzia), strumien z dysz na
// tarcze (narzedzie) przy wlaczonych obrotach, modul lasera zamontowany na oslonie tarczy od strony lasera.
// W PLC zawory: IOVars.yWaterCut (pila), IOVars.yWaterMill (frez, wiercenie) - polozenie oslony, dysz i lasera nie
// jest w PLC, tylko w modelu (wg zdjecia w #141; laser.mountAngle w configu).

import { headFrame, isToolMode, topZ, add, mul, sub } from './geometry.js';

const DEG = Math.PI / 180;
const UP = [0, 0, 1];
const norm = (p) => { const l = Math.hypot(...p) || 1; return p.map((c) => c / l); };

// Wielkosc glowicy wg tarczy (jak w machine3d - bez zmiany przy zamianie narzedzia)
export function headDims(m) {
  const r = Math.max(m.discDiameter / 2, 150);
  return { r, ramW: Math.max(160, r * 0.45) };
}

// Punkt w plaszczyznie tarczy: kat od gory (0 - nad srodkiem, 90 - w strone u), odleglosc od srodka
const inPlane = (f, angleDeg, dist) => add(f.center, add(mul(f.d, -Math.cos(angleDeg * DEG) * dist), mul(f.u, Math.sin(angleDeg * DEG) * dist)));

// Oslona tarczy (oslonka na wode) wg zdjecia w #141 - pomiary w promieniach tarczy (srodek piasty ok. (295, 377) px,
// promien tarczy ok. 120 px w pionie, skrot perspektywy w poziomie ok. 0.85 z wybrania wokol piasty): kanciasta plyta
// w plaszczyznie tarczy - pionowa krawedz |s| 0.96 (t -0.40 .. -0.07), skos do (|s| 0.27, t 0.87), plaska gora t 0.87,
// druga krawedz |s| 0.81, dol t -0.57 / -0.40; okragle wybranie wokol piasty (widac nakretke). Na zdjeciu patrzymy na
// zewnetrzna sciane oslony (nakretka piasty), wiec lewa strona zdjecia to -u: skos oslony i dysze sa od strony -u.
// Punkty [s, t] w modelu: s wzdluz u, t w gore w plaszczyznie tarczy.
// Oslona musi byc wieksza od tarczy (tarcza wychodzi tylko dolem): proporcje ze zdjecia powiekszone tak, ze
// wszystkie krawedzie nad dolem oslony sa poza obwodem tarczy (|s| krawedzi pionowych > 1, skos > 1 od srodka).
export const GUARD_OUTLINE = [[-1.08, -0.45], [-1.08, 0.25], [-0.5, 1.1], [1.05, 1.1], [1.05, -0.62], [0.0, -0.62], [0.0, -0.45]];
// odbojnik wody (zdjecie: plyta pod przednim dolnym narozem oslony od strony skosu, do stolu) - zielona guma
export const FLAP = { s: -1.08, width: 60, thickness: 8, maxDrop: 0.8 };
export const GUARD_HUB_HOLE = 0.24;                       // promien wybrania wokol piasty [promienie tarczy]
// grubosc oslony wzdluz normalnej tarczy: od strony silnika (-) i od zewnatrz (+) [mm poza polowa szerokosci tarczy]
export const GUARD_SIDES = { inner: 40, outer: 80 };

// Punkt w plaszczyznie tarczy z [s, t] w promieniach (s - przod, t - w gore) i odsunieciem wzdluz normalnej [mm]
const inGuard = (f, st, off = 0) => add(add(add(f.center, mul(f.u, st[0] * f.radius)), mul(f.d, -st[1] * f.radius)), mul(f.normal, off));

// Uklad wody: {supply, manifold, hoses: [[p...]], nozzles: [p], targets: [p]} - punkty w ukladzie swiata.
// Pila wg zdjecia w #141 (wszystko po zewnetrznej stronie oslony): stalowy oplatany przewod z gory glowicy do
// rozdzielacza (srebrny blok) przy dolnym rogu oslony od strony +u (s 0.85, t -0.55); z niego dwa niebieskie weze
// segmentowe (Loc-Line) - petla na zewnatrz i skosem w gore do dwoch dysz tuz obok piasty na jej wysokosci
// (s 0.22 / 0.29, t 0.04 / -0.08), skierowanych w strone -u (skosu oslony) - woda na tarcze pod oslona; trzeci waz
// z rozdzielacza w dol pod tarcze do dyszy przy dolnej czesci tarczy (s 0.15, t -0.75).
// Narzedzie: rozdzielacz nad kolnierzem, dysze po obu stronach narzedzia, woda na czolo.
// spin - kierunek obrotu tarczy (+1 - gora tarczy w strone +u): woda trafia w strone tarczy, ktora schodzi w material.
export function waterLayout(pose, m, spin = 1) {
  const f = headFrame(pose, m);
  const { ramW } = headDims(m);
  const top = add(f.pivot, mul(UP, ramW * 0.7));            // wyjscie przewodu z korpusu obrotu A
  const hoses = [];
  const nozzles = [];
  const targets = [];
  let manifold;
  let supply;
  if (isToolMode(m)) {
    manifold = add(f.flange, add(mul(f.normal, -40), mul(UP, 60)));
    supply = [top, add(mul(add(top, manifold), 0.5), mul(f.u, -120)), manifold];
    for (const s of [1, -1]) {
      const side = mul(f.u, s * (f.radius + 60));
      const nozzle = add(add(f.flange, mul(f.normal, Math.min(80, f.length * 0.4))), side);
      hoses.push([manifold, add(add(f.flange, mul(f.normal, -10)), mul(side, 1.3)), nozzle]);
      nozzles.push(nozzle);
      targets.push(add(f.tip, mul(f.u, s * f.radius * 0.5)));
    }
    const spray = { tool: true, center: f.tip, u: f.u, normal: f.normal, R: f.radius, top: topZ(m) };
    return { supply, manifold, hoses, nozzles, targets, spray };
  }
  const bw2 = m.bladeWidth / 2;
  const face = bw2 + GUARD_SIDES.outer;                    // zewnetrzna sciana oslony
  manifold = inGuard(f, [0.97, -0.66], face - 30);
  supply = [top, inGuard(f, [1.35, 0.6], face - 20), inGuard(f, [1.35, -0.3], face - 30), manifold];
  // gorne dysze: weze wychodza z rozdzielacza na zewnatrz, petla i skosem przed sciana oslony do dysz przy piascie
  [[[0.22, 0.04], 0], [[0.29, -0.08], 22]].forEach(([tip, dz]) => {
    const o = face + 18 + dz;
    const nozzle = inGuard(f, tip, o);
    hoses.push([add(manifold, mul(f.normal, 20 + dz)), inGuard(f, [1.25, -0.72], o), inGuard(f, [1.32, -0.48], o),
      inGuard(f, [0.9, -0.22], o), inGuard(f, [0.55, -0.06 + tip[1] * 0.5], o), nozzle]);
    nozzles.push(nozzle);
    targets.push(inGuard(f, [-0.62, -0.62], bw2 + 0.5));
  });
  // dolna dysza: z rozdzielacza w dol pod tarcze, przy dolnej czesci tarczy
  const low = inGuard(f, [0.15, -0.75], bw2 + 30);
  hoses.push([add(manifold, mul(f.normal, -10)), inGuard(f, [0.6, -0.78], bw2 + 40), inGuard(f, [0.35, -0.84], bw2 + 35), low]);
  nozzles.push(low);
  targets.push(inGuard(f, [-0.3, -0.7], bw2 + 0.5));
  // woda na poczatek tarczy (#141, film): obwod po stronie, ktora przy danym obrocie schodzi w material (spin +1 - strona
  // +u), tuz nad powierzchnia materialu
  const up = mul(f.d, -1);
  const R = f.radius;
  const sgn = spin >= 0 ? 1 : -1;
  const tTop = (topZ(m) - f.center[2]) / Math.max(up[2], 0.2);   // powierzchnia materialu w plaszczyznie tarczy
  const tHit = Math.min(-0.25 * R, Math.max(-0.95 * R, tTop + 15));
  const sHit = sgn * Math.sqrt(R * R - tHit * tHit) * 0.96;
  const hit = add(add(add(f.center, mul(f.u, sHit)), mul(up, tHit)), mul(f.normal, bw2 + 1));
  targets.fill(hit);
  // mokra plama na materiale (film: kamien mokry wzdluz ciecia za tarcza) - prostokat na powierzchni materialu
  const wet = tTop > -R && tTop < R
    ? [add(f.center, mul(up, tTop)), mul(f.u, -sgn), 2.4 * R, 0.9 * R]   // [poczatek, kierunek, dlugosc, szerokosc]
    : null;
  const spray = { tool: false, center: f.center, u: f.u, up, normal: f.normal, R, bw2, top: topZ(m), tTop, hit: [sHit, tHit], spin: sgn, wet };
  return { supply, manifold, hoses, nozzles, targets, spray };
}

// Krople wzdluz strugi z dyszy do celu: n kropli, faza 0..1 (czas) - punkty na luku z lekkim opadem
// (os strugi w widoku: spread 0)
export function waterDrops(nozzle, target, n, phase, spread = 6) {
  const out = [];
  const dir = sub(target, nozzle);
  const len = Math.hypot(...dir);
  for (let i = 0; i < n; i++) {
    const t = (phase + i / n) % 1;
    const sag = 4 * t * (1 - t) * Math.min(60, len * 0.15);
    const j = Math.sin(i * 12.9898) * spread;                 // stale odchylenie kropli (bez losowania - stabilny obraz)
    const k = Math.cos(i * 78.233) * spread;
    out.push([nozzle[0] + dir[0] * t + j, nozzle[1] + dir[1] * t + k, nozzle[2] + dir[2] * t - sag + (j + k) * 0.3]);
  }
  return out;
}

// Pseudolosowe 0..1 dla kropli (stale - obraz nie migocze)
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

// Woda z dysz (#141, film z ciecia): kazda kropla (faza 0..1 z czasu):
//  1. z dyszy na poczatek tarczy (strona schodzaca w material, tuz nad powierzchnia),
//  2a. 65% - obrot wciaga wode w rzaz: po obwodzie przez material do wyjscia z rzazu po drugiej stronie,
//  2b. 35% - rozlewa sie po scianie tarczy przy trafieniu (obie strony) i scieka - warstwa wody zaslania tarcze,
//  3. przy wyjsciu z rzazu odrywa sie stycznie do obwodu (nisko, w kierunku obrotu), z grawitacja spada na material za
//     tarcza (rozbryzg wzdluz ciecia); bez materialu pod tarcza - odrywa sie po ok. 70 stopniach.
// -> {drops: [x, y, z, ...], mist: [x, y, z, ...]} (mgla - co czwarta kropla rozbryzgu, duze polprzezroczyste punkty)
export function waterSpray(layout, phase, n = 380) {
  const drops = [];
  const mist = [];
  const sp = layout.spray;
  layout.nozzles.forEach((noz, j) => {
    const target = layout.targets[j];
    for (let i = 0; i < n; i++) {
      const id = j * 1000 + i;
      const tau = (phase * 1.4 + i / n) % 1;
      let p;
      if (tau < 0.16) {
        // 1. struga z dyszy (lekki stozek)
        const a = tau / 0.16;
        const spread = a * 18;
        p = add(add(noz, mul(sub(target, noz), a)), [(rnd(id, 1) - 0.5) * spread, (rnd(id, 2) - 0.5) * spread, (rnd(id, 3) - 0.5) * spread - a * (1 - a) * 30]);
      } else if (sp.tool) {
        // narzedzie: woda rozlewa sie promieniscie od czola i spada na material
        const c = (tau - 0.16) / 0.84;
        const ang = rnd(id, 4) * Math.PI * 2;
        const v = sp.R + 150 + rnd(id, 5) * 350;
        p = [sp.center[0] + Math.cos(ang) * v * c, sp.center[1] + Math.sin(ang) * v * c, sp.center[2] + 60 * c - 900 * c * c];
        p[2] = Math.max(p[2], sp.top + 2);
      } else {
        p = bladeDrop(sp, id, (tau - 0.16) / 0.84);
        if (p.mist && i % 2 === 0) mist.push(p[0], p[1], p[2]);
      }
      drops.push(p[0], p[1], p[2]);
    }
  });
  return { drops, mist };
}

// Kropla po trafieniu w tarcze (c = 0..1): po tarczy, w rzazie, rozbryzg - wg spray z waterLayout
function bladeDrop(sp, id, c) {
  const side = rnd(id, 6) < 0.6 ? 1 : -1;            // wieksza czesc po stronie dysz, reszta przechodzi na druga strone
  const off = side * (sp.bw2 + 1 + rnd(id, 7) * 4);
  const rim = (th, rho) => add(add(add(sp.center, mul(sp.u, Math.cos(th) * rho)), mul(sp.up, Math.sin(th) * rho)), mul(sp.normal, off));
  const th0 = Math.atan2(sp.hit[1], sp.hit[0]);
  const R = sp.R;
  if (rnd(id, 12) < 0.35) {
    // 2b. warstwa wody na scianie tarczy przy trafieniu: rozlewa sie w gore i w strone srodka, potem scieka
    const ang = th0 + (rnd(id, 13) - 0.3) * 0.9 * sp.spin;
    const rho = R * (0.97 - 0.45 * rnd(id, 14) * Math.min(1, c * 2));
    const p = rim(ang, rho);
    p[2] -= 260 * c * c;
    p[2] = Math.max(p[2], sp.top + 2);
    return p;
  }
  // 2a. kat wyjscia z rzazu: obwod przecina powierzchnie materialu po drugiej stronie tarczy (w kierunku obrotu)
  let dTh = 1.2;
  if (sp.tTop > -R && sp.tTop < R) {
    const thR = Math.asin(sp.tTop / R);               // przeciecie po stronie +u
    const exit = sp.spin > 0 ? -Math.PI - thR : thR;  // spin +1: kat maleje, wyjscie po stronie -u (kat -pi - thR)
    dTh = sp.spin > 0 ? th0 - exit : exit - th0;
    while (dTh < 0) dTh += Math.PI * 2;
    while (dTh > Math.PI * 2) dTh -= Math.PI * 2;
  }
  const split = 0.35;
  if (c < split) return rim(th0 - sp.spin * dTh * (c / split), R * (0.93 + 0.06 * rnd(id, 9)));
  // 3. rozbryzg (film): z wyjscia z rzazu w kierunku obrotu, plasko i nisko wzdluz ciecia (skladowa w gore
  //    stycznej mocno stlumiona), wachlarz na boki, z grawitacja; na materiale zostaje (splywa po powierzchni)
  const k = (c - split) / (1 - split);
  const th1 = th0 - sp.spin * dTh;
  const p0 = rim(th1, R);
  const tu = Math.sin(th1) * sp.spin;                 // skladowa stycznej wzdluz u (kierunek wyrzutu wzdluz ciecia)
  const dir = add(mul(sp.u, Math.sign(tu || -sp.spin)), mul(sp.up, 0.12 + 0.25 * rnd(id, 15)));
  const v = 700 + rnd(id, 10) * 1500;
  const lat = (rnd(id, 11) - 0.5) * 0.6 * v;
  const p = add(add(p0, mul(dir, v * k)), mul(sp.normal, lat * k));
  p[2] -= 900 * k * k;
  p[2] = Math.max(p[2], sp.top + 2);
  p.mist = true;
  return p;
}

// Odleglosc od srodka tarczy do krawedzi oslony (w promieniach) w kierunku dir = [s, t] (jednostkowy)
export function guardRadius(dir) {
  let best = 0;
  const P = GUARD_OUTLINE;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    // promien z (0, 0) w kierunku dir przecina odcinek a-b: k * dir = a + w * (b - a)
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const det = dir[0] * -ey - dir[1] * -ex;
    if (Math.abs(det) < 1e-12) continue;
    const k = (a[0] * -ey - a[1] * -ex) / det;
    const w = (dir[0] * a[1] - dir[1] * a[0]) / det;
    if (k > 0 && w >= -1e-9 && w <= 1 + 1e-9) best = Math.max(best, k);
  }
  return best;
}

// Modul lasera: na krawedzi oslony tarczy od strony lasera (side = laser.side), mountAngle stopni od gory w strone
// kierunku lasera; narzedzie - nad kolnierzem w strone lasera. -> {pos, u, normal, up}
export function laserMount(pose, m, side = 1, mountAngle = 50) {
  const f = headFrame(pose, m);
  if (isToolMode(m)) {
    const pos = add(add(f.flange, mul(UP, 80)), mul(f.u, side * (f.radius + 160)));
    return { pos, u: mul(f.u, side), normal: f.normal, up: UP };
  }
  // na krawedzi oslony (GUARD_OUTLINE) w kierunku mountAngle od gory, 40 mm nad nia
  const dir = [Math.sin(side * mountAngle * DEG), Math.cos(mountAngle * DEG)];
  const edge = guardRadius(dir) * f.radius;
  const pos = inPlane(f, side * mountAngle, edge + 40);
  return { pos, u: mul(f.u, side), normal: f.normal, up: norm(sub(pos, f.center)) };
}

// Odbojnik wody (#141, zdjecie): zielona gumowa plyta w poprzek rzazu pod przednim dolnym narozem oslony (strona -u),
// wisi od dolnej krawedzi oslony do powierzchni materialu (najwyzej FLAP.maxDrop promienia ponizej oslony).
// -> {center, x (w poprzek - normalna), y (w gore w plaszczyznie tarczy), z (wzdluz u), size: [szer., wys., grubosc]}
export function guardFlap(pose, m) {
  const f = headFrame(pose, m);
  if (isToolMode(m)) return null;
  const R = f.radius;
  const up = mul(f.d, -1);
  const tTop = GUARD_OUTLINE[0][1] * R;                       // dol oslony przy przedniej krawedzi
  const tMat = (topZ(m) + 2 - f.center[2]) / Math.max(up[2], 0.2);  // powierzchnia materialu w plaszczyznie tarczy
  const tBot = Math.min(tTop - 20, Math.max(tMat, tTop - FLAP.maxDrop * R));
  const bw2 = m.bladeWidth / 2;
  const n0 = -(bw2 + GUARD_SIDES.inner + FLAP.width / 2);
  const n1 = bw2 + GUARD_SIDES.outer + FLAP.width / 2;
  const sMid = FLAP.s * R + FLAP.thickness / 2;
  const center = add(add(add(f.center, mul(f.u, sMid)), mul(up, (tTop + tBot) / 2)), mul(f.normal, (n0 + n1) / 2));
  return { center, x: f.normal, y: up, z: mul(f.u, -1), size: [n1 - n0, tTop - tBot, FLAP.thickness] };
}
