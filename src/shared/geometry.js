// Geometria glowicy pily - jak w PLC (CutST.GetPositions / GetNextDepth).
//
// Uklad maszyny: X, Y poziomo, Z w dol (wieksze Z = nizej), A - obrot glowicy
// (kierunek ciecia w XY), B - wychyl tarczy. Uklad swiata w aplikacji: x = X,
// y = Y, z = -Z (do gory), zeby rysowac jak zwykla scene 3D.
//
// Model glowicy (wyprowadzony z formul PLC):
//  - os obrotu A pionowa przez (X, Y),
//  - kierunek ciecia u = (cos A, sin A), poprzecznie n = (sin A, -cos A),
//  - os wychylu B pozioma, rownolegla do u, przesunieta od osi A o
//    (fParameterHeadRotationDiameter/2 - fParameterCutTiltDiameter/2) wzdluz n, na wysokosci Z,
//  - srodek tarczy odsuniety od osi wychylu o fParameterCutTiltDiameter/2 wzdluz osi
//    wrzeciona (normalna tarczy): przy B = 0 pozioma (n), przy wychyle B = cos B * n + sin B * dol.
//
// Sprawdzenie (test/geometry.test.js): najnizszy punkt tarczy lezy na linii ciecia z GetPositions,
// a jego glebokosc pod fCutMaterialHeight to glebokosc z GetNextDepth.
//
// Frez / wiertlo / narzedzie polerskie (tryby po bazowaniu z B = 90, MillST / DrillST / Polishing):
//  - os wychylu przesunieta od osi A o -fParameterMillTiltDiameter/2 wzdluz n,
//  - wrzeciono jak przy tarczy (normalna = cos B * n + sin B * dol), kolnierz narzedzia fParameterCutTiltDiameter/2
//    od osi wychylu, koniec narzedzia dalej o dlugosc narzedzia (z korekta fParameterMillCorrection),
//  - przy B = 90 koniec narzedzia jest pod punktem (X, Y) - n * MillTiltDiameter/2, Z konca = Z osi +
//    CutTiltDiameter/2 + dlugosc, czyli dokladnie odwrotnosc formul MillST.GetPositions / GetNextDepth.

const DEG = Math.PI / 180;

export function machine(params = {}) {
  return {
    discDiameter: 625,          // fParameterDiscDiameter
    bladeWidth: 4,              // fParameterBladeWidth
    cutTiltDiameter: 0,         // fParameterCutTiltDiameter
    headRotationDiameter: 0,    // fParameterHeadRotationDiameter
    materialHeight: 400,        // fCutMaterialHeight (Z gornej powierzchni)
    materialThickness: 30,      // fParameterMaterialThickness
    mode: 'saw',                // tryb po bazowaniu: saw | mill | drill | polishing (bModeSaw / Mill / Drill / Polishing)
    millWidth: 50,              // fParameterMillWidth - srednica frezu i wiertla
    millTiltDiameter: 450,      // fParameterMillTiltDiameter
    millLength: 250,            // fParameterMillLength
    drillLength: 250,           // fParameterDrillLength
    millCorrection: 0,          // fParameterMillCorrection (fParameterCorrection frezu i wiercenia)
    polishDiameter: 120,        // srednica narzedzia polerskiego (w PLC brak - parametr wizualizacji)
    polishHeight: -60,          // ActiveTool.Height (wysokosc narzedzia polerskiego z pomiaru)
    ...params,
  };
}

export const radius = (m) => m.discDiameter / 2;
export const topZ = (m) => -m.materialHeight;   // gora materialu w ukladzie swiata

export const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
export const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
export const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
export const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

// Polozenie tarczy w ukladzie swiata dla pozycji osi {x, y, z, a, b}
export function bladeFrame(pose, m) {
  const a = pose.a * DEG;
  const b = pose.b * DEG;
  const u = [Math.cos(a), Math.sin(a), 0];
  const n = [Math.sin(a), -Math.cos(a), 0];
  const down = [0, 0, -1];
  const axis = [pose.x, pose.y, -pose.z];
  const pivot = add(axis, mul(n, m.headRotationDiameter / 2 - m.cutTiltDiameter / 2));
  const normal = add(mul(n, Math.cos(b)), mul(down, Math.sin(b)));
  const center = add(pivot, mul(normal, m.cutTiltDiameter / 2));
  const d = add(mul(n, -Math.sin(b)), mul(down, Math.cos(b)));
  const r = radius(m);
  return {
    center, u, d, normal, pivot, axis,
    cosB: Math.cos(b),
    radius: r,
    lowest: add(center, mul(d, r)),
    // punkt plaszczyzny tarczy: s wzdluz u, t wzdluz d od srodka
    point: (s, t) => add(center, add(mul(u, s), mul(d, t))),
  };
}

// --- narzedzie na wrzecionie (frez, wiertlo, polerka) -----------------------------

export const isToolMode = (m) => Boolean(m.mode) && m.mode !== 'saw';

// Srednica i dlugosc narzedzia trybu (dlugosc od kolnierza wrzeciona do czola, z korekta jak w PLC):
//  frez  - fParameterMillWidth, fParameterMillLength + fParameterCorrection (MillST.GetNextDepth)
//  wiertlo - fParameterMillWidth (to samo narzedzie co frez), fParameterDrillLength + korekta (DrillST)
//  polerka - srednica z wizualizacji, korekta - ActiveTool.Height (Polishing: Z + Height - Correction)
export function toolSize(m) {
  const corr = m.millCorrection || 0;
  if (m.mode === 'drill') return { diameter: m.millWidth, length: m.drillLength + corr };
  if (m.mode === 'polishing') return { diameter: m.polishDiameter, length: corr - m.polishHeight };
  return { diameter: m.millWidth, length: m.millLength + corr };
}

// Polozenie narzedzia w ukladzie swiata: tip - srodek czola, lowest - punkt styku z materialem
// (przy B = 90 srodek czola, przy wychyle najnizszy punkt krawedzi czola)
export function toolFrame(pose, m) {
  const a = pose.a * DEG;
  const b = pose.b * DEG;
  const u = [Math.cos(a), Math.sin(a), 0];
  const n = [Math.sin(a), -Math.cos(a), 0];
  const down = [0, 0, -1];
  const axis = [pose.x, pose.y, -pose.z];
  const pivot = add(axis, mul(n, -m.millTiltDiameter / 2));
  const normal = add(mul(n, Math.cos(b)), mul(down, Math.sin(b)));
  const flange = add(pivot, mul(normal, m.cutTiltDiameter / 2));
  const { diameter, length } = toolSize(m);
  const tip = add(flange, mul(normal, length));
  const d = add(mul(n, -Math.sin(b)), mul(down, Math.cos(b)));
  const r = Math.max(diameter, 0) / 2;
  const cosB = Math.cos(b);
  return {
    kind: 'tool', u, n, d, normal, pivot, axis, flange, tip, center: tip, cosB, radius: r, length, diameter,
    lowest: Math.abs(cosB) < 1e-6 ? tip : add(tip, mul(d, r)),
  };
}

// Glowica trybu: tarcza (pila) albo narzedzie na wrzecionie
export const headFrame = (pose, m) => (isToolMode(m) ? toolFrame(pose, m) : bladeFrame(pose, m));

// Glebokosc najnizszego punktu tarczy / narzedzia pod gorna powierzchnia materialu (mm, > 0 = w materiale)
export const penetration = (frame, m) => topZ(m) - frame.lowest[2];

// --- formuly z PLC (tryb offline, testy) ------------------------------------

// CutST.GetPositions: pozycja osi X/Y dla punktu linii ciecia (bez fBX/YOffset)
export function plcAxisXY(lineX, lineY, aDeg, bDeg, m) {
  const a = aDeg * DEG;
  const b = bDeg * DEG;
  const k = m.cutTiltDiameter / 2 - m.headRotationDiameter / 2
    - Math.cos(b) * m.cutTiltDiameter / 2 + Math.sin(b) * m.discDiameter / 2;
  return [lineX + Math.sin(a) * k, lineY - Math.cos(a) * k];
}

// CutST.GetNextDepth: pozycja osi Z dla glebokosci ciecia (bez korekt wychylu)
export function plcAxisZ(depth, bDeg, m) {
  const b = bDeg * DEG;
  return m.materialHeight - Math.sin(b) * m.cutTiltDiameter / 2 - Math.cos(b) * m.discDiameter / 2 + depth;
}

// MillST.GetPositions / DrillST.GetPositions / Polishing: pozycja osi X/Y dla punktu narzedzia (bez korekty
// w XY - jak w PLC); B = 90 -> przesuniecie o fParameterMillTiltDiameter/2
export function plcToolAxisXY(px, py, aDeg, bDeg, m) {
  const a = aDeg * DEG;
  const len = m.mode === 'drill' ? m.drillLength : m.mode === 'polishing' ? 0 : m.millLength;
  const k = m.millTiltDiameter / 2 - Math.cos(bDeg * DEG) * (len + m.cutTiltDiameter / 2);
  return [px + Math.sin(a) * k, py - Math.cos(a) * k];
}

// MillST.GetNextDepth / DrillST (fDrillDepth) / Polishing (ActiveTool.Height): pozycja osi Z dla glebokosci
export function plcToolAxisZ(depth, bDeg, m) {
  const s = Math.sin(bDeg * DEG);
  const corr = m.millCorrection || 0;
  if (m.mode === 'polishing') return m.materialHeight + m.polishHeight - s * (corr + m.cutTiltDiameter / 2) + depth;
  const len = m.mode === 'drill' ? m.drillLength : m.millLength;
  return m.materialHeight - s * (m.cutTiltDiameter / 2 + len + corr) + depth;
}

// Pozycja Z / XY osi dla glebokosci / punktu w trybie maszyny (pila - CutST, narzedzia - MillST)
export const workAxisZ = (depth, bDeg, m) => (isToolMode(m) ? plcToolAxisZ(depth, bDeg, m) : plcAxisZ(depth, bDeg, m));
export const workAxisXY = (px, py, aDeg, bDeg, m) => (isToolMode(m) ? plcToolAxisXY(px, py, aDeg, bDeg, m) : plcAxisXY(px, py, aDeg, bDeg, m));

// GetAngleFun: kat linii ciecia z dwoch punktow (stopnie, -180..180)
export const lineAngle = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0) / DEG;

// Settings/ActualPosition w PLC: HMI2.fX/Y/ZActualPosition - punkt narzedzia z pozycji osi (to zapisuja przyciski
// "Zapisz", punkty stolu i kamienia, punkty reczne A / B / C, Z polerowania). Bez fStatusAxisTiltCorrection
// i bServiceBladeWidthTilt (w modelu 0). Os: {x, y, z, a, b} jak MCActualPosition*.Position.
function actualOffsets(pose, m) {
  const a = pose.a * DEG;
  const b = pose.b * DEG;
  const corr = m.millCorrection || 0;
  let k;
  let dz;
  if (m.mode === 'drill') {
    k = m.millTiltDiameter / 2;
    dz = Math.sin(b) * (m.drillLength + corr + m.cutTiltDiameter / 2);
  } else if (m.mode === 'polishing') {
    k = m.millTiltDiameter / 2;
    dz = Math.sin(b) * (corr + m.cutTiltDiameter / 2);
  } else if (m.mode === 'mill') {
    k = m.millTiltDiameter / 2 - Math.cos(b) * (m.millLength + corr + m.cutTiltDiameter / 2);
    dz = Math.sin(b) * (m.millLength + corr + m.cutTiltDiameter / 2);
  } else {
    k = m.cutTiltDiameter / 2 - m.headRotationDiameter / 2 - Math.cos(b) * m.cutTiltDiameter / 2 + Math.sin(b) * m.discDiameter / 2;
    dz = Math.sin(b) * m.cutTiltDiameter / 2 + Math.cos(b) * m.discDiameter / 2;
  }
  return { dx: -Math.sin(a) * k, dy: Math.cos(a) * k, dz };
}

export function plcActualPosition(pose, m) {
  const o = actualOffsets(pose, m);
  return { x: pose.x + o.dx, y: pose.y + o.dy, z: pose.z + o.dz, a: pose.a, b: pose.b };
}

// Odwrotnie: pozycja osi dla zapisanego punktu narzedzia (przy tych samych A / B)
export function axisFromActual(point, m) {
  const o = actualOffsets(point, m);
  return { x: point.x - o.dx, y: point.y - o.dy, z: point.z - o.dz, a: point.a, b: point.b };
}
