// Figury frezu / wiercenia (grupa C) - bufor dla ProgramAutoMillST (kroki ProgramMillStep).
// Kazdy FB przeniesiony 1:1 (te same nazwy wejsc / wyjsc), potem definicja figury z polami HMI i mapowaniem
// wyjsc jak w FiguresGeometricSt.  Aplikacja nie symuluje frezowania - tylko wypelnia bufor jak PLC.
//
// Uwagi wspolne:
// - W PLC FB jest wolany co cykl przed CASE w FiguresGeometricSt, wejscia ustawiane w CASE - obliczenie z bEnable
//   wykonuje sie raz na swiezych wejsciach, wiec modyfikacja wejsc w FB (fLength := fLength - ...) liczy sie raz.
// - Czesc tablic (aRadius / aDepth / aStartDepth / aEndDepth) jest indeksowana przez CheckBounds z granicami
//   GLOBALNYCH tablic Radius / Depth z VisuNew [0..100] - zapisy i Clear trafiaja tylko w indeksy 0..100
//   (wieksze indeksy sa przycinane do 100).  Odwzorowane przez VISU_UB.
// - Tablice FB w PLC sa trwale; tu kazde wywolanie startuje od zer (jak po starcie PLC).

import { DEG, MILL, arrays, toBuffer } from './common.js';

const UB = 249;               // UPPER_BOUND tablic [0..249]
const VISU_UB = 100;          // UPPER_BOUND(Radius / Depth, 1) - globalne tablice VisuNew [0..100]
const cb = (i, lo, hi) => (i < lo ? lo : i > hi ? hi : i);   // CheckBounds
const idiv = (a, b) => Math.trunc(a / b);                       // dzielenie calkowite INT / DINT

// LREAL_TO_INT - zaokraglenie do najblizszej (polowki od zera; dla RoundUp tryb polowek nie ma znaczenia)
const lrealToInt = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

// RoundUp (Functions) - zaokraglenie w gore; brak przypisania wyniku = 0 (u nas tez dla Inf / NaN)
function roundUp(fInput) {
  if (!Number.isFinite(fInput)) return 0;
  const iInput = lrealToInt(fInput);
  const fInputDecimal = fInput - iInput;
  if (iInput >= fInput) return iInput;
  if (fInputDecimal !== 0) return iInput + 1;
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// GetRectangleCuttedPositions - prostokat ze scietymi (zaokraglonymi) narozami
export function getRectangleCuttedPositions(p) {
  const { aXPositions: X, aYPositions: Y, aRadius, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aIndex');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, fAngle, fRadius } = p;
  // fRadiusWorking to VAR FB - bez bBladeWidth zostaje poprzednia wartosc (tu: 0 jak po starcie)
  let fRadiusWorking = p.fRadiusWorking ?? 0;
  if (p.bBladeWidth) {
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; fRadiusWorking = fRadius - p.fParameterBladeWidth / 2; }
    else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; fRadiusWorking = fRadius + p.fParameterBladeWidth / 2; }
  }
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const p1x = sx; const p1y = sy;
  const p2x = sx + c * fLength; const p2y = sy + s * fLength;
  const p3x = sx + c * fLength - s * fWidth; const p3y = sy + s * fLength + c * fWidth;
  const p4x = sx - s * fWidth; const p4y = sy + c * fWidth;
  const rw = fRadiusWorking;
  const set = (i, x, y, a) => { X[i] = x; Y[i] = y; I[i] = a; };
  // uwaga PLC: punkty 1 i 9 (p1 + rw w Y) oraz 6 (+SIN w Y) nie uwzgledniaja obrotu fAngle poprawnie - jak w ST
  const body = (k) => {
    set(k + 1, p1x, p1y + rw, MILL.MillArcCCW);
    set(k + 2, p1x + c * rw, p1y + s * rw, MILL.Mill);
    set(k + 3, p2x - c * rw, p2y - s * rw, MILL.MillArcCCW);
    set(k + 4, p2x - s * rw, p2y + c * rw, MILL.Mill);
    set(k + 5, p3x + s * rw, p3y - c * rw, MILL.MillArcCCW);
    set(k + 6, p3x - c * rw, p3y + s * rw, MILL.Mill);
    set(k + 7, p4x + c * rw, p4y + s * rw, MILL.MillArcCCW);
    set(k + 8, p4x + s * rw, p4y - c * rw, MILL.Mill);
  };
  let iNumber;
  if (!p.bNewStartingPosition) {
    set(0, sx, sy, MILL.GoToPosition);
    body(0);
    set(9, p1x, p1y + rw, MILL.Nothing);
    iNumber = 9;
  } else {
    set(0, p.fNewStartingPositionX, p.fNewStartingPositionY, MILL.Mill);
    body(0);
    set(9, p1x, p1y + rw, MILL.Mill);
    set(10, p.fNewStartingPositionX, p.fNewStartingPositionY, MILL.Nothing);
    iNumber = 10;
  }
  // Tabela promieni: CheckBounds z granicami globalnej Radius [0..100] -> zapis tylko 0..100
  for (let i = 0; i <= UB; i++) aRadius[cb(i, 0, VISU_UB)] = rw;
  return { aXPositions: X, aYPositions: Y, aRadius, aIndex: I, iNumber };
}

export const RECTANGLE_CUTTED = {
  id: 'RECTANGLE_CUTTED', v: 40, name: 'Prostokąt z zaokrąglonymi narożami', kind: 'mill', plc: 'GetRectangleCuttedPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 600 },
    { k: 'radius', label: 'Promień naroża (fFigureRadius)', t: 'num', d: 50 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
  ],
  // FiguresGeometricSt, FigureType.RECTANGLE_CUTTED
  build(v, ctx) {
    const out = getRectangleCuttedPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fRadius: v.radius, fAngle: v.angle,
      bBladeWidth: true, iInner: ctx.internal, fParameterBladeWidth: ctx.millWidth,
      bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aRadius, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetHeartPositions - serce: czubek w punkcie startu, dwa luki gorne
export function getHeartPositions(p) {
  const { aXPositions: X, aYPositions: Y, aRadius: R, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fHeight } = p;
  // VAR FB - bez bBladeWidth zostaja poprzednie wartosci (tu: 0 jak po starcie)
  let fLengthWorking = p.fLengthWorking ?? 0;
  let fHeightWorking = p.fHeightWorking ?? 0;
  let fRadiusWorking2 = p.fRadiusWorking2 ?? 0;
  if (p.bBladeWidth) {
    if (p.iInner >= 1) { fLengthWorking = fLength - p.fParameterBladeWidth; fHeightWorking = fHeight - p.fParameterBladeWidth; }
    else { fLengthWorking = fLength + p.fParameterBladeWidth; fHeightWorking = fHeight + p.fParameterBladeWidth; }
    fRadiusWorking2 = fLengthWorking / 4;
  }
  const p1x = sx; const p1y = sy;
  const p2x = sx - fLengthWorking / 2; const p2y = sy + 3 * fHeightWorking / 4;
  const p3x = sx; const p3y = sy + 3 * fHeightWorking / 4;
  const p4x = sx + fLengthWorking / 2; const p4y = sy + 3 * fHeightWorking / 4;
  const fRadiusWorking1 = Math.sqrt((p2x - p1x) ** 2 + (p2y - p1y) ** 2);
  const set = (i, x, y, r, a) => { X[i] = x; Y[i] = y; R[i] = r; I[i] = a; };
  let iNumber;
  if (!p.bNewStartingPosition) {
    set(0, sx, sy, fRadiusWorking1, MILL.MillArcCW);
    set(1, p2x, p2y, fRadiusWorking2, MILL.MillArcCW);
    set(2, p3x, p3y, fRadiusWorking2, MILL.MillArcCW);
    set(3, p4x, p4y, fRadiusWorking1, MILL.MillArcCW);
    set(4, p1x, p1y, 0, MILL.Nothing);
    iNumber = 4;
  } else {
    set(0, p.fNewStartingPositionX, p.fNewStartingPositionY, 0, MILL.Mill);
    set(1, sx, sy, fRadiusWorking1, MILL.MillArcCW);
    set(2, p2x, p2y, fRadiusWorking2, MILL.MillArcCW);
    set(3, p3x, p3y, fRadiusWorking2, MILL.MillArcCW);
    set(4, p4x, p4y, fRadiusWorking1, MILL.MillArcCW);
    set(5, p1x, p1y, 0, MILL.Nothing);
    set(6, p.fNewStartingPositionX, p.fNewStartingPositionY, 0, MILL.Nothing);
    iNumber = 6;
  }
  return { aXPositions: X, aYPositions: Y, aRadius: R, aIndex: I, iNumber };
}

export const HEART = {
  id: 'HEART', v: 50, name: 'Serce', kind: 'mill', plc: 'GetHeartPositions',
  fields: [
    { k: 'xs', label: 'Start X - czubek (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y - czubek (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Szerokość (fFigureLength)', t: 'num', d: 400 },
    { k: 'height', label: 'Wysokość (fHeartHeightPart)', t: 'num', d: 500 },
  ],
  // FiguresGeometricSt, FigureType.HEART
  build(v, ctx) {
    const out = getHeartPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fHeight: v.height,
      bBladeWidth: true, iInner: ctx.internal, fParameterBladeWidth: ctx.millWidth,
      bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aRadius, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetRectangleCornersPositions - wiercenie naroznikow prostokata (bArc: po 2 otwory na naroze)
export function getRectangleCornersPositions(p) {
  const { aXPositions: X, aYPositions: Y, aDepth, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aDepth', 'aIndex');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, fAngle, fRadius } = p;
  let fRadiusWorking = p.fRadiusWorking ?? 0;   // VAR FB
  if (p.bBladeWidth) {
    // uwaga PLC: dla zewnetrznego tez fRadius - szer./2 (nie +)
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; fRadiusWorking = fRadius - p.fParameterBladeWidth / 2; }
    else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; fRadiusWorking = fRadius - p.fParameterBladeWidth / 2; }
  }
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const p1x = sx; const p1y = sy;
  const p2x = sx + c * fLength; const p2y = sy + s * fLength;
  const p3x = sx + c * fLength - s * fWidth; const p3y = sy + s * fLength + c * fWidth;
  const p4x = sx - s * fWidth; const p4y = sy + c * fWidth;
  // aDepth przez CheckBounds z granicami globalnej Depth [0..100] -> tylko 0..100
  for (let i = 0; i <= UB; i++) aDepth[cb(i, 0, VISU_UB)] = p.fDepth;
  const set = (i, x, y, a) => { X[i] = x; Y[i] = y; I[i] = a; };
  let iNumber;
  if (!p.bArc) {
    // uwaga PLC: Y punktow 0 i 4 liczone z fPoint1XPosition (blad w ST); tu promien bez kompensacji (fRadius)
    set(0, p1x, p1x + fRadius, MILL.Drilling);
    set(1, p2x - c * fRadius, p2y - s * fRadius, MILL.Drilling);
    set(2, p3x + s * fRadius, p3y - c * fRadius, MILL.Drilling);
    set(3, p4x + c * fRadius, p4y + s * fRadius, MILL.Drilling);
    set(4, p1x - s * fRadius, p1x + c * fRadius, MILL.Nothing);
    iNumber = 4;
  } else {
    const rw = fRadiusWorking;
    set(0, sx, sy, MILL.GoToPosition);
    set(1, p1x, p1y + rw, MILL.Drilling);
    set(2, p1x + c * rw, p1y + s * rw, MILL.Drilling);
    set(3, p2x - c * rw, p2y - s * rw, MILL.Drilling);
    set(4, p2x - s * rw, p2y + c * rw, MILL.Drilling);
    set(5, p3x + s * rw, p3y - c * rw, MILL.Drilling);
    set(6, p3x - c * rw, p3y + s * rw, MILL.Drilling);
    set(7, p4x + c * rw, p4y + s * rw, MILL.Drilling);
    set(8, p4x + s * rw, p4y - c * rw, MILL.Drilling);
    iNumber = 8;   // jak w PLC: ostatni punkt to Drilling, brak zamykajacego Nothing
  }
  return { aXPositions: X, aYPositions: Y, aDepth, aIndex: I, iNumber };
}

export const RECTANGLE_CORNERS = {
  id: 'RECTANGLE_CORNERS', v: 60, name: 'Naroża prostokąta (wiercenie)', kind: 'mill', plc: 'GetRectangleCornersPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 600 },
    { k: 'depth', label: 'Głębokość (fFigureDepth)', t: 'num', d: 20 },
    { k: 'radius', label: 'Promień naroża (fFigureRadius)', t: 'num', d: 30 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
    { k: 'arc', label: 'Po dwa otwory na naroże (bRectangleCornersArc)', t: 'bool', d: false },
  ],
  // FiguresGeometricSt, FigureType.RECTANGLE_CORNERS
  build(v, ctx) {
    const out = getRectangleCornersPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fDepth: v.depth,
      fRadius: v.radius, fAngle: v.angle, bArc: v.arc,
      bBladeWidth: true, iInner: ctx.internal, fParameterBladeWidth: ctx.millWidth,
      fParameterZMoveAboveMaterial: ctx.zAbove,   // w FB nieuzywane
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aDepth -> aFigureDepthStart, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, depth: out.aDepth }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetHolesPositions - 4 otwory w rogach prostokata
export function getHolesPositions(p) {
  const { aXPositions: X, aYPositions: Y, aDepth, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aDepth', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy } = p;
  // bBladeWidth / iInner / fParameterBladeWidth zakomentowane w ST - tylko odjecie przesuniec
  const fLength = p.fLength - 2 * p.fShiftX;
  const fWidth = p.fWidth - 2 * p.fShiftY;
  for (let i = 0; i <= UB; i++) aDepth[cb(i, 0, VISU_UB)] = p.fDepth;
  // uwaga PLC: pierwszy otwor w punkcie startu (bez + fShiftX/Y), skraca sie tylko rozstaw
  const set = (i, x, y) => { X[i] = x; Y[i] = y; I[i] = MILL.Drilling; };
  set(0, sx, sy);
  set(1, sx + fLength, sy);
  set(2, sx + fLength, sy + fWidth);
  set(3, sx, sy + fWidth);
  return { aXPositions: X, aYPositions: Y, aDepth, aIndex: I, iNumber: 3 };
}

export const HOLES = {
  id: 'HOLES', v: 70, name: 'Otwory', kind: 'mill', plc: 'GetHolesPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 600 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 400 },
    { k: 'depth', label: 'Głębokość (fFigureDepth)', t: 'num', d: 30 },
    { k: 'shiftX', label: 'Odsunięcie X (fHolesShiftX)', t: 'num', d: 50 },
    { k: 'shiftY', label: 'Odsunięcie Y (fHolesShiftY)', t: 'num', d: 50 },
  ],
  // FiguresGeometricSt, FigureType.HOLES
  build(v, ctx) {
    const out = getHolesPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fDepth: v.depth,
      fShiftX: v.shiftX, fShiftY: v.shiftY,
      bBladeWidth: true, iInner: 1, fParameterBladeWidth: ctx.millWidth, fParameterZMoveAboveMaterial: ctx.zAbove,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aDepth -> aFigureDepthStart, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, depth: out.aDepth }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetSinkDrainerPositions - ociekacz: linie wzdluz X ze spadkiem (MillSlopeDown/Up), skok fJump w Y
export function getSinkDrainerPositions(p) {
  const { aXPositions: X, aYPositions: Y, aStartDepth, aEndDepth, aAngle, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aStartDepth', 'aEndDepth', 'aAngle', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fStartDepth, fLength, fWidth, fJump } = p;
  let { fAngle, fEndDepth } = p;
  if (p.bTwoDepths) {
    fAngle = fEndDepth !== fStartDepth ? Math.atan((fEndDepth - fStartDepth) / fLength) * 180 / Math.PI : 0;
  } else {
    // uwaga PLC: koniec = TAN(kat) * dlugosc, bez dodania fStartDepth
    fEndDepth = fAngle > 0 ? Math.tan(fAngle * DEG) * fLength : 0;
  }
  const iNumber = roundUp(fWidth / fJump) * 2 - 1;
  const d = (i) => cb(i, 0, VISU_UB);   // aStartDepth / aEndDepth przez granice globalnej Depth [0..100]
  for (let i = 0; i <= iNumber; i++) {
    if (iNumber > UB) break;   // bAlarmIndexOutOfBounds - EXIT
    const k = cb(i, 0, UB);
    X[k] = (i % 4 === 0 || i % 4 === 3) ? sx : sx + fLength;
    Y[k] = sy + fJump * idiv(i, 2);   // galaz ELSE (i > iNumber) w ST nieosiagalna
    if (i % 4 === 0) {
      aStartDepth[d(i)] = fStartDepth; aEndDepth[d(i)] = fEndDepth;
      I[k] = fStartDepth <= fEndDepth ? MILL.MillSlopeDown : MILL.MillSlopeUp;
    } else if (i % 4 === 1) {
      aStartDepth[d(i)] = fEndDepth; aEndDepth[d(i)] = fEndDepth;
      I[k] = MILL.GoToPositionWithoutZ;
    } else if (i % 4 === 2) {
      aStartDepth[d(i)] = fStartDepth; aEndDepth[d(i)] = fEndDepth;
      I[k] = fStartDepth <= fEndDepth ? MILL.MillSlopeUp : MILL.MillSlopeDown;
    } else {
      aStartDepth[d(i)] = fStartDepth; aEndDepth[d(i)] = fStartDepth;
      I[k] = MILL.GoToPositionWithoutZ;
    }
    aAngle[i] = fAngle;
  }
  return { aXPositions: X, aYPositions: Y, aStartDepth, aEndDepth, aAngle, aIndex: I, iNumber };
}

export const SINK_DRAINER = {
  id: 'SINK_DRAINER', v: 90, name: 'Ociekacz', kind: 'mill', plc: 'GetSinkDrainerPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 400 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 300 },
    { k: 'jump', label: 'Skok rowków (fSinkDrainerJump)', t: 'num', d: 20 },
    { k: 'twoDepths', label: 'Dwie głębokości (bSinkDrainerTwoDepths)', t: 'bool', d: true },
    { k: 'startDepth', label: 'Głębokość początkowa (fSinkDrainerStartDepth)', t: 'num', d: 2 },
    { k: 'endDepth', label: 'Głębokość końcowa (fSinkDrainerEndDepth)', t: 'num', d: 8, show: (v) => v.twoDepths },
    { k: 'angle', label: 'Kąt spadku [°] (fFigureAngle)', t: 'num', d: 1, show: (v) => !v.twoDepths },
  ],
  // FiguresGeometricSt, FigureType.SINK_DRAINER (bez szerokosci frezu)
  build(v, ctx) {
    const out = getSinkDrainerPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fAngle: v.angle,
      fStartDepth: v.startDepth, fEndDepth: v.endDepth, fJump: v.jump, bTwoDepths: v.twoDepths,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aStartDepth, aEndDepth, aAngle, iNumber
    return toBuffer({
      x: out.aXPositions, y: out.aYPositions, step: out.aIndex, depth: out.aStartDepth, depthEnd: out.aEndDepth, angle: out.aAngle,
    }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetElipse - elipsa jednym punktem (ElipseOuter/Inner), dla fLength = fWidth okrag (CircleTopPoint)
export function getElipse(p) {
  const A = arrays('aXPositions', 'aYPositions', 'aRadius', 'aLength', 'aWidth', 'aIndex');
  const { aXPositions: X, aYPositions: Y, aRadius: R, aLength, aWidth, aIndex: I } = A;
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fWidth } = p;
  const k = (j) => cb(j, 0, UB);
  let j;
  if (!p.bNewStartingPosition) {
    j = 0;
  } else {
    X[0] = p.fNewStartingPositionX; Y[0] = p.fNewStartingPositionY; I[0] = MILL.Mill;
    j = 1;
  }
  if (fLength !== fWidth) {
    X[k(j)] = sx; Y[k(j)] = sy;
    aLength[j] = fLength; aWidth[j] = fWidth;
    I[k(j)] = p.iInner >= 1 ? MILL.ElipseInner : MILL.ElipseOuter;
    j += 1;
  } else {
    const cx = p.bTop ? sx : sx + fLength / 2;
    const cy = p.bTop ? sy : sy + fWidth / 2;
    X[k(j)] = cx; Y[k(j)] = cy; R[k(j)] = Math.max(fLength / 2, fWidth / 2);
    I[k(j)] = p.iInner >= 1 ? MILL.CircleTopPointInner : MILL.CircleTopPointOuter;
    j += 1;
    X[k(j)] = cx; Y[k(j)] = cy; R[k(j)] = Math.max(fLength / 2, fWidth / 2);
  }
  // (bProgramReapitingOver := FALSE - zmienna globalna, pominieta)
  if (p.bNewStartingPosition) {
    // uwaga PLC: pozycja w [j+1], a krok Mill w [j] - dla elipsy wiersz j zostaje (0, 0) z krokiem Mill
    X[j + 1] = p.fNewStartingPositionX; Y[j + 1] = p.fNewStartingPositionY;
    I[k(j)] = MILL.Mill;
  }
  j += 1;
  return { aXPositions: X, aYPositions: Y, aRadius: R, aLength, aWidth, aIndex: I, iNumber: j };
}

const ELIPSE_FIELDS = [
  { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
  { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
  { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 600 },
  { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 400 },
];

// wejscia GetElipse_0 jak w FiguresGeometricSt (bTop nieustawiane - FALSE, brak szerokosci frezu)
const elipseInputs = (v, ctx) => ({
  fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, iInner: ctx.internal,
  bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
  bTop: false,
});

export const ELIPSE_ONE_POINT = {
  id: 'ELIPSE_ONE_POINT', v: 110, name: 'Elipsa (jeden punkt)', kind: 'mill', plc: 'GetElipse',
  fields: ELIPSE_FIELDS.map((f) => ({ ...f })),
  // FiguresGeometricSt, FigureType.ELIPSE_ONE_POINT
  build(v, ctx) {
    const out = getElipse(elipseInputs(v, ctx));
    // przepisywane: aIndex, aXPositions, aYPositions, aRadius, aLength, aWidth -> aFigureAngle (!), iNumber
    return toBuffer({
      x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius, length: out.aLength, angle: out.aWidth,
    }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetElipsePositions - elipsa z iNumber (120) punktow lukami MillArcCW
export function getElipsePositions(p) {
  const { aXPositions: X, aYPositions: Y, aRadius: R, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aIndex');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, iNumber } = p;
  if (p.bBladeWidth) {
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; }
    else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; }
  }
  const a = fLength / 2;
  const b = fWidth / 2;
  const n6 = idiv(iNumber, 6);
  const n12 = idiv(iNumber, 12);
  const K = idiv(10 * 20, 19);   // w ST stala 10*20/19 liczona na INT = 10 (nie 10.53)
  const C = 0.55555555555555555555;
  const k = (j) => cb(j, 0, UB);
  let j = 0;
  let iElipseNumber;
  if (!p.bNewStartingPosition) {
    j = 0; iElipseNumber = iNumber;
  } else {
    X[0] = p.fNewStartingPositionX; Y[0] = p.fNewStartingPositionY; I[0] = MILL.Mill;
    j = 1; iElipseNumber = iNumber + 1;
  }
  const rmax = Math.max(fLength, fWidth);   // uwaga PLC: aRadius = MAX(fLength, fWidth), nie polos
  const yOf = (x) => Math.sqrt((1 - x ** 2 / a ** 2) * b ** 2);
  const put = (x, y, step) => { const q = k(j); X[q] = a + x + sx; Y[q] = y + sy; R[q] = rmax; I[q] = step; };
  // jeden odcinek petli: from..to, x(i), znak y, wartosc y dla |x| > |a|, ostatni odcinek (Nothing, bez j+1);
  // x wspolne (VAR FB) - pusta petla zostawia poprzednie x, jak lastPoint := x w ST
  let x = 0;
  const seg = (from, to, xOf, sign, yOut, last = false) => {
    for (let i = from; i <= to; i++) {
      x = xOf(i);
      const y = Math.abs(x) > Math.abs(a) ? yOut : sign * yOf(x);
      put(x, y, last && i === to ? MILL.Nothing : MILL.MillArcCW);
      if (!last || i < to) j += 1;
    }
    return x;
  };
  if (a > b) {
    // uwaga PLC: w pierwszej petli dla |x| > |a| y := a (w pozostalych 0)
    let lp = seg(0, n6, (i) => -a + i * a / (10 * n6), 1, a);
    lp = seg(1, n6, (i) => lp + i * a / (C * n6), 1, 0);
    lp = seg(1, n6, (i) => lp + i * a / (K * n6), 1, 0);
    lp = seg(1, n6, (i) => a - i * a / (10 * n6), -1, 0);
    lp = seg(1, n6, (i) => lp - i * a / (C * n6), -1, 0);
    seg(1, n6, (i) => lp - i * a / (K * n6), -1, 0, true);
  } else if (a < b) {
    let lp = seg(0, n12, (i) => -a + i * a / (C * n6), 1, 0);
    lp = seg(1, n6, (i) => lp + i * a / (10 * n6), 1, 0);
    lp = seg(1, n6, (i) => lp + i * a / (K * n6), 1, 0);
    seg(1, n12, (i) => lp + i * a / (C * n6), 1, 0);
    // (w ST brak lastPoint := x przed dolna polowka - zaczyna od x := a - n)
    lp = seg(1, n12, (i) => a - i * a / (C * n6), -1, 0);
    lp = seg(1, n6, (i) => lp - i * a / (10 * n6), -1, 0);
    lp = seg(1, n6, (i) => lp - i * a / (K * n6), -1, 0);
    seg(1, n12, (i) => lp - i * a / (C * n6), -1, 0, true);
  } else {
    // a = b: okrag (dwa punkty CircleTopPoint)
    const cx = p.bTop ? sx : sx + fLength / 2;
    const cy = p.bTop ? sy : sy + fWidth / 2;
    X[j] = cx; Y[k(j)] = cy; R[k(j)] = Math.max(fLength / 2, fWidth / 2);
    I[k(j)] = p.iInner >= 1 ? MILL.CircleTopPointInner : MILL.CircleTopPointOuter;
    j += 1;
    X[j] = cx; Y[k(j)] = cy; R[k(j)] = Math.max(fLength / 2, fWidth / 2);
    iElipseNumber = j;   // nadpisywane nizej (bez nowego startu = iNumber)
  }
  // Od gory (bTop): pierwsza cwiartka na koniec, przesuniecie calosci o 30, potem -a / -b (tylko pozycje <> 0)
  if (p.bTop && a !== b) {
    for (let i = 0; i <= 30; i++) { X[i + 120] = X[i]; Y[i + 120] = Y[i]; R[i + 120] = R[i]; I[i + 120] = I[i]; }
    for (let i = 0; i <= 120; i++) {
      X[i] = X[i + 30]; Y[i] = Y[i + 30]; R[i] = R[i + 30]; I[i] = I[i + 30];
      X[i + 30] = 0; Y[i + 30] = 0; R[i + 30] = 0; I[i + 30] = 0;
    }
    for (let i = 0; i <= UB; i++) {
      if (X[i] !== 0) X[i] -= a;
      if (Y[i] !== 0) Y[i] -= b;
    }
  }
  if (p.bReverse) {
    // odwrocenie kierunku; tmpX / tmpY / tmpR sa REAL w ST (utrata precyzji)
    j = iNumber;
    for (let i = 0; i <= idiv(iNumber, 2); i++) {
      let t = Math.fround(X[i]); X[i] = X[j]; X[j] = t;
      t = Math.fround(Y[i]); Y[i] = Y[j]; Y[j] = t;
      t = Math.fround(R[i]); R[i] = R[j]; R[j] = t;
      t = I[i]; I[i] = I[j]; I[j] = t;
      j -= 1;
    }
  }
  if (!p.bNewStartingPosition) {
    iElipseNumber = iNumber;
  } else {
    X[j + 1] = p.fNewStartingPositionX; Y[j + 1] = p.fNewStartingPositionY;
    I[k(j)] = MILL.Mill;
    iElipseNumber += 1;
  }
  return { aXPositions: X, aYPositions: Y, aRadius: R, aIndex: I, iElipseNumber };
}

export const ELIPSE_120_POINT = {
  id: 'ELIPSE_120_POINT', v: 120, name: 'Elipsa (120 punktów)', kind: 'mill', plc: 'GetElipsePositions',
  fields: ELIPSE_FIELDS.map((f) => ({ ...f })),
  // FiguresGeometricSt, FigureType.ELIPSE_120_POINT
  build(v, ctx) {
    const out = getElipsePositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, iInner: ctx.internal,
      iNumber: 120, bBladeWidth: true, fParameterBladeWidth: ctx.millWidth,
      bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
      bTop: ctx.machineNumber === 19, bReverse: false,
    });
    // uwaga PLC: aFigureRadius := GetElipse_0.aRadius - INNA instancja (ELIPSE_ONE_POINT); w PLC zostaje to, co
    // GetElipse_0 policzyl ostatnio.  Tu: GetElipse dla tych samych pol (dla elipsy a <> b to same zera).
    const one = getElipse(elipseInputs(v, ctx));
    // przepisywane: aIndex, aXPositions, aYPositions (GetElipsePositions_0), aRadius (GetElipse_0), iElipseNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: one.aRadius }, out.iElipseNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetMillTablePositions - planowanie stolu: linie wzdluz X co (szer. frezu - 2) w Y
export function getMillTablePositions(p) {
  const { aXPositions: X, aYPositions: Y, aIndex: I, aDepth } = arrays('aXPositions', 'aYPositions', 'aIndex', 'aDepth');
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fWidth, fDepth } = p;
  const fJump = p.fParameterBladeWidth - 2;
  let iNumber = roundUp(fWidth / fJump) * 2;
  const k = (i) => cb(i, 0, UB);
  let i = 0;
  // FOR i := 0 TO iNumber - po normalnym zakonczeniu i = iNumber + 1, po EXIT i = 0
  for (i = 0; i <= iNumber; i++) {
    if (iNumber > UB) break;   // bAlarmIndexOutOfBounds - EXIT
    X[k(i)] = (i % 4 === 0 || i % 4 === 3) ? sx : sx + fLength;
    if (i < iNumber) {
      Y[k(i)] = sy + fJump * idiv(i, 2);
    } else {
      Y[k(i)] = sy + fWidth;
      Y[k(i + 1)] = sy + fWidth;
    }
    I[k(i)] = (i % 4 === 0 || i % 4 === 2) ? MILL.MillWithoutZ : MILL.GoToPositionWithoutZ;
    aDepth[cb(i, 0, VISU_UB)] = fDepth;   // granice globalnej Depth [0..100]
  }
  iNumber += 3;
  // uwaga PLC: po petli i = iNumber + 1 -> X[i] nie byl zapisany (0), wiec X[i+1] = 0 (a nie sx / sx + fLength);
  // GoToPosition trafia w wiersz i, wiersze i+1 i i+2 zostaja Nothing
  X[k(i + 1)] = X[k(i)];
  Y[k(i + 1)] = Y[k(i)];
  I[k(i)] = MILL.GoToPosition;
  return { aXPositions: X, aYPositions: Y, aIndex: I, aDepth, iNumber };
}

export const MILL_TABLE = {
  id: 'MILL_TABLE', v: 160, name: 'Planowanie stołu', kind: 'mill', plc: 'GetMillTablePositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 300 },
    { k: 'depth', label: 'Głębokość (fFigureDepth)', t: 'num', d: 2 },
  ],
  // FiguresGeometricSt, FigureType.MILL_TABLE
  build(v, ctx) {
    const out = getMillTablePositions({
      bBladeWidth: false,   // nieustawiane, w FB nieuzywane
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fDepth: v.depth,
      fParameterBladeWidth: ctx.millWidth,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aDepth -> aFigureDepthStart, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, depth: out.aDepth }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetLCornersPositions - naroza w ksztalcie L (ramiona fHeight) w 4 rogach prostokata
export function getLCornersPositions(p) {
  const { aXPositions: X, aYPositions: Y, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aIndex');
  let { fLength, fWidth, fHeight } = p;
  const { fStartXPosition: sx, fStartYPosition: sy } = p;
  const fAngle = p.fAngle ?? 0;   // w FiguresGeometricSt nieustawiane - 0
  if (p.bBladeWidth) {
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; }
    else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; }
  }
  fHeight -= p.fParameterBladeWidth / 2;
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const p1x = sx; const p1y = sy;
  const p2x = sx + c * fLength; const p2y = sy + s * fLength;
  const p3x = sx + c * fLength - s * fWidth; const p3y = sy + s * fLength + c * fWidth;
  const p4x = sx - s * fWidth; const p4y = sy + c * fWidth;
  const set = (i, x, y, a) => { X[i] = x; Y[i] = y; I[i] = a; };
  const corners = (o) => {
    set(o + 0, p1x, p1y, MILL.Mill);
    set(o + 1, p1x, p1y + fHeight, MILL.GoToPosition);
    set(o + 2, p1x, p1y, MILL.Mill);
    set(o + 3, p1x + fHeight, p1y, MILL.GoToPosition);
    set(o + 4, p2x, p2y, MILL.Mill);
    set(o + 5, p2x - fHeight, p2y, MILL.GoToPosition);
    set(o + 6, p2x, p2y, MILL.Mill);
    set(o + 7, p2x, p2y + fHeight, MILL.GoToPosition);
    set(o + 8, p3x, p3y, MILL.Mill);
    set(o + 9, p3x, p3y - fHeight, MILL.GoToPosition);
    set(o + 10, p3x, p3y, MILL.Mill);
    set(o + 11, p3x - fHeight, p3y, MILL.GoToPosition);
    set(o + 12, p4x, p4y, MILL.Mill);
    set(o + 13, p4x + fHeight, p4y, MILL.GoToPosition);
    set(o + 14, p4x, p4y, MILL.Mill);
    set(o + 15, p4x, p4y - fHeight, MILL.Nothing);
  };
  let iNumber;
  if (!p.bNewStartingPosition) {
    corners(0);
    iNumber = 16;   // uwaga PLC: o 1 za duzo - wiersz 16 to (0, 0) Nothing
  } else {
    corners(1);
    // uwaga PLC: Y[0] := fNewStartingPositionX (X zamiast Y), a aIndex[0] nieustawiony (Nothing) - w ST aIndex[1] 2x
    X[0] = p.fNewStartingPositionX; Y[0] = p.fNewStartingPositionX;
    iNumber = 17;
  }
  return { aXPositions: X, aYPositions: Y, aIndex: I, iNumber };
}

export const L_CORNERS = {
  id: 'L_CORNERS', v: 180, name: 'Naroża L', kind: 'mill', plc: 'GetLCornersPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 600 },
    { k: 'height', label: 'Długość ramienia L (fFigureHeight)', t: 'num', d: 100 },
  ],
  // FiguresGeometricSt, FigureType.L_CORNERS
  build(v, ctx) {
    const out = getLCornersPositions({
      bBladeWidth: true, fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fHeight: v.height,
      fParameterBladeWidth: ctx.millWidth, fAngle: 0, iInner: ctx.internal,
      bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// GetInductionPositions - otwor pod plyte indukcyjna: prostokat wewn., zmiana glebokosci, ramka odsunieta o fAdditionalDistance
export function getInductionPositions(p) {
  const { aXPositions: X, aYPositions: Y, aDepth, aIndex: I } = arrays('aXPositions', 'aYPositions', 'aDepth', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fAdditionalDistance: ad } = p;
  const fLength = p.fLength - p.fParameterBladeWidth;
  const fWidth = p.fWidth - p.fParameterBladeWidth;
  const iAction = MILL.Mill;   // w ST iAction : ProgramCutStep := ProgramMillStep.Mill (= 1)
  const fAngle = 0;            // VAR fAngle : REAL := 0
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const set = (i, x, y, a) => { X[i] = x; Y[i] = y; I[i] = a; };
  const rect = (o) => {
    set(o + 0, sx, sy, iAction);
    set(o + 1, sx + c * fLength, sy + s * fLength, iAction);
    set(o + 2, sx + c * fLength - s * fWidth, sy + s * fLength + c * fWidth, iAction);
    set(o + 3, sx - s * fWidth, sy + c * fWidth, iAction);
  };
  const frame = (o) => {
    set(o + 0, sx - ad, sy - ad, iAction);
    set(o + 1, sx + c * fLength + ad, sy + s * fLength - ad, iAction);
    set(o + 2, sx + c * fLength - s * fWidth + ad, sy + s * fLength + c * fWidth + ad, iAction);
    set(o + 3, sx - s * fWidth - ad, sy + c * fWidth + ad, iAction);
    set(o + 4, sx - ad, sy - ad, iAction);
  };
  let iNumber;
  // kroki GoToPosition / ChangeDepth / Nothing z ProgramCutStep - te same wartosci co w ProgramMillStep
  if (!p.bNewStartingPosition) {
    rect(0);
    set(4, sx, sy, MILL.GoToPosition);
    set(5, sx, sy, MILL.ChangeDepth);
    frame(6);
    I[10] = MILL.Nothing;
    iNumber = 10;
  } else {
    const nx = p.fNewStartingPositionX; const ny = p.fNewStartingPositionY;
    set(0, nx, ny, iAction);
    rect(1);
    set(5, sx, sy, iAction);
    set(6, nx, ny, MILL.GoToPosition);
    set(7, nx, ny, MILL.ChangeDepth);
    set(8, nx, ny, iAction);
    frame(9);
    set(14, nx, ny, MILL.Nothing);
    iNumber = 14;
  }
  for (let i = 0; i <= UB; i++) aDepth[i] = p.fDepth;   // tu granice wlasnej aDepth - cala tablica
  return { aXPositions: X, aYPositions: Y, aDepth, aIndex: I, iNumber };
}

export const INDUCTION = {
  id: 'INDUCTION', v: 230, name: 'Indukcja', kind: 'mill', plc: 'GetInductionPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 560 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 490 },
    { k: 'depth', label: 'Głębokość (fFigureDepth)', t: 'num', d: 10 },
    { k: 'angle', label: 'Odsunięcie ramki (fFigureAngle)', t: 'num', d: 20 },
  ],
  // FiguresGeometricSt, FigureType.INDUCTION (fAdditionalDistance := fFigureAngle)
  build(v, ctx) {
    const out = getInductionPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fDepth: v.depth,
      fAdditionalDistance: v.angle, fParameterBladeWidth: ctx.millWidth,
      bNewStartingPosition: ctx.newStart, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
    });
    // przepisywane: aIndex, aXPositions, aYPositions, aDepth -> aFigureDepthStart, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, depth: out.aDepth }, out.iNumber);
  },
};

// w kolejnosci FigureType
export const FIGURES_C = [
  RECTANGLE_CUTTED, HEART, RECTANGLE_CORNERS, HOLES, SINK_DRAINER, ELIPSE_ONE_POINT, ELIPSE_120_POINT, MILL_TABLE, L_CORNERS, INDUCTION,
];
