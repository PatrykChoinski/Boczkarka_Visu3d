// Figury frezu / wiercenia (grupa C) vs formuly z FB PLC (FiguresGeometric/Functions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MILL, CONTEXT_DEFAULTS } from '../src/shared/figures/common.js';
import {
  FIGURES_C, RECTANGLE_CUTTED, HEART, RECTANGLE_CORNERS, HOLES, SINK_DRAINER, ELIPSE_ONE_POINT, ELIPSE_120_POINT,
  MILL_TABLE, L_CORNERS, INDUCTION, getElipsePositions,
} from '../src/shared/figures/groupC.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const defaults = (f) => Object.fromEntries(f.fields.map((x) => [x.k, x.d]));
const ctx = (o = {}) => ({ ...CONTEXT_DEFAULTS, ...o });   // millWidth 20, internal 0
const MILL_STEPS = new Set(Object.values(MILL));
const DEG = Math.PI / 180;

test('wszystkie figury grupy C: domyslne pola -> count+1 wierszy, liczby skonczone, kroki ProgramMillStep', () => {
  assert.deepEqual(FIGURES_C.map((f) => f.v), [40, 50, 60, 70, 90, 110, 120, 160, 180, 230]);
  for (const f of FIGURES_C) {
    for (const c of [ctx(), ctx({ internal: 1 }), ctx({ newStart: true, newStartX: -100, newStartY: -50 }), ctx({ machineNumber: 19 })]) {
      const b = f.build(defaults(f), c);
      assert.equal(b.rows.length, b.count + 1, f.id);
      assert.equal(f.kind, 'mill', f.id);
      for (const r of b.rows) {
        for (const k of ['x', 'y', 'step', 'r', 'angle', 'depth', 'depthEnd', 'length']) assert.ok(Number.isFinite(r[k]), `${f.id} ${k}`);
        assert.ok(MILL_STEPS.has(r.step), `${f.id} krok ${r.step}`);
      }
    }
  }
});

test('RECTANGLE_CUTTED: kompensacja frezu, promien z polowy szerokosci, 9 punktow', () => {
  const b = RECTANGLE_CUTTED.build(defaults(RECTANGLE_CUTTED), ctx());
  // L = 1000+20, W = 600+20, rw = 50+10
  assert.equal(b.count, 9);
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step], [0, 0, MILL.GoToPosition]);
  assert.deepEqual([b.rows[1].x, b.rows[1].y, b.rows[1].step], [0, 60, MILL.MillArcCCW]);
  assert.deepEqual([b.rows[3].x, b.rows[3].y, b.rows[3].step], [960, 0, MILL.MillArcCCW]);
  assert.deepEqual([b.rows[5].x, b.rows[5].y], [1020, 560]);
  assert.equal(b.rows[9].step, MILL.Nothing);
  assert.ok(b.rows.every((r) => r.r === 60));
  const n = RECTANGLE_CUTTED.build(defaults(RECTANGLE_CUTTED), ctx({ internal: 1, newStart: true, newStartX: -5, newStartY: -7 }));
  assert.equal(n.count, 10);
  assert.deepEqual([n.rows[0].x, n.rows[0].y, n.rows[0].step], [-5, -7, MILL.Mill]);
  assert.equal(n.rows[1].y, 40);   // rw = 50 - 10
  assert.deepEqual([n.rows[10].x, n.rows[10].y, n.rows[10].step], [-5, -7, MILL.Nothing]);
});

test('HEART: luki MillArcCW, promienie R1 = |P1P2|, R2 = L/4', () => {
  const b = HEART.build({ xs: 10, ys: 20, length: 400, height: 500 }, ctx());
  // L = 420, H = 520 -> P2 = (10-210, 20+390)
  assert.equal(b.count, 4);
  assert.deepEqual([b.rows[1].x, b.rows[1].y], [-200, 410]);
  near(b.rows[0].r, Math.hypot(210, 390));
  assert.equal(b.rows[1].r, 105);
  assert.equal(b.rows[3].r, b.rows[0].r);
  assert.deepEqual(b.rows.map((r) => r.step), [3, 3, 3, 3, 0]);
  assert.deepEqual([b.rows[4].x, b.rows[4].y], [10, 20]);
});

test('RECTANGLE_CORNERS: wiercenie, Y punktu 0 z X startu (blad PLC), glebokosc', () => {
  const b = RECTANGLE_CORNERS.build({ ...defaults(RECTANGLE_CORNERS), xs: 100, ys: 50 }, ctx());
  assert.equal(b.count, 4);
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step], [100, 130, MILL.Drilling]);   // Y = xs + R
  assert.deepEqual([b.rows[1].x, b.rows[1].y], [100 + 1020 - 30, 50]);
  assert.deepEqual([b.rows[2].x, b.rows[2].y], [100 + 1020, 50 + 620 - 30]);
  assert.equal(b.rows[4].step, MILL.Nothing);
  assert.ok(b.rows.every((r) => r.depth === 20));
  const a = RECTANGLE_CORNERS.build({ ...defaults(RECTANGLE_CORNERS), arc: true }, ctx());
  // rw = 30 - 10 (dla zewnetrznego tez minus)
  assert.equal(a.count, 8);
  assert.deepEqual([a.rows[1].x, a.rows[1].y], [0, 20]);
  assert.deepEqual([a.rows[3].x, a.rows[3].y], [1000, 0]);
  assert.equal(a.rows[8].step, MILL.Drilling);
});

test('HOLES: 4 otwory, rozstaw pomniejszony o 2x przesuniecie, start bez przesuniecia', () => {
  const b = HOLES.build(defaults(HOLES), ctx());
  assert.equal(b.count, 3);
  assert.deepEqual(b.rows.map((r) => [r.x, r.y, r.step, r.depth]), [[0, 0, 9, 30], [500, 0, 9, 30], [500, 300, 9, 30], [0, 300, 9, 30]]);
});

test('SINK_DRAINER: iNumber = RoundUp(W/skok)*2-1, spadek, glebokosci', () => {
  const b = SINK_DRAINER.build(defaults(SINK_DRAINER), ctx());
  assert.equal(b.count, 29);   // 300/20 = 15 -> 29
  const ang = Math.atan(6 / 400) * 180 / Math.PI;
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step, b.rows[0].depth, b.rows[0].depthEnd], [0, 0, MILL.MillSlopeDown, 2, 8]);
  assert.deepEqual([b.rows[1].x, b.rows[1].y, b.rows[1].step, b.rows[1].depth, b.rows[1].depthEnd], [400, 0, MILL.GoToPositionWithoutZ, 8, 8]);
  assert.deepEqual([b.rows[2].x, b.rows[2].y, b.rows[2].step], [400, 20, MILL.MillSlopeUp]);
  assert.deepEqual([b.rows[3].x, b.rows[3].y, b.rows[3].step, b.rows[3].depth, b.rows[3].depthEnd], [0, 20, MILL.GoToPositionWithoutZ, 2, 2]);
  assert.deepEqual([b.rows[29].x, b.rows[29].y], [400, 280]);
  near(b.rows[5].angle, ang);
  const k = SINK_DRAINER.build({ ...defaults(SINK_DRAINER), twoDepths: false, width: 310, angle: 1 }, ctx());
  assert.equal(k.count, 31);   // 310/20 = 15.5 -> 16 -> 31
  near(k.rows[0].depthEnd, Math.tan(1 * DEG) * 400);
  assert.equal(k.rows[0].angle, 1);
});

test('ELIPSE_ONE_POINT: jeden punkt ElipseOuter, aWidth w kolumnie kata; okrag dla L = W', () => {
  const b = ELIPSE_ONE_POINT.build(defaults(ELIPSE_ONE_POINT), ctx());
  assert.equal(b.count, 2);
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step, b.rows[0].length, b.rows[0].angle], [0, 0, MILL.ElipseOuter, 600, 400]);
  assert.equal(ELIPSE_ONE_POINT.build(defaults(ELIPSE_ONE_POINT), ctx({ internal: 1 })).rows[0].step, MILL.ElipseInner);
  const c = ELIPSE_ONE_POINT.build({ xs: 0, ys: 0, length: 400, width: 400 }, ctx());
  assert.deepEqual([c.rows[0].x, c.rows[0].y, c.rows[0].r, c.rows[0].step], [200, 200, 200, MILL.CircleTopPointOuter]);
  assert.deepEqual([c.rows[1].x, c.rows[1].y, c.rows[1].r, c.rows[1].step], [200, 200, 200, MILL.Nothing]);
  // nowy start: Mill w wierszu 2 (0, 0), pozycja startu w wierszu 3 - jak w PLC
  const n = ELIPSE_ONE_POINT.build(defaults(ELIPSE_ONE_POINT), ctx({ newStart: true, newStartX: -10, newStartY: -20 }));
  assert.equal(n.count, 3);
  assert.deepEqual(n.rows.map((r) => [r.x, r.y, r.step]), [[-10, -20, 1], [0, 0, 31], [0, 0, 1], [-10, -20, 0]]);
});

test('ELIPSE_120_POINT: 120 punktow MillArcCW, wzory z GetElipsePositions', () => {
  const b = ELIPSE_120_POINT.build(defaults(ELIPSE_120_POINT), ctx());
  // L = 620, W = 420 -> a = 310, b = 210; i = 20: n = 20*310/200 = 31, x = -279
  assert.equal(b.count, 120);
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step], [0, 0, MILL.MillArcCW]);
  near(b.rows[20].x, 31);
  near(b.rows[20].y, Math.sqrt(1 - 279 ** 2 / 310 ** 2) * 210);
  near(b.rows[60].x, 620);   // stala 10*20/19 = 10 (INT) -> gorna polowka konczy sie w x = a
  assert.equal(b.rows[120].step, MILL.Nothing);
  assert.equal(b.rows.slice(0, 120).filter((r) => r.step === MILL.MillArcCW).length, 120);
  assert.ok(b.rows.every((r) => r.r === 0));   // aRadius z GetElipse_0 - dla elipsy zera
  // FB: aRadius = MAX(fLength, fWidth) po kompensacji
  assert.equal(getElipsePositions({ fStartXPosition: 0, fStartYPosition: 0, fLength: 600, fWidth: 400, iNumber: 120, iInner: 0, bBladeWidth: true, fParameterBladeWidth: 20 }).aRadius[5], 620);
  // okrag (L = W): iElipseNumber nadpisany na iNumber = 120
  const c = ELIPSE_120_POINT.build({ xs: 0, ys: 0, length: 400, width: 400 }, ctx());
  assert.equal(c.count, 120);
  assert.deepEqual([c.rows[0].x, c.rows[0].y, c.rows[0].step, c.rows[0].r], [210, 210, MILL.CircleTopPointOuter, 200]);
  const n = ELIPSE_120_POINT.build(defaults(ELIPSE_120_POINT), ctx({ newStart: true, newStartX: -1, newStartY: -2 }));
  assert.equal(n.count, 122);
  assert.deepEqual([n.rows[121].step, n.rows[122].x, n.rows[122].y], [MILL.Mill, -1, -2]);
});

test('MILL_TABLE: skok = szer. frezu - 2, iNumber+3, X koncowki = 0 (PLC)', () => {
  const b = MILL_TABLE.build({ ...defaults(MILL_TABLE), xs: 100 }, ctx());
  // skok 18, 300/18 = 16.67 -> 17*2 = 34 -> 37
  assert.equal(b.count, 37);
  assert.deepEqual([b.rows[0].x, b.rows[0].y, b.rows[0].step], [100, 0, MILL.MillWithoutZ]);
  assert.deepEqual([b.rows[1].x, b.rows[1].y, b.rows[1].step], [1100, 0, MILL.GoToPositionWithoutZ]);
  assert.deepEqual([b.rows[2].x, b.rows[2].y, b.rows[2].step], [1100, 18, MILL.MillWithoutZ]);
  assert.deepEqual([b.rows[34].x, b.rows[34].y, b.rows[34].step], [1100, 300, MILL.MillWithoutZ]);
  assert.deepEqual([b.rows[35].x, b.rows[35].y, b.rows[35].step], [0, 300, MILL.GoToPosition]);
  assert.deepEqual([b.rows[36].x, b.rows[36].y, b.rows[36].step], [0, 300, MILL.Nothing]);
  assert.equal(b.rows[34].depth, 2);
  assert.equal(b.rows[35].depth, 0);
});

test('L_CORNERS: ramie = fHeight - frez/2, 16 punktow + pusty wiersz', () => {
  const b = L_CORNERS.build(defaults(L_CORNERS), ctx());
  // L = 1020, W = 620, h = 90
  assert.equal(b.count, 16);
  assert.deepEqual([b.rows[1].x, b.rows[1].y, b.rows[1].step], [0, 90, MILL.GoToPosition]);
  assert.deepEqual([b.rows[5].x, b.rows[5].y], [930, 0]);
  assert.deepEqual([b.rows[9].x, b.rows[9].y], [1020, 530]);
  assert.deepEqual([b.rows[15].x, b.rows[15].y, b.rows[15].step], [0, 530, MILL.Nothing]);
  assert.deepEqual([b.rows[16].x, b.rows[16].y, b.rows[16].step], [0, 0, 0]);
  const n = L_CORNERS.build(defaults(L_CORNERS), ctx({ newStart: true, newStartX: -3, newStartY: -9 }));
  assert.equal(n.count, 17);
  assert.deepEqual([n.rows[0].x, n.rows[0].y, n.rows[0].step], [-3, -3, MILL.Nothing]);   // Y := X, krok 0 (PLC)
});

test('INDUCTION: prostokat - frez, ChangeDepth, ramka odsunieta o fFigureAngle', () => {
  const b = INDUCTION.build(defaults(INDUCTION), ctx());
  // L = 540, W = 470, ad = 20
  assert.equal(b.count, 10);
  assert.deepEqual([b.rows[2].x, b.rows[2].y, b.rows[2].step], [540, 470, MILL.Mill]);
  assert.deepEqual([b.rows[4].step, b.rows[5].step], [MILL.GoToPosition, MILL.ChangeDepth]);
  assert.deepEqual([b.rows[7].x, b.rows[7].y], [560, -20]);
  assert.deepEqual([b.rows[8].x, b.rows[8].y], [560, 490]);
  assert.deepEqual([b.rows[10].x, b.rows[10].y, b.rows[10].step], [-20, -20, MILL.Nothing]);
  assert.ok(b.rows.every((r) => r.depth === 10));
  const n = INDUCTION.build(defaults(INDUCTION), ctx({ newStart: true, newStartX: -50, newStartY: -60 }));
  assert.equal(n.count, 14);
  assert.deepEqual([n.rows[7].x, n.rows[7].y, n.rows[7].step], [-50, -60, MILL.ChangeDepth]);
  assert.deepEqual([n.rows[13].x, n.rows[13].y], [-20, -20]);
});
