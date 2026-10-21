// Figury automatu (PLC: FiguresGeometric) - wspolny kontrakt.
//
// W PLC program FiguresGeometricSt przepisuje pola z HMI (fFigureXStartPosition, fFigureLength, ...) na wejscia
// bloku funkcyjnego figury (GetRectanglePositions_1, GetTriangleRectPositions, ...), blok liczy tablice
// aIndex / aXPositions / aYPositions / (aRadius, aDepth..., aAngle, aLength) [0..249] i iNumber, a FiguresGeometricSt
// przepisuje je do aFigure* - te potem trafiaja do bufora automatu jak w GetDemoProgram:
//   aProgramXPosition := aFigureXPosition, aProgramYPosition := aFigureYPosition, aProgramNextStep := aFigureIndex,
//   aProgramRadius := aFigureRadius, aProgramAngle := aFigureAngle, aProgramDepth := aFigureDepthStart,
//   aProgramDepthEnd := aFigureDepthEnd, aProgramLength := aFigureLength, iProgramCutNumber := iFigureNumber.
//
// Figura w tej aplikacji: {id, v (FigureType), name, kind ('cut' - ProgramAutoCutST, 'profile' - ProgramAutoProfileST,
// 'mill' - ProgramAutoMillST: bufor jak w PLC, bez symulacji ruchu), plc (nazwa FB), fields (jak pola operacji),
// build(v, ctx) -> buffer}.  buffer = {rows: [{x, y, step, r, angle, depth, depthEnd, length, outIn}], count}:
// rows[i] = element i tablic PLC dla i = 0..count (count = iNumber), kolumny, ktorych FiguresGeometricSt nie
// przepisuje dla danej figury, = 0 (w PLC zostalyby wartosci poprzedniej figury).

export const DEG = Math.PI / 180;   // SMC_FACTOR_DEG_TO_RAD

// ProgramCutStep (PLC)
export const CUT = {
  Nothing: 0, Cut: 1, GoToPosition: 2, CutArcCW: 3, CutArcCCW: 4, CutInnerFull: 5, CutInnerStart: 6, CutInnerEnd: 7,
  ProfileConvexX: 8, ProfileConvexY: 9, ProfileConcaveX: 10, ProfileConcaveY: 11, Slope: 12, SlopeReverse: 13,
  SlopeDouble: 14, SmoothingConvexX: 15, SmoothingConvexY: 16, SmoothingConcaveX: 17, SmoothingConcaveY: 18,
  ChangeDepth: 19, SlopeInner: 20, SlopeInnerReverse: 21, CutReverse: 22, CutInnerReverse: 23,
  CircleTopPointOuter: 25, CircleCenterPointOuter: 26, Confirm: 27, CircleTopPointInner: 29, CircleCenterPointInner: 30,
};

// ProgramMillStep (PLC)
export const MILL = {
  Nothing: 0, Mill: 1, GoToPosition: 2, MillArcCW: 3, MillArcCCW: 4, MillInnerFull: 5, GoToPositionWithoutZ: 6,
  MillSlopeDown: 7, MillSlopeUp: 8, Drilling: 9, ChangeDepth: 19, CircleTopPointOuter: 25, CircleCenterPointOuter: 26,
  Confirm: 27, MillWithoutZ: 28, CircleTopPointInner: 29, CircleCenterPointInner: 30, ElipseOuter: 31, ElipseInner: 32,
};

// Tablice wyjsciowe FB jak w PLC: [0..249], zerowane (metoda Clear)
export const SIZE = 250;
export function arrays(...names) {
  return Object.fromEntries(names.map((n) => [n, new Array(SIZE).fill(0)]));
}

// Bufor z tablic FB: map - {kolumna bufora: tablica FB}, count = iNumber
export function toBuffer(map, count) {
  const n = Math.max(0, Math.min(SIZE - 1, Math.round(count)));
  const rows = [];
  for (let i = 0; i <= n; i++) {
    rows.push({
      x: map.x?.[i] ?? 0, y: map.y?.[i] ?? 0, step: map.step?.[i] ?? 0, r: map.r?.[i] ?? 0, angle: map.angle?.[i] ?? 0,
      depth: map.depth?.[i] ?? 0, depthEnd: map.depthEnd?.[i] ?? 0, length: map.length?.[i] ?? 0, outIn: map.outIn?.[i] ?? 0,
    });
  }
  return { rows, count: n };
}

// Kontekst - zmienne globalne / serwisowe uzywane przez FiguresGeometricSt i bloki figur (wartosci z PLC albo domyslne)
export const CONTEXT_DEFAULTS = {
  bladeWidth: 4,              // fParameterBladeWidth
  millWidth: 20,              // fParameterMillWidth
  internal: 0,                // iManualInternal (0 zewn., 1 wewn., 2 wewn. poczatek, 3 wewn. koniec)
  additional: false,          // bManualAdditionalDistance
  additionalDistance: 0,      // fManualAdditionalDistance
  blocksReverse: true,        // bServiceBlocksReverse
  rectangleACBD: false,       // bServiceRectangleACBD
  materialThickness: 40,      // fParameterMaterialThickness
  zAbove: 20,                 // fParameterZMoveAboveMaterial
  roofCorrectionX: 0,         // fParameterRoofCorrectionX
  roofCorrectionY: 0,         // fParameterRoofCorrectionY
  modeMill: false,            // bModeMill - ta aplikacja symuluje pile
  newStart: false,            // bServiceMillProgramNewStartPoints
  newStartX: 0,               // fProgramMillStartPointX - fProgramStartPositionX
  newStartY: 0,
  machineNumber: 0,           // iMachineNumber
  bookMinimalRadius: false,   // bServiceBookMinimalRadius (ksiazki: promien z GetMinimalRadius zamiast fLength/2)
};
