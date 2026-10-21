// Figury grupy B: daszki, blat, schody luk, ksiazki, cwiercwalek (PLC: FiguresGeometricSt + bloki figur).
// Funkcje 1:1 z FB (te same nazwy wejsc/wyjsc), potem definicje figur z polami HMI i mapowaniem wyjsc
// jak w FiguresGeometricSt (przepisywane sa tylko wyjscia, ktore FiguresGeometricSt kopiuje do aFigure*).

import { DEG, CUT, arrays, toBuffer } from './common.js';

// ---------------------------------------------------------------------------------------------------------
// GetAdditionalDistance - dodatkowa droga daszkow: wyjazd tarczy pochylonej o fAngle na grubosci fDepth
export function getAdditionalDistance(p) {
  let fAdditionalDistance;
  if (p.iInner === 0) {
    fAdditionalDistance = p.fAngle !== 90 ? Math.tan(p.fAngle * DEG) * p.fDepth : 0;
  } else {
    fAdditionalDistance = 0;
  }
  // Dodatkowa droga
  if (p.bManualAdditionalDistance) fAdditionalDistance += p.fManualAdditionalDistance;
  return { fAdditionalDistance };
}

// GetRoofPositions - p: wejscia FB; zwraca {aXPositions, aYPositions, aIndex, aBAngle, iNumber}
export function getRoofPositions(p) {
  const { aXPositions, aYPositions, aIndex, aBAngle } = arrays('aXPositions', 'aYPositions', 'aIndex', 'aBAngle');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, fAdditionalDistance: ad, fBAngle, iInner, bRoofInner } = p;
  const cx = p.fRoofCorrectionX; const cy = p.fRoofCorrectionY;
  if (p.bBladeWidth) {
    if (iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; } else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; }
  }
  const c = Math.cos(p.fAngle * DEG);
  const s = Math.sin(p.fAngle * DEG);
  // CheckBounds - i nigdy nie przekracza 8
  let i = 0;
  const set = (x, y, a) => { aXPositions[i] = x; aYPositions[i] = y; aIndex[i] = a; aBAngle[i] = fBAngle; i++; };
  // sciany 1, 2: Slope*Reverse dla daszka zewnetrznego, sciany 3, 4 odwrotnie
  const a12 = iInner >= 1 ? (bRoofInner ? CUT.SlopeInner : CUT.SlopeInnerReverse) : (bRoofInner ? CUT.Slope : CUT.SlopeReverse);
  const a34 = iInner >= 1 ? (bRoofInner ? CUT.SlopeInnerReverse : CUT.SlopeInner) : (bRoofInner ? CUT.SlopeReverse : CUT.Slope);
  const { bWall1: w1, bWall2: w2, bWall3: w3, bWall4: w4 } = p;
  // korekty X/Y dodawane tylko w czesci punktow - jak w PLC
  if (w1) {
    set(sx - c * ad, sy - s * ad, a12);
    set(sx + c * fLength + c * ad + cx, sy + s * fLength + s * ad, !w2 && !w3 && !w4 ? CUT.Nothing : CUT.GoToPosition);
  }
  if (w2) {
    set(sx + c * fLength + s * ad + cx, sy + s * fLength - c * ad, a12);
    set(sx + c * fLength - s * fWidth - s * ad + cx, sy + s * fLength + c * fWidth + c * ad + cy, !w3 && !w4 ? CUT.Nothing : CUT.GoToPosition);
  }
  if (w3) {
    set(sx + c * fLength - s * fWidth + c * ad + cx, sy + s * fLength + c * fWidth + s * ad + cy, a34);
    set(sx - s * fWidth - c * ad, sy + c * fWidth - s * ad + cy, !w4 ? CUT.Nothing : CUT.GoToPosition);
  }
  if (w4) {
    set(sx - s * fWidth - s * ad, sy + c * fWidth + c * ad + cy, a34);
    set(sx + s * ad, sy - c * ad, CUT.Nothing);
  }
  // bez scian iNumber = -1 (w buforze toBuffer obcina do 0)
  const iNumber = i - 1;
  // bRoofInner: korekta punktow 2..5 w PLC zakomentowana
  return { aXPositions, aYPositions, aIndex, aBAngle, iNumber };
}

// Daszki (ROOFS) - wejscia z FiguresGeometricSt: bBladeWidth, fAngle, iInner, bACBD nieustawiane (FALSE / 0)
export const ROOFS = {
  id: 'ROOFS', v: 80, name: 'Daszki', kind: 'cut', plc: 'GetRoofPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 600 },
    { k: 'bAngle', label: 'Kąt pochylenia tarczy [°] (fRoofBAngle)', t: 'num', d: 45 },
    { k: 'inner', label: 'Daszek wewnętrzny (bFigureInner)', t: 'bool', d: false },
    { k: 'wall1', label: 'Ściana 1 (bRoof1Wall)', t: 'bool', d: true },
    { k: 'wall2', label: 'Ściana 2 (bRoof2Wall)', t: 'bool', d: true },
    { k: 'wall3', label: 'Ściana 3 (bRoof3Wall)', t: 'bool', d: true },
    { k: 'wall4', label: 'Ściana 4 (bRoof4Wall)', t: 'bool', d: true },
  ],
  // FiguresGeometricSt, FigureType.ROOFS: najpierw GetAdditionalDistance (lancuch bEnable), potem GetRoofPositions
  build(v, ctx) {
    const ad = getAdditionalDistance({
      fAngle: v.bAngle, fDepth: ctx.materialThickness, iInner: ctx.internal,
      bManualAdditionalDistance: ctx.additional, fManualAdditionalDistance: ctx.additionalDistance,
    });
    const out = getRoofPositions({
      bBladeWidth: false, fAngle: 0, iInner: 0, bACBD: false, fParameterBladeWidth: 0,   // nieustawiane w FiguresGeometricSt
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fBAngle: v.bAngle,
      fAdditionalDistance: ad.fAdditionalDistance,
      fRoofCorrectionX: ctx.roofCorrectionX, fRoofCorrectionY: ctx.roofCorrectionY, bRoofInner: v.inner,
      bWall1: v.wall1, bWall2: v.wall2, bWall3: v.wall3, bWall4: v.wall4,
    });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, aBAngle -> aFigureAngle, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, angle: out.aBAngle }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------
// WorktopType (PLC)
export const WORKTOP_TYPE = { Full: 0, HalfLeft: 1, HalfRight: 2, FullSide1: 3, FullSide2: 4, HalfLeftSide: 5, HalfRightSide: 6 };

// GetWorktopPositions.SetSigns - kierunki bokow A..H, zwraca {count (0 - nieznany typ), aSign}
export function setSigns(iType) {
  const aSign = new Array(8).fill(0);
  aSign[0] = 1; // A zawsze w prawo
  const t = {
    [WORKTOP_TYPE.Full]: [1, -1, 1, -1, -1, -1, -1],
    [WORKTOP_TYPE.HalfLeft]: [1, -1, -1, -1, -1],
    [WORKTOP_TYPE.HalfRight]: [1, -1, 1, -1, -1],
    [WORKTOP_TYPE.FullSide1]: [-1, 1, 1, -1, -1, -1, -1],
    [WORKTOP_TYPE.FullSide2]: [1, 1, 1, -1, 1, -1, -1],
    [WORKTOP_TYPE.HalfLeftSide]: [-1, 1, 1, -1, -1],
    [WORKTOP_TYPE.HalfRightSide]: [1, 1, 1, -1, -1],
  }[iType];
  if (!t) return { count: 0, aSign };
  t.forEach((sg, k) => { aSign[k + 1] = sg; });
  return { count: t.length + 1, aSign };
}

// GetWorktopPositions.CompleteLengths - zwraca {ok, aLengthsCalc, aSign}; puste (<= 0) boki uzupelniane z domkniecia
export function completeLengths(iWorktopType, aInputLengths) {
  const { count: iCount, aSign } = setSigns(iWorktopType);
  const aLengthsCalc = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) aLengthsCalc[i] = i < iCount ? (aInputLengths[i] ?? 0) : 0;
  let ok = iCount > 0;
  for (let iGroup = 0; iGroup <= 1; iGroup++) {
    let iZeros = 0;
    // bez pustych: wyliczany (nadpisywany) ostatni bok grupy - jak w PLC
    let iUnknown = iCount - 2 + iGroup;
    for (let i = iGroup; i <= iCount - 1; i += 2) {
      if (aLengthsCalc[i] <= 0) { iZeros++; iUnknown = i; }
    }
    if (iZeros > 1) iUnknown = -1;
    if (iUnknown >= 0) {
      let fSum = 0;
      for (let i = iGroup; i <= iCount - 1; i += 2) if (i !== iUnknown) fSum += aSign[i] * aLengthsCalc[i];
      const fLength = -fSum * aSign[iUnknown];
      if (fLength > 0) aLengthsCalc[iUnknown] = fLength; else { aLengthsCalc[iUnknown] = 0; ok = false; }
    } else {
      ok = false;
    }
  }
  return { ok, aLengthsCalc, aSign };
}

// GetWorktopPositions - zwraca {aXPositions, aYPositions, aIndex, iNumber, aLengthsCalc, bLengthsError}
// bBladeWidth, bAdditional, fAdditionalDistance - nieuzywane w FB
export function getWorktopPositions(p) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fParameterBladeWidth: bw } = p;
  // 1. Boki z uzupelnionymi pustymi
  const cl = completeLengths(p.iWorktopType, p.aWorktopLengths);
  const bLengthsError = !cl.ok;
  const iCount = bLengthsError ? 0 : setSigns(p.iWorktopType).count;
  const { aLengthsCalc, aSign } = cl;
  // 2. Wierzcholki nominalne wzgledem punktu startowego
  const aNomX = new Array(9).fill(0);
  const aNomY = new Array(9).fill(0);
  for (let i = 1; i <= iCount - 1; i++) {
    if (i % 2 === 1) { aNomX[i] = aNomX[i - 1] + aSign[i - 1] * aLengthsCalc[i - 1]; aNomY[i] = aNomY[i - 1]; } else { aNomX[i] = aNomX[i - 1]; aNomY[i] = aNomY[i - 1] + aSign[i - 1] * aLengthsCalc[i - 1]; }
  }
  // 3. Naroznik wklesly: skret w prawo przy obchodzeniu przeciwnie do zegara
  const aConcave = new Array(9).fill(false);
  for (let i = 0; i <= iCount - 1; i++) {
    const iPrev = (i + iCount - 1) % iCount; const iNext = (i + 1) % iCount;
    aConcave[i] = (aNomX[i] - aNomX[iPrev]) * (aNomY[iNext] - aNomY[i]) - (aNomY[i] - aNomY[iPrev]) * (aNomX[iNext] - aNomX[i]) < 0;
  }
  // 4. Pozycje z gruboscia pily i akcje odcinkow
  for (let i = 0; i <= iCount - 1; i++) {
    const iPrev = (i + iCount - 1) % iCount; const iNext = (i + 1) % iCount;
    let fX = aNomX[i]; let fY = aNomY[i];
    // punkt startowy (i = 0) nigdy nie przesuwany o grubosc pily
    if (i > 0) {
      if ((aNomX[iPrev] === aNomX[i] && aNomY[i] > aNomY[iPrev]) || (aNomX[iNext] === aNomX[i] && aNomY[iNext] > aNomY[i])) fX += bw;
      if ((aNomY[iPrev] === aNomY[i] && aNomX[i] < aNomX[iPrev]) || (aNomY[iNext] === aNomY[i] && aNomX[iNext] < aNomX[i])) fY += bw;
    }
    aXPositions[i] = sx + fX; aYPositions[i] = sy + fY;
    aIndex[i] = aConcave[iNext] ? CUT.CutInnerEnd : aConcave[i] ? CUT.CutInnerStart : CUT.Cut;
  }
  // Powrot do punktu startowego
  aXPositions[iCount] = sx; aYPositions[iCount] = sy; aIndex[iCount] = CUT.Nothing;
  return { aXPositions, aYPositions, aIndex, iNumber: iCount, aLengthsCalc, bLengthsError };
}

// Lista z pola 'list' (tekst albo tablica) -> aWorktopLenghts [0..7]
function lengths8(raw) {
  const a = Array.isArray(raw) ? raw : String(raw ?? '').split(/[;,\s]+/).filter((t) => t !== '').map(Number);
  return Array.from({ length: 8 }, (_, i) => (Number.isFinite(a[i]) ? a[i] : 0));
}

export const WORKTOP = {
  id: 'WORKTOP', v: 150, name: 'Blat', kind: 'cut', plc: 'GetWorktopPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'type', label: 'Typ blatu (iWorktopType)', t: 'sel', d: 0, o: [
      [0, 'pełny (Full)'], [1, 'połówka, wycięcie lewe (HalfLeft)'], [2, 'połówka, wycięcie prawe (HalfRight)'],
      [3, 'pełny leżący 1 (FullSide1)'], [4, 'pełny leżący 2 (FullSide2)'], [5, 'połówka leżąca, B w dół (HalfLeftSide)'],
      [6, 'połówka leżąca, B w górę (HalfRightSide)']] },
    { k: 'lengths', label: 'Boki A..H, 0 = pusty - wyliczany (aWorktopLenghts)', t: 'list', d: '3000, 600, 1000, 400, 1500, 300, 0, 0' },
  ],
  // FiguresGeometricSt, FigureType.WORKTOP (+ co cykl CompleteLengths -> bWorktopLengthsError)
  build(v, ctx) {
    const iWorktopType = v.type > WORKTOP_TYPE.HalfRightSide ? WORKTOP_TYPE.Full : v.type;
    const aWorktopLenghts = lengths8(v.lengths);
    // bWorktopLengthsError - PLC i tak zapisalby bufor (1 punkt startowy, iNumber = 0), tu blad dla operatora
    if (!completeLengths(iWorktopType, aWorktopLenghts).ok) {
      throw new Error('Blat: nie da się uzupełnić długości boków - w grupie (A, C, E, G / B, D, F, H) może być pusty najwyżej jeden bok, a wyliczony musi wyjść > 0 (bWorktopLengthsError)');
    }
    const out = getWorktopPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, aWorktopLengths: aWorktopLenghts, iWorktopType,
      fParameterBladeWidth: ctx.bladeWidth, bBladeWidth: false, bAdditional: false, fAdditionalDistance: 0,
    });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------
// GetCurvedStairsPositions - zwraca {aXPositions, aYPositions, aRadius, aIndex, iNumber}; bBladeWidth nieuzywane
export function getCurvedStairsPositions(p) {
  const { aXPositions, aYPositions, aRadius, aIndex } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aIndex');
  const bw = p.fParameterBladeWidth;
  // alfa liczone z wymiarow przed dodaniem grubosci pily
  const alfa = Math.asin((p.fLength / 2) / p.fRadius);
  const fLength = p.fLength + bw;
  const fHeight = p.fHeight; // + fParameterBladeWidth (zakomentowane w PLC)
  const fRadius = p.fRadius + bw / 2;
  const sx = p.fStartXPosition - bw / 2;
  const sy = p.fStartYPosition;
  // Clear() pusta - tablice nie sa zerowane, ale 0..4 zawsze nadpisywane
  const set = (i, x, y, r, a) => { aXPositions[i] = x; aYPositions[i] = y; aRadius[i] = r; aIndex[i] = a; };
  set(0, sx, sy, fRadius, CUT.CutArcCW);
  set(1, sx + fLength, sy, fRadius, CUT.Cut);
  // w Y odejmowana cala grubosc pily, w X tylko polowa (przez sx) - jak w PLC
  set(2, sx + fLength - Math.sin(alfa) * fHeight, sy - Math.cos(alfa) * fHeight - bw, fRadius - fHeight, CUT.CutArcCCW);
  set(3, sx + Math.sin(alfa) * fHeight, sy - Math.cos(alfa) * fHeight - bw, fRadius - fHeight, CUT.Cut);
  set(4, sx, sy, fRadius, CUT.Nothing);
  return { aXPositions, aYPositions, aRadius, aIndex, iNumber: 4 };
}

export const CURVED_STAIRS = {
  id: 'CURVED_STAIRS', v: 170, name: 'Schody łukowe', kind: 'cut', plc: 'GetCurvedStairsPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'radius', label: 'Promień (fFigureRadius)', t: 'num', d: 2000 },
    { k: 'length', label: 'Długość - cięciwa (fFigureLength)', t: 'num', d: 1000 },
    { k: 'height', label: 'Wysokość stopnia (fFigureHeight)', t: 'num', d: 300 },
  ],
  // FiguresGeometricSt, FigureType.CURVED_STAIRS
  build(v, ctx) {
    // PLC: ASIN poza zakresem -> NaN w buforze; tu blad dla operatora
    if (!(Math.abs(v.length / 2) <= Math.abs(v.radius)) || v.radius === 0) {
      throw new Error('Schody łukowe: długość (cięciwa) nie może być większa niż 2 × promień');
    }
    const out = getCurvedStairsPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fRadius: v.radius, fLength: v.length, fHeight: v.height,
      fParameterBladeWidth: ctx.bladeWidth, bBladeWidth: false,
    });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, aRadius, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------
// Zapis aRadius[CheckBounds(i, LOWER_BOUND(Radius), UPPER_BOUND(Radius))] - granice globalnej Radius [0..100]
// zamiast aRadius [0..249]: indeksy > 100 trafiaja w aRadius[100], aRadius[101..249] zostaja 0
const RADIUS_UPPER = 100;
const setRadius = (aRadius, i, val) => { aRadius[Math.max(0, Math.min(RADIUS_UPPER, i))] = val; };

// BookType (PLC)
export const BOOK_TYPE = { first: 0, second: 1 };

// GetBookPositions.GetMinimalRadius
export function getMinimalRadius(fStartDepth, fEndDepth, fLength) {
  if (fStartDepth === 0 && fEndDepth === 0 && fLength === 0) return 0;
  const fRadiusFromPoints = Math.sqrt(fLength ** 2 + (fEndDepth - fStartDepth) ** 2) / 2;
  let fRadiusLimitY0;
  if (fStartDepth === fEndDepth) {
    fRadiusLimitY0 = fStartDepth <= 0 ? fRadiusFromPoints : (fStartDepth ** 2 + (fLength / 2) ** 2) / (2 * fStartDepth);
  } else {
    const fDepthDiff = fStartDepth - fEndDepth;
    fRadiusLimitY0 = (((fStartDepth + fEndDepth) * (fLength ** 2 + fDepthDiff ** 2)) / (2 * fDepthDiff ** 2))
      - ((fLength * Math.sqrt(fStartDepth * fEndDepth * (fLength ** 2 + fDepthDiff ** 2))) / fDepthDiff ** 2);
  }
  return Math.max(fRadiusFromPoints, fRadiusLimitY0);
}

// Zmienne globalne, ktore FB ksiazek / cwiercwalka nadpisuja przy bCalculateJump (nie trafiaja do bufora)
function calculateJump(p, g, smoothing) {
  const out = { fProfileJump: p.fParameterBladeWidth - 0.1, fCutDepthCutHeight: Math.max(g.aCutDepthPrimary?.[0] ?? 20, g.aCutDepthSecondary?.[0] ?? 10) };
  if (smoothing) out.fSmoothingJump = p.fParameterBladeWidth;
  return out;
}

// GetBookPositions - g: {bServiceBookMinimalRadius, aCutDepthPrimary, aCutDepthSecondary}
// zwraca {aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex, iNumber, globals}
export function getBookPositions(p, g = {}) {
  const { aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aDepthStart', 'aDepthEnd', 'aLength', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fDepth, bBookMultipleDepth: multi } = p;
  // iAction [0..8] - zmienna FB (nowa instancja: 0); iAction[4] nigdy nieustawiane, nieznany iBookType - poprzednie
  const iAction = new Array(9).fill(0);
  if (p.iBookType === BOOK_TYPE.first) {
    [iAction[0], iAction[1], iAction[2], iAction[3]] = [CUT.ProfileConvexX, CUT.ProfileConcaveX, CUT.ProfileConcaveX, CUT.ProfileConvexX];
    [iAction[5], iAction[6], iAction[7], iAction[8]] = [CUT.SmoothingConvexX, CUT.SmoothingConcaveX, CUT.SmoothingConcaveX, CUT.SmoothingConvexX];
  } else if (p.iBookType === BOOK_TYPE.second) {
    [iAction[0], iAction[1], iAction[2], iAction[3]] = [CUT.ProfileConcaveX, CUT.ProfileConvexX, CUT.ProfileConvexX, CUT.ProfileConcaveX];
    [iAction[5], iAction[6], iAction[7], iAction[8]] = [CUT.SmoothingConcaveX, CUT.SmoothingConvexX, CUT.SmoothingConvexX, CUT.SmoothingConcaveX];
  }
  const fRadiusWorking = (fLength / 4) * 2;
  // glebokosci odcinka k (0..3): poczatek / koniec
  const depths = [[fDepth, p.fDepth2], [p.fDepth2, p.fDepth3], [p.fDepth3, p.fDepth4], [p.fDepth4, p.fDepth5]];
  const seg = (i, k) => {
    aXPositions[i] = sx + k * fLength / 4; aYPositions[i] = sy;
    if (multi) { [aDepthStart[i], aDepthEnd[i]] = depths[k]; } else { aDepthStart[i] = fDepth; aDepthEnd[i] = fDepth; }
    setRadius(aRadius, i, getMinimalRadius(aDepthStart[i], aDepthEnd[i], fLength / 4));
  };
  for (let k = 0; k < 4; k++) { seg(k, k); aIndex[k] = iAction[k]; }
  aXPositions[4] = sx + 4 * fLength / 4; aYPositions[4] = sy; aIndex[4] = CUT.Nothing;
  let iNumber = 4;
  let globals = null;
  if (p.bCalculateJump) globals = calculateJump(p, g, false);
  if (p.bSmoothing) {
    aIndex[4] = CUT.GoToPosition;
    for (let k = 0; k < 4; k++) { seg(5 + k, k); aIndex[5 + k] = iAction[5 + k]; }
    aXPositions[9] = sx + 4 * fLength / 4; aYPositions[9] = sy; aIndex[9] = CUT.Nothing;
    // PLC: iNumber := 10 (bez wygladzania 4) - punkt 10 = wyzerowany (0, 0, Nothing), jak w PLC
    iNumber = 10;
    if (p.bCalculateJump) globals = calculateJump(p, g, true);
  }
  for (let i = 0; i < aXPositions.length; i++) {
    // bez serwisowego bServiceBookMinimalRadius promien z GetMinimalRadius nadpisywany fLength / 2
    if (!g.bServiceBookMinimalRadius) setRadius(aRadius, i, fRadiusWorking);
    aLength[i] = p.fWidth;
    if (!multi) { aDepthStart[i] = fDepth; aDepthEnd[i] = fDepth; }
  }
  return { aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex, iNumber, globals };
}

export const BOOKS = {
  id: 'BOOKS', v: 200, name: 'Książki', kind: 'profile', plc: 'GetBookPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość - długość profilu (fFigureWidth)', t: 'num', d: 300 },
    { k: 'bookType', label: 'Typ książki (iBookType)', t: 'sel', d: 0, o: [[0, 'pierwszy - wypukły na końcach (first)'], [1, 'drugi - wklęsły na końcach (second)']] },
    { k: 'depth', label: 'Głębokość (fFigureDepthStart)', t: 'num', d: 20 },
    { k: 'multipleDepth', label: 'Różne głębokości (bBookMultipleDepth)', t: 'bool', d: false },
    { k: 'depth2', label: 'Głębokość 2 (fBookDepth2)', t: 'num', d: 20, show: (v) => v.multipleDepth },
    { k: 'depth3', label: 'Głębokość 3 (fBookDepth3)', t: 'num', d: 20, show: (v) => v.multipleDepth },
    { k: 'depth4', label: 'Głębokość 4 (fBookDepth4)', t: 'num', d: 20, show: (v) => v.multipleDepth },
    { k: 'depth5', label: 'Głębokość 5 (fBookDepth5)', t: 'num', d: 20, show: (v) => v.multipleDepth },
    { k: 'smoothing', label: 'Wygładzanie (bFigureSmoothing)', t: 'bool', d: false },
    { k: 'calculateJump', label: 'Wylicz skoki (bFigureCalculateJump)', t: 'bool', d: true },
  ],
  // FiguresGeometricSt, FigureType.BOOKS
  build(v, ctx) {
    const out = getBookPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width,
      bSmoothing: v.smoothing, bCalculateJump: v.calculateJump, bBookMultipleDepth: v.multipleDepth, iBookType: v.bookType,
      fDepth: v.depth, fDepth2: v.depth2, fDepth3: v.depth3, fDepth4: v.depth4, fDepth5: v.depth5,
      fParameterBladeWidth: ctx.bladeWidth,
    }, { bServiceBookMinimalRadius: ctx.bookMinimalRadius ?? false });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius, depth: out.aDepthStart, depthEnd: out.aDepthEnd, length: out.aLength }, out.iNumber);
  },
};

// ---------------------------------------------------------------------------------------------------------
// QuaterRoundType (PLC)
export const QUATER_ROUND_TYPE = { Single: 0, Double: 1 };

// GetQuaterRoundPositions - g: {aCutDepthPrimary, aCutDepthSecondary}
// zwraca {aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex, iNumber, globals}
export function getQuaterRoundPositions(p, g = {}) {
  const { aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex } = arrays('aXPositions', 'aYPositions', 'aRadius', 'aDepthStart', 'aDepthEnd', 'aLength', 'aIndex');
  const { fStartXPosition: sx, fStartYPosition: sy, fLength, fDepth, bX } = p;
  const dbl = p.iType === QUATER_ROUND_TYPE.Double;
  const xy = (i, d) => { aXPositions[i] = bX ? sx + d : sx; aYPositions[i] = bX ? sy : sy + d; };
  const conv = bX ? CUT.ProfileConvexX : CUT.ProfileConvexY;
  const smooth = bX ? CUT.SmoothingConvexX : CUT.SmoothingConvexY;
  let i = 0;
  xy(i, 0); aDepthStart[i] = fDepth; aDepthEnd[i] = 0; aIndex[i] = conv;
  i++;
  // punkt konca profilu - aIndex zostaje 0 (Nothing) z Clear
  xy(i, fDepth);
  i++;
  if (dbl) {
    xy(i, fLength - fDepth);
    aIndex[i - 1] = CUT.GoToPosition;
    i++;
    aDepthStart[i - 1] = 0; aDepthEnd[i - 1] = fDepth;
    xy(i, fLength);
    aIndex[i - 1] = conv;
    i++;
  }
  let globals = null;
  if (p.bCalculateJump) globals = calculateJump(p, g, false);
  if (p.bSmoothing) {
    aIndex[i - 1] = CUT.GoToPosition;
    xy(i, 0); aDepthStart[i] = fDepth; aDepthEnd[i] = 0;
    i++;
    xy(i, fDepth);
    aIndex[i - 1] = smooth;
    i++;
    if (dbl) {
      xy(i, fLength - fDepth); aDepthStart[i] = 0; aDepthEnd[i] = fDepth;
      aIndex[i - 1] = CUT.GoToPosition;
      i++;
      xy(i, fLength);
      aIndex[i - 1] = smooth;
      i++;
    }
    if (p.bCalculateJump) globals = calculateJump(p, g, true);
  }
  // PLC: Nothing i iNumber na indeksie i (za ostatnim zapisanym punktem) - punkt i zostaje (0, 0) z Clear,
  // nie punkt startowy; ostatni zapisany punkt ma krok 0 (Nothing) z Clear
  aIndex[i] = CUT.Nothing;
  const iNumber = i;
  for (let k = 0; k < aXPositions.length; k++) {
    setRadius(aRadius, k, fDepth);
    aLength[k] = p.fWidth;
  }
  return { aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, aIndex, iNumber, globals };
}

export const QUATER_ROUND = {
  id: 'QUATER_ROUND', v: 210, name: 'Ćwierćwałek', kind: 'profile', plc: 'GetQuaterRoundPositions',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 600, show: (v) => v.quaterType === 1 },
    { k: 'width', label: 'Szerokość - długość profilu (fFigureWidth)', t: 'num', d: 300 },
    { k: 'depth', label: 'Głębokość = promień (fFigureDepthStart)', t: 'num', d: 20 },
    { k: 'quaterType', label: 'Typ (iQuaterRoundType)', t: 'sel', d: 0, o: [[0, 'pojedynczy (Single)'], [1, 'podwójny (Double)']] },
    { k: 'x', label: 'Profil w osi X (bQuaterRoundX)', t: 'bool', d: true },
    { k: 'smoothing', label: 'Wygładzanie (bFigureSmoothing)', t: 'bool', d: false },
    { k: 'calculateJump', label: 'Wylicz skoki (bFigureCalculateJump)', t: 'bool', d: true },
  ],
  // FiguresGeometricSt, FigureType.QUATER_ROUND
  build(v, ctx) {
    const iType = v.quaterType > QUATER_ROUND_TYPE.Double ? QUATER_ROUND_TYPE.Single : v.quaterType;
    const out = getQuaterRoundPositions({
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fDepth: v.depth,
      bSmoothing: v.smoothing, bCalculateJump: v.calculateJump, iType, bX: v.x, fParameterBladeWidth: ctx.bladeWidth,
    });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, aRadius, aDepthStart, aDepthEnd, aLength, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex, r: out.aRadius, depth: out.aDepthStart, depthEnd: out.aDepthEnd, length: out.aLength }, out.iNumber);
  },
};

// Kolejnosc jak FigureType w PLC
export const FIGURES_B = [ROOFS, WORKTOP, CURVED_STAIRS, BOOKS, QUATER_ROUND];
