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

const DEG = Math.PI / 180;

export function machine(params = {}) {
  return {
    discDiameter: 625,          // fParameterDiscDiameter
    bladeWidth: 4,              // fParameterBladeWidth
    cutTiltDiameter: 0,         // fParameterCutTiltDiameter
    headRotationDiameter: 0,    // fParameterHeadRotationDiameter
    materialHeight: 400,        // fCutMaterialHeight (Z gornej powierzchni)
    materialThickness: 30,      // fParameterMaterialThickness
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

// Glebokosc najnizszego punktu tarczy pod gorna powierzchnia materialu (mm, > 0 = w materiale)
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

// GetAngleFun: kat linii ciecia z dwoch punktow (stopnie, -180..180)
export const lineAngle = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0) / DEG;
