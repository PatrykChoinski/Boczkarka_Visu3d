// Prostokat - FigureType.RECTANGLE (10), PLC: GetRectanglePositions_1 (wywolywany w FiguresGeometricSt).
// Wzor dla pozostalych figur: funkcja 1:1 z FB (te same nazwy wejsc), potem definicja figury z polami HMI
// i mapowaniem wyjsc jak w FiguresGeometricSt.

import { DEG, CUT, MILL, arrays, toBuffer } from './common.js';

// GetRectanglePositions_1 - p: wejscia FB (bBladeWidth, fStartXPosition, ...); zwraca {aXPositions, aYPositions, aIndex, iNumber}
export function getRectanglePositions1(p, g) {
  const { aXPositions, aYPositions, aIndex } = arrays('aXPositions', 'aYPositions', 'aIndex');
  let { fLength, fWidth } = p;
  const { fStartXPosition: sx, fStartYPosition: sy, fAngle, fAdditionalDistance: ad } = p;
  if (p.bBladeWidth) {
    if (p.iInner >= 1) { fLength -= p.fParameterBladeWidth; fWidth -= p.fParameterBladeWidth; } else { fLength += p.fParameterBladeWidth; fWidth += p.fParameterBladeWidth; }
  }
  let iAction; let iAction2;
  if (p.bMill) {
    iAction = MILL.Mill; iAction2 = MILL.Mill;
  } else if (p.iInner >= 1) {
    iAction = CUT.CutInnerFull; iAction2 = g.bServiceBlocksReverse ? CUT.CutInnerReverse : CUT.CutInnerFull;
  } else {
    iAction = CUT.Cut; iAction2 = g.bServiceBlocksReverse ? CUT.CutReverse : CUT.Cut;
  }
  const c = Math.cos(fAngle * DEG);
  const s = Math.sin(fAngle * DEG);
  const set = (i, x, y, a) => { aXPositions[i] = x; aYPositions[i] = y; aIndex[i] = a; };
  let iNumber;
  if (p.bAdditional) {
    set(0, sx - c * ad, sy - s * ad, iAction);
    set(1, sx + c * fLength + c * ad, sy + s * fLength + s * ad, CUT.GoToPosition);
    set(2, sx + c * fLength + s * ad, sy + s * fLength - c * ad, iAction2);
    set(3, sx + c * fLength - s * fWidth - s * ad, sy + s * fLength + c * fWidth + c * ad, CUT.GoToPosition);
    set(4, sx + c * fLength - s * fWidth + c * ad, sy + s * fLength + c * fWidth + s * ad, iAction);
    set(5, sx - s * fWidth - c * ad, sy + c * fWidth - s * ad, CUT.GoToPosition);
    set(6, sx - s * fWidth - s * ad, sy + c * fWidth + c * ad, iAction2);
    set(7, sx + s * ad, sy - c * ad, CUT.Nothing);
    iNumber = 7;
  } else if (!p.bNewStartingPosition) {
    set(0, sx, sy, iAction);
    set(1, sx + c * fLength, sy + s * fLength, iAction2);
    set(2, sx + c * fLength - s * fWidth, sy + s * fLength + c * fWidth, iAction);
    set(3, sx - s * fWidth, sy + c * fWidth, iAction2);
    set(4, sx, sy, CUT.Nothing);
    aIndex[5] = CUT.Nothing; aIndex[6] = CUT.Nothing; aIndex[7] = CUT.Nothing;
    iNumber = 4;
  } else {
    set(0, p.fNewStartingPositionX, p.fNewStartingPositionY, iAction);
    set(1, sx, sy, iAction);
    set(2, sx + c * fLength, sy + s * fLength, iAction);
    set(3, sx + c * fLength - s * fWidth, sy + s * fLength + c * fWidth, iAction);
    set(4, sx - s * fWidth, sy + c * fWidth, iAction);
    set(5, sx, sy, iAction);
    set(6, p.fNewStartingPositionX, p.fNewStartingPositionY, CUT.Nothing);
    aIndex[7] = CUT.Nothing;
    iNumber = 6;
  }
  if (p.bRoofInner) {
    const rc = p.fRoofCorrection;
    aXPositions[2] += c * rc; aYPositions[2] += s * rc;
    aXPositions[3] += c * rc; aYPositions[3] += s * rc;
    aXPositions[4] += s * rc; aYPositions[4] += c * rc;
    aXPositions[5] += s * rc; aYPositions[5] += c * rc;
  }
  // zamiana bokow na ACBD
  if (p.bACBD && !p.bNewStartingPosition) {
    const tx = aXPositions.slice();
    const ty = aYPositions.slice();
    const order = p.bAdditional
      ? [[0, iAction], [1, CUT.GoToPosition], [4, iAction], [5, CUT.GoToPosition], [2, iAction], [3, CUT.GoToPosition], [6, iAction], [7, CUT.GoToPosition]]
      : [[0, iAction], [1, CUT.GoToPosition], [3, iAction], [2, CUT.GoToPosition], [1, iAction], [2, CUT.GoToPosition], [3, iAction], [0, CUT.GoToPosition]];
    order.forEach(([k, a], i) => set(i, tx[k], ty[k], a));
  }
  // jak w PLC: na koncu zawsze iNumber := 7 (takze bez dodatkowej drogi - punkty 5..7 to wtedy Nothing)
  iNumber = 7;
  return { aXPositions, aYPositions, aIndex, iNumber };
}

export const RECTANGLE = {
  id: 'RECTANGLE', v: 10, name: 'Prostokąt', kind: 'cut', plc: 'GetRectanglePositions_1',
  fields: [
    { k: 'xs', label: 'Start X (fFigureXStartPosition)', t: 'num', d: 0 },
    { k: 'ys', label: 'Start Y (fFigureYStartPosition)', t: 'num', d: 0 },
    { k: 'length', label: 'Długość (fFigureLength)', t: 'num', d: 1000 },
    { k: 'width', label: 'Szerokość (fFigureWidth)', t: 'num', d: 600 },
    { k: 'angle', label: 'Kąt [°] (fFigureAngle)', t: 'num', d: 0 },
  ],
  // FiguresGeometricSt, FigureType.RECTANGLE (tryb pily: bModeMill = FALSE)
  build(v, ctx) {
    const mill = ctx.modeMill;
    const out = getRectanglePositions1({
      bBladeWidth: false,       // w FiguresGeometricSt nieustawiane - FALSE
      fStartXPosition: v.xs, fStartYPosition: v.ys, fLength: v.length, fWidth: v.width, fAngle: v.angle,
      bAdditional: ctx.additional, fAdditionalDistance: ctx.additionalDistance, iInner: ctx.internal,
      bRoofInner: false, fRoofCorrection: 0,
      bACBD: mill ? false : ctx.rectangleACBD,
      fParameterBladeWidth: mill ? ctx.millWidth : ctx.bladeWidth,
      bMill: mill, bNewStartingPosition: mill ? ctx.newStart : false,
      fNewStartingPositionX: mill ? ctx.newStartX : 0, fNewStartingPositionY: mill ? ctx.newStartY : 0,
    }, { bServiceBlocksReverse: ctx.blocksReverse });
    // FiguresGeometricSt przepisuje: aIndex, aXPositions, aYPositions, iNumber
    return toBuffer({ x: out.aXPositions, y: out.aYPositions, step: out.aIndex }, out.iNumber);
  },
};
