// Figury grupy A: trojkaty, trapezy, krzyz, wielokat (PLC: FiguresGeometric/Functions/Get*Positions).
// Funkcje 1:1 z FB (te same nazwy wejsc), potem definicje figur z polami HMI i mapowaniem wyjsc jak w
// FiguresGeometricSt. Dziwne miejsca PLC sa zachowane i opisane (PLC: ...).

import { DEG, CUT, MILL, arrays, toBuffer } from './common.js';

// GetSign (Settings/GetSign): TRUE -> -1, FALSE -> 1
const getSign = (b) => (b ? -1 : 1);

// Korekta szerokosci tarczy - blok IF bBladeWidth identyczny w GetTriangleRect/Equal/IsosPositions
function triangleBladeWidth(p, aXPositions, aYPositions) {
  if (!p.bBladeWidth) return;
  const c = Math.cos(p.fAngle * DEG);
  const s = Math.sin(p.fAngle * DEG);
  const bw = p.fParameterBladeWidth;
  const k = p.iInner >= 1 ? -1 : 1;   // wewn.: odejmowanie, zewn.: dodawanie
  if (p.bAdditional) {
    aXPositions[1] += k * c * bw; aYPositions[1] += k * s * bw;
    aXPositions[2] += k * c * bw; aYPositions[2] += k * s * bw;
    aXPositions[3] -= k * s * bw; aYPositions[3] += k * c * bw;
    aXPositions[4] -= k * s * bw; aYPositions[4] += k * c * bw;
  } else {
    aXPositions[1] += k * c * bw; aYPositions[1] += k * s * bw;
    // PLC: wierzcholek przesuwany prostopadle do podstawy (nie wzdluz boku)
    aXPositions[2] -= k * s * bw; aYPositions[2] += k * c * bw;
  }
}

// GetTriangleRectPositions - p: {bBladeWidth, fStartXPosition, fStartYPosition, fBase, fHeight, fAngle, bAdditional,
// fAdditionalDistance, fParameterBladeWidth, iInner}; zwraca {aXPositions, aYPositions, aIndex, iNumber}
export function getTriangleRectPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fBase, fHeight, fAngle, fAdditionalDistance: ad } = p;
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  let iNumber;
  if (p.bAdditional) {
    const fTriangleAngle = Math.atan(fHeight / fBase) * 180 / Math.PI;
    const ct = Math.cos((fAngle - fTriangleAngle) * DEG);
    const st = Math.sin((fAngle - fTriangleAngle) * DEG);
    aXPositions[0] = sx - c * ad; aYPositions[0] = sy - s * ad; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase + c * ad; aYPositions[1] = sy + s * fBase + s * ad;
    aIndex[3] = CUT.GoToPosition;   // PLC (linia 41): aIndex[3] zamiast aIndex[1] - aIndex[1] zostaje Nothing (0)
    aXPositions[2] = sx + c * fBase + ct * ad; aYPositions[2] = sy + s * fBase - st * ad; aIndex[2] = CUT.Cut;
    aXPositions[3] = sx - s * fHeight - ct * ad; aYPositions[3] = sy + c * fHeight + st * ad; aIndex[3] = CUT.GoToPosition;
    aXPositions[4] = sx - s * fHeight - s * ad; aYPositions[4] = sy + c * fHeight + c * ad; aIndex[4] = CUT.Cut;
    aXPositions[5] = sx + s * ad; aYPositions[5] = sy - c * ad; aIndex[5] = CUT.Nothing;
    iNumber = 5;
  } else {
    aXPositions[0] = sx; aYPositions[0] = sy; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase; aYPositions[1] = sy + s * fBase; aIndex[1] = CUT.Cut;
    aXPositions[2] = sx - s * fHeight; aYPositions[2] = sy + c * fHeight; aIndex[2] = CUT.Cut;
    aXPositions[3] = sx; aYPositions[3] = sy; aIndex[3] = CUT.Nothing;
    aIndex[4] = CUT.Nothing; aIndex[5] = CUT.Nothing;
    iNumber = 3;
  }
  triangleBladeWidth(p, aXPositions, aYPositions);
  return { aXPositions, aYPositions, aIndex, iNumber };
}

// GetTriangleEqualPositions - p: jak w GetTriangleRectPositions bez fHeight (liczona: SQRT(3)/2*fBase)
export function getTriangleEqualPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fBase, fAngle, fAdditionalDistance: ad } = p;
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const fHeight = Math.sqrt(3) / 2 * fBase;
  const hx = sx + c * fBase / 2;   // fPointHalfBaseX
  const hy = sy + s * fBase / 2;   // fPointHalfBaseY
  let iNumber;
  if (p.bAdditional) {
    const fTriangleAngle = 60;
    const ct = Math.cos((fAngle - fTriangleAngle) * DEG);
    const st = Math.sin((fAngle - fTriangleAngle) * DEG);
    const a5 = (90 - fTriangleAngle - fAngle) * DEG;
    aXPositions[0] = sx - c * ad; aYPositions[0] = sy - s * ad; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase + c * ad; aYPositions[1] = sy + s * fBase + s * ad; aIndex[1] = CUT.GoToPosition;
    aXPositions[2] = sx + c * fBase + ct * ad; aYPositions[2] = sy + s * fBase - st * ad; aIndex[2] = CUT.Cut;
    aXPositions[3] = hx - s * fHeight - c * ad; aYPositions[3] = hy + c * fHeight + s * ad; aIndex[3] = CUT.GoToPosition;
    aXPositions[4] = hx - s * fHeight + st * ad; aYPositions[4] = hy + c * fHeight - ct * ad; aIndex[4] = CUT.Cut;
    aXPositions[5] = sx - Math.sin(a5) * ad; aYPositions[5] = sy - Math.cos(a5) * ad; aIndex[5] = CUT.Nothing;
    iNumber = 5;
  } else {
    aXPositions[0] = sx; aYPositions[0] = sy; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase; aYPositions[1] = sy + s * fBase; aIndex[1] = CUT.Cut;
    aXPositions[2] = hx - s * fHeight; aYPositions[2] = hy + c * fHeight; aIndex[2] = CUT.Cut;
    aXPositions[3] = sx; aYPositions[3] = sy; aIndex[3] = CUT.Nothing;
    aIndex[4] = CUT.Nothing; aIndex[5] = CUT.Nothing;
    iNumber = 3;
  }
  triangleBladeWidth(p, aXPositions, aYPositions);
  return { aXPositions, aYPositions, aIndex, iNumber };
}

// GetTriangleIsosPositions - p: jak w GetTriangleRectPositions
export function getTriangleIsosPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fBase, fHeight, fAngle, fAdditionalDistance: ad } = p;
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const hx = sx + c * fBase / 2;
  const hy = sy + s * fBase / 2;
  let iNumber;
  if (p.bAdditional) {
    // PLC: ASIN(fHeight/(fBase/2)) - dla fHeight > fBase/2 poza dziedzina (NaN, takze przy fAdditionalDistance = 0)
    const fTriangleAngle = Math.asin(fHeight / (fBase / 2)) * 180 / Math.PI;
    const ct = Math.cos((fAngle - fTriangleAngle) * DEG);
    const st = Math.sin((fAngle - fTriangleAngle) * DEG);
    const a5 = (90 - fTriangleAngle - fAngle) * DEG;
    aXPositions[0] = sx - c * ad; aYPositions[0] = sy - s * ad; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase + c * ad; aYPositions[1] = sy + s * fBase + s * ad; aIndex[1] = CUT.GoToPosition;
    aXPositions[2] = sx + c * fBase + ct * ad; aYPositions[2] = sy + s * fBase - st * ad; aIndex[2] = CUT.Cut;
    aXPositions[3] = hx - s * fHeight - c * ad; aYPositions[3] = hy + c * fHeight + s * ad;
    aIndex[1] = CUT.GoToPosition;   // PLC (linia 50): aIndex[1] zamiast aIndex[3] - aIndex[3] zostaje Nothing (0)
    aXPositions[4] = hx - s * fHeight + st * ad; aYPositions[4] = hy + c * fHeight - ct * ad; aIndex[4] = CUT.Cut;
    aXPositions[5] = sx - Math.sin(a5) * ad; aYPositions[5] = sy - Math.cos(a5) * ad; aIndex[5] = CUT.Nothing;
    iNumber = 5;
  } else {
    aXPositions[0] = sx; aYPositions[0] = sy; aIndex[0] = CUT.Cut;
    aXPositions[1] = sx + c * fBase; aYPositions[1] = sy + s * fBase; aIndex[1] = CUT.Cut;
    aXPositions[2] = hx - s * fHeight; aYPositions[2] = hy + c * fHeight; aIndex[2] = CUT.Cut;
    aXPositions[3] = sx; aYPositions[3] = sy; aIndex[3] = CUT.Nothing;
    aIndex[4] = CUT.Nothing; aIndex[5] = CUT.Nothing;
    iNumber = 3;
  }
  triangleBladeWidth(p, aXPositions, aYPositions);
  return { aXPositions, aYPositions, aIndex, iNumber };
}

// TrapezoidType (PLC)
export const TRAPEZOID_TYPE = {
  Isosceles: 0, RectangularLeft: 1, RectangularRight: 2, IsoscelesSide1: 3, IsoscelesSide2: 4,
  RectangularLeftSide: 5, RectangularRightSide: 6,
};

// GetTrapezoidPositions - p: {bBladeWidth, fStartXPosition, fStartYPosition, fLength, fWidth, fHeight, bAdditional,
// fAdditionalDistance, fParameterBladeWidth, iInner, iTrapezoidType, bHalf}; g: {bServiceBlocksReverse}.
// bBladeWidth / bAdditional / fAdditionalDistance w PLC bez wplywu (fParameterBladeWidth := fParameterBladeWidth).
export function getTrapezoidPositions(p, g) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fWidth, fHeight, fParameterBladeWidth: bw } = p;
  let iAction; let iAction2; let bInner;
  if (p.iInner >= 1) {
    iAction = CUT.CutInnerFull; iAction2 = g.bServiceBlocksReverse ? CUT.CutInnerReverse : CUT.CutInnerFull; bInner = true;
  } else {
    iAction = CUT.Cut; iAction2 = g.bServiceBlocksReverse ? CUT.CutReverse : CUT.Cut; bInner = false;
  }
  const sg = getSign(bInner);
  const set = (i, x, y) => { aXPositions[i] = x; aYPositions[i] = y; };
  set(0, sx, sy); aIndex[0] = iAction;
  let iNumber = 0;   // iNumber nieustawiany poza CASE (dla nieznanego typu zostaje poprzednia wartosc, tu 0)
  let alfa;
  switch (p.iTrapezoidType) {
    case TRAPEZOID_TYPE.Isosceles:
      alfa = Math.atan(fHeight / ((fLength - fWidth) / 2));
      if (!p.bHalf) {
        set(1, sx + fLength + sg * bw / Math.sin(alfa), sy); aIndex[1] = iAction;
        set(2, sx + (fLength - fWidth) / 2 + fWidth + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa)), sy + fHeight + sg * bw); aIndex[2] = iAction;
        set(3, sx + (fLength - fWidth) / 2 + sg * (bw / Math.tan(alfa)), sy + fHeight + sg * bw); aIndex[3] = iAction;
        set(4, sx, sy); aIndex[4] = CUT.Nothing;
      } else {
        // polowa: tylko boki skosne, gora przejazdem (aIndex[0] = iAction zostaje z linii 65)
        set(0, sx + fLength + sg * bw / Math.sin(alfa), sy);
        aIndex[1] = CUT.GoToPosition;
        set(1, sx + (fLength - fWidth) / 2 + fWidth + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa)), sy + fHeight + sg * bw);
        aIndex[2] = iAction;
        set(2, sx + (fLength - fWidth) / 2 + sg * (bw / Math.tan(alfa)), sy + fHeight + sg * bw);
        aIndex[3] = CUT.Nothing;
        set(3, sx, sy);
        set(4, sx, sy); aIndex[4] = CUT.Nothing;
      }
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.RectangularLeft:
      alfa = Math.atan(fHeight / (fLength - fWidth));
      set(1, sx + fLength + sg * bw / Math.sin(alfa), sy); aIndex[1] = iAction;
      set(2, sx + fWidth + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa)), sy + fHeight + sg * bw); aIndex[2] = iAction;
      set(3, sx, sy + fHeight + sg * bw); aIndex[3] = iAction2;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.RectangularRight:
      // PLC: alfa z (fLength-fWidth)/2 jak dla rownoramiennego (w RectangularLeft bez /2)
      alfa = Math.atan(fHeight / ((fLength - fWidth) / 2));
      set(1, sx + fLength + sg * bw, sy); aIndex[1] = iAction2;
      set(2, sx + fLength + sg * bw, sy + fHeight + sg * bw); aIndex[2] = iAction;
      set(3, sx + fLength - fWidth + sg * (bw / Math.tan(alfa)), sy + fHeight + sg * bw); aIndex[3] = iAction;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.IsoscelesSide1:
      alfa = Math.atan(fHeight / ((fLength - fWidth) / 2));
      set(1, sx + fHeight + sg * bw, sy - (fLength - fWidth) / 2 + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa))); aIndex[1] = iAction;
      set(2, sx + fHeight + sg * bw, sy + (fLength - fWidth) / 2 + fWidth + sg * bw); aIndex[2] = iAction;
      // PLC: punkt 3 na sy + fWidth (dla Side2: sy + fLength)
      set(3, sx, sy + fWidth); aIndex[3] = iAction;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.IsoscelesSide2:
      alfa = Math.atan(fHeight / ((fLength - fWidth) / 2));
      set(1, sx + fHeight + sg * bw, sy + (fLength - fWidth) / 2 + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa))); aIndex[1] = iAction;
      set(2, sx + fHeight + sg * bw, sy + (fLength - fWidth) / 2 + fWidth + sg * bw); aIndex[2] = iAction;
      set(3, sx, sy + fLength); aIndex[3] = iAction;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.RectangularLeftSide:
      alfa = Math.atan(fHeight / (fLength - fWidth));
      set(1, sx + fHeight + sg * bw / Math.sin(alfa), sy); aIndex[1] = iAction;
      set(2, sx + fHeight + sg * bw / Math.sin(alfa), sy + fLength + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa))); aIndex[2] = iAction;
      set(3, sx, sy + fWidth + sg * bw); aIndex[3] = iAction;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    case TRAPEZOID_TYPE.RectangularRightSide:
      alfa = Math.atan(fHeight / (fLength - fWidth));
      set(1, sx + fHeight + sg * bw / Math.sin(alfa), sy + (fLength - fWidth) + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa))); aIndex[1] = iAction;
      set(2, sx + fHeight + sg * bw / Math.sin(alfa), sy + fLength + sg * (bw / Math.sin(alfa) - bw / Math.tan(alfa))); aIndex[2] = iAction;
      set(3, sx, sy + fLength); aIndex[3] = iAction;
      set(4, sx, sy); aIndex[4] = CUT.Nothing;
      iNumber = 4;
      break;
    default:
      break;
  }
  aIndex[4] = CUT.Nothing; aIndex[5] = CUT.Nothing; aIndex[6] = CUT.Nothing; aIndex[7] = CUT.Nothing;
  return { aXPositions, aYPositions, aIndex, iNumber };
}

// GetCrossPositions - p: {fStartXPosition, fStartYPosition, fLength, fWidth, fWidth2, fHeight, bBladeWidth, iInner,
// fParameterBladeWidth}. Ramie poziome fLength x fWidth2, pionowe fWidth2 x fWidth (fHeight w dol od startu).
export function getCrossPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, fWidth2, fHeight } = p;
  if (p.bBladeWidth) {
    // szerokosc tarczy tylko w fLength / fWidth (fWidth2 i fHeight bez korekty)
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; } else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; }
  }
  const fArm1 = (fLength - fWidth2) / 2;
  const fArm2 = fWidth - fWidth2 - fHeight;
  const inner = p.iInner >= 1;
  // zewn.: naroza wklesle ciete CutInnerEnd/CutInnerStart (PLC: aIndex[0] = CutInnerEnd), wewn.: wszedzie CutInnerFull
  const pts = [
    [sx, sy, CUT.CutInnerEnd],
    [sx + fArm1, sy, CUT.CutInnerStart],
    [sx + fArm1, sy - fHeight, CUT.Cut],
    [sx + fArm1 + fWidth2, sy - fHeight, CUT.CutInnerEnd],
    [sx + fArm1 + fWidth2, sy, CUT.CutInnerStart],
    [sx + fArm1 + fWidth2 + fArm1, sy, CUT.Cut],
    [sx + fArm1 + fWidth2 + fArm1, sy + fWidth2, CUT.CutInnerEnd],
    [sx + fArm1 + fWidth2, sy + fWidth2, CUT.CutInnerStart],
    [sx + fArm1 + fWidth2, sy + fWidth2 + fArm2, CUT.Cut],
    [sx + fArm1, sy + fWidth2 + fArm2, CUT.CutInnerEnd],
    [sx + fArm1, sy + fWidth2, CUT.CutInnerStart],
    [sx, sy + fWidth2, CUT.Cut],
  ];
  pts.forEach(([x, y, a], i) => { aXPositions[i] = x; aYPositions[i] = y; aIndex[i] = inner ? CUT.CutInnerFull : a; });
  aXPositions[12] = sx; aYPositions[12] = sy; aIndex[12] = CUT.Nothing;
  return { aXPositions, aYPositions, aIndex, iNumber: 12 };
}

// GetPolygonPositions - p: {bBladeWidth, fStartXPosition, fStartYPosition, fParameterBladeWidth, iInner, bMill,
// bNewStartingPosition, fNewStartingPositionX/Y, aPolygonX, aPolygonY, aPolygonFunction [0..99], iNumber (poprzednia
// wartosc wyjscia instancji, domyslnie 0)}.
// PLC: punkty wzgledne (SavePosition zapisuje fXActualPosition - fStartXPosition), punkt 0 zawsze (0, 0),
// aPolygonX/Y[0] i cale aPolygonFunction nie sa uzywane, fStart*/bNewStartingPosition/fNewStartingPosition* tez nie.
export function getPolygonPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { aPolygonX, aPolygonY } = p;
  let iAction;
  if (p.bMill) iAction = MILL.Mill;
  else iAction = p.iInner >= 1 ? CUT.CutInnerFull : CUT.Cut;
  aXPositions[0] = 0; aYPositions[0] = 0; aIndex[0] = iAction;
  // PLC: bez punktu (0, 0) w 1..99 iNumber zostaje z poprzedniego wywolania
  let iNumber = p.iNumber ?? 0;
  for (let i = 1; i <= aPolygonX.length - 1; i++) {
    // pierwszy punkt (0, 0) konczy wielokat - zostaje jako punkt powrotu z aIndex = Nothing (po Clear)
    if (aPolygonX[i] === 0 && aPolygonY[i] === 0) { iNumber = i; break; }
    if (p.bBladeWidth) {
      // PLC: korekta o szerokosc tarczy w obu osiach naraz (przesuniecie po przekatnej)
      const k = p.iInner >= 1 ? -1 : 1;
      aXPositions[i] = aPolygonX[i] + k * p.fParameterBladeWidth;
      aYPositions[i] = aPolygonY[i] + k * p.fParameterBladeWidth;
    } else {
      aXPositions[i] = aPolygonX[i];
      aYPositions[i] = aPolygonY[i];
    }
    aIndex[i] = iAction;
  }
  return { aXPositions, aYPositions, aIndex, iNumber };
}

const CTX_ARGS = (ctx) => ({ bServiceBlocksReverse: ctx.blocksReverse });
const START_FIELDS = [
  { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
  { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
];
const xyBuffer = (out) => toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex }, out.iNumber);

// FiguresGeometricSt, TRIANGLE_*: fParameterBladeWidth := fManualAdditionalDistance, potem nadpisane szerokoscia
// tarczy/frezu; fAdditionalDistance nigdy nieustawiane - zostaje 0 (dodatkowa droga bez dlugosci).
const triangleCommon = (ctx) => ({
  iInner: ctx.internal, bBladeWidth: true, bAdditional: ctx.additional, fAdditionalDistance: 0,
  fParameterBladeWidth: ctx.modeMill ? ctx.millWidth : ctx.bladeWidth,
});

export const TRIANGLE_RECT = {
  id: 'TRIANGLE_RECT', v: 20, name: 'Trójkąt prostokątny', kind: 'cut', plc: 'GetTriangleRectPositions',
  fields: [
    ...START_FIELDS,
    { k: 'base', label: 'Podstawa (fFigureBase)', t: 'num', d: 1000 },
    { k: 'height', label: 'Wysokość (fFigureHeight)', t: 'num', d: 600 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
  ],
  build(v, ctx) {
    const out = getTriangleRectPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fBase: v.base, fHeight: v.height, fAngle: v.angle, ...triangleCommon(ctx),
    });
    return xyBuffer(out);
  },
};

export const TRIANGLE_EQUAL = {
  id: 'TRIANGLE_EQUAL', v: 25, name: 'Trójkąt równoboczny', kind: 'cut', plc: 'GetTriangleEqualPositions',
  fields: [
    ...START_FIELDS,
    { k: 'base', label: 'Bok (fFigureBase)', t: 'num', d: 1000 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
  ],
  build(v, ctx) {
    const out = getTriangleEqualPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fBase: v.base, fAngle: v.angle, ...triangleCommon(ctx),
    });
    return xyBuffer(out);
  },
};

export const TRIANGLE_ISOS = {
  id: 'TRIANGLE_ISOS', v: 30, name: 'Trójkąt równoramienny', kind: 'cut', plc: 'GetTriangleIsosPositions',
  fields: [
    ...START_FIELDS,
    { k: 'base', label: 'Podstawa (fFigureBase)', t: 'num', d: 1000 },
    { k: 'height', label: 'Wysokość (fFigureHeight)', t: 'num', d: 600 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
  ],
  build(v, ctx) {
    const out = getTriangleIsosPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fBase: v.base, fHeight: v.height, fAngle: v.angle, ...triangleCommon(ctx),
    });
    return xyBuffer(out);
  },
};

const TRAPEZOID_TYPES = [
  [0, 'równoramienny (Isosceles)'], [1, 'prostokątny lewy (RectangularLeft)'], [2, 'prostokątny prawy (RectangularRight)'],
  [3, 'równoramienny bok 1 (IsoscelesSide1)'], [4, 'równoramienny bok 2 (IsoscelesSide2)'],
  [5, 'prostokątny lewy bok (RectangularLeftSide)'], [6, 'prostokątny prawy bok (RectangularRightSide)'],
];

export const TRAPEZOID = {
  id: 'TRAPEZOID', v: 130, name: 'Trapez', kind: 'cut', plc: 'GetTrapezoidPositions',
  fields: [
    ...START_FIELDS,
    { k: 'length', label: 'Podstawa dolna (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Podstawa górna (fFigureWidth)', t: 'num', d: 600 },
    { k: 'height', label: 'Wysokość (fFigureHeight)', t: 'num', d: 400 },
    { k: 'type', label: 'Typ trapezu (iTrapezoidType)', t: 'sel', d: 0, o: TRAPEZOID_TYPES },
  ],
  // FiguresGeometricSt, FigureType.TRAPEZOID: bHalf nieustawiane - FALSE; iTrapezoidType > RectangularRightSide -> Isosceles
  build(v, ctx) {
    let type = Number(v.type);
    if (type > TRAPEZOID_TYPE.RectangularRightSide) type = TRAPEZOID_TYPE.Isosceles;
    const out = getTrapezoidPositions({
      bBladeWidth: true, fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fHeight: v.height,
      bAdditional: false, fAdditionalDistance: 0, iInner: ctx.internal, iTrapezoidType: type, bHalf: false,
      fParameterBladeWidth: ctx.modeMill ? ctx.millWidth : ctx.bladeWidth,
    }, CTX_ARGS(ctx));
    return xyBuffer(out);
  },
};

export const TRAPEZOID45 = {
  id: 'TRAPEZOID45', v: 140, name: 'Trapez 45°', kind: 'cut', plc: 'GetTrapezoidPositions',
  fields: [
    ...START_FIELDS,
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 500 },
    { k: 'height', label: 'Wysokość (fFigureHeight)', t: 'num', d: 200 },
    { k: 'half', label: 'Połowa - tylko skosy (bTrapezoid45Half)', t: 'bool', d: false },
  ],
  // FiguresGeometricSt, FigureType.TRAPEZOID45 (linie 548-549): fLength := fFigureHeight+8,
  // fWidth := fFigureWidth+8-2*fFigureHeight. PLC: przy fLength z fFigureHeight roznica podstaw = 3*H - W, wiec skos
  // 45° nie wychodzi (dla fLength := fFigureWidth+8 bylaby 2*H) - zachowane jak w PLC.
  build(v, ctx) {
    const out = getTrapezoidPositions({
      bBladeWidth: true, fStartXPosition: v.xs, fStartYPosition: v.ys,
      fLength: v.height + 8, fWidth: v.width + 8 - 2 * v.height, fHeight: v.height,
      bAdditional: false, fAdditionalDistance: 0, iInner: ctx.internal, iTrapezoidType: TRAPEZOID_TYPE.Isosceles, bHalf: !!v.half,
      fParameterBladeWidth: ctx.modeMill ? ctx.millWidth : ctx.bladeWidth,
    }, CTX_ARGS(ctx));
    return xyBuffer(out);
  },
};

export const CROSS = {
  id: 'CROSS', v: 190, name: 'Krzyż', kind: 'cut', plc: 'GetCrossPositions',
  fields: [
    ...START_FIELDS,
    { k: 'length', label: 'Długość ramienia poziomego (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Długość ramienia pionowego (fFigureWidth)', t: 'num', d: 1000 },
    { k: 'height', label: 'Ramię pionowe w dół od startu (fFigureHeight)', t: 'num', d: 300 },
    { k: 'width2', label: 'Szerokość ramion (fCrossWidth2)', t: 'num', d: 200 },
  ],
  // FiguresGeometricSt, FigureType.CROSS: zawsze fParameterBladeWidth (takze w trybie frezu)
  build(v, ctx) {
    const out = getCrossPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fHeight: v.height, fWidth2: v.width2,
      iInner: ctx.internal, bBladeWidth: true, fParameterBladeWidth: ctx.bladeWidth,
    });
    return xyBuffer(out);
  },
};

const num = (a) => (Array.isArray(a) ? a : []).map((x) => Number(x) || 0);

export const POLYGON = {
  id: 'POLYGON', v: 220, name: 'Wielokąt', kind: 'cut', plc: 'GetPolygonPositions',
  fields: [
    { k: 'xs', label: 'Start X (fProgramStartPositionX)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fProgramStartPositionY)', t: 'num', d: 0 },
    { k: 'px', label: 'Punkty X względem startu (aPolygonX[1..])', t: 'list', d: [1000, 1000, 500, 0] },
    { k: 'py', label: 'Punkty Y względem startu (aPolygonY[1..])', t: 'list', d: [0, 600, 900, 600] },
    { k: 'pf', label: 'Funkcje punktów (aPolygonFunction[1..]) - PLC ich nie używa', t: 'list', d: [1, 1, 1, 1] },
  ],
  // FiguresGeometricSt: fStart* := fProgramStartPosition*, tablice aPolygon* (lista k -> indeks k+1, indeks 0 = start
  // (0, 0) - HMI zapisuje od iPolygonSelectedNumber >= 1); bBladeWidth i iInner nieustawiane - FALSE / 0.
  build(v, ctx) {
    const mill = ctx.modeMill;
    const aPolygonX = new Array(100).fill(0);
    const aPolygonY = new Array(100).fill(0);
    const aPolygonFunction = new Array(100).fill(CUT.Nothing);
    const px = num(v.px); const py = num(v.py); const pf = num(v.pf);
    const n = Math.min(99, Math.max(px.length, py.length));
    for (let k = 0; k < n; k++) {
      aPolygonX[k + 1] = px[k] ?? 0; aPolygonY[k + 1] = py[k] ?? 0; aPolygonFunction[k + 1] = pf[k] ?? CUT.Nothing;
    }
    const out = getPolygonPositions({
      bBladeWidth: false, fStartXPosition: v.xs, fStartYPosition: v.ys, iInner: 0, bMill: mill,
      fParameterBladeWidth: mill ? ctx.millWidth : ctx.bladeWidth,
      bNewStartingPosition: mill ? ctx.newStart : false, fNewStartingPositionX: ctx.newStartX, fNewStartingPositionY: ctx.newStartY,
      aPolygonX, aPolygonY, aPolygonFunction,
    });
    return xyBuffer(out);
  },
};

export const FIGURES_A = [TRIANGLE_RECT, TRIANGLE_EQUAL, TRIANGLE_ISOS, TRAPEZOID, TRAPEZOID45, CROSS, POLYGON];
