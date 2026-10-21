// Figury grupy B (daszki, blat, schody lukowe, ksiazki, cwiercwalek) vs wzory z FB PLC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUT, CONTEXT_DEFAULTS } from '../src/shared/figures/common.js';
import {
  FIGURES_B, ROOFS, WORKTOP, CURVED_STAIRS, BOOKS, QUATER_ROUND,
  getAdditionalDistance, getRoofPositions, completeLengths, getMinimalRadius, getBookPositions, getQuaterRoundPositions,
} from '../src/shared/figures/groupB.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const defaults = (f) => Object.fromEntries(f.fields.map((x) => [x.k, x.d]));
const ctx = { ...CONTEXT_DEFAULTS };
const STEPS = new Set(Object.values(CUT));
const eqRows = (rows, exp) => {
  assert.equal(rows.length, exp.length);
  exp.forEach(([x, y, s], i) => { near(rows[i].x, x); near(rows[i].y, y); assert.equal(rows[i].step, s, `step ${i}`); });
};

test('kolejnosc i opis figur jak FigureType', () => {
  assert.deepEqual(FIGURES_B.map((f) => [f.id, f.v]), [['ROOFS', 80], ['WORKTOP', 150], ['CURVED_STAIRS', 170], ['BOOKS', 200], ['QUATER_ROUND', 210]]);
  assert.deepEqual(FIGURES_B.map((f) => f.kind), ['cut', 'cut', 'cut', 'profile', 'profile']);
});

for (const f of FIGURES_B) {
  test(`${f.id}: bufor z domyslnych wartosci`, () => {
    const buf = f.build(defaults(f), ctx);
    assert.equal(buf.rows.length, buf.count + 1);
    assert.ok(buf.count > 0);
    for (const r of buf.rows) {
      for (const k of ['x', 'y', 'step', 'r', 'angle', 'depth', 'depthEnd', 'length']) assert.ok(Number.isFinite(r[k]), `${k} = ${r[k]}`);
      assert.ok(STEPS.has(r.step), `krok ${r.step}`);
    }
    assert.equal(buf.rows[buf.count].step, CUT.Nothing);
  });
}

test('ROOFS: GetAdditionalDistance = TAN(kat) * grubosc (+ reczna), wewn./90 st. = 0', () => {
  near(getAdditionalDistance({ fAngle: 45, fDepth: 40, iInner: 0 }).fAdditionalDistance, 40);
  near(getAdditionalDistance({ fAngle: 30, fDepth: 30, iInner: 0, bManualAdditionalDistance: true, fManualAdditionalDistance: 5 }).fAdditionalDistance, Math.tan(Math.PI / 6) * 30 + 5);
  assert.equal(getAdditionalDistance({ fAngle: 90, fDepth: 40, iInner: 0 }).fAdditionalDistance, 0);
  assert.equal(getAdditionalDistance({ fAngle: 45, fDepth: 40, iInner: 1 }).fAdditionalDistance, 0);
});

test('ROOFS: 4 sciany, ad = 40 (45 st., grubosc 40), iInner FB zawsze 0', () => {
  const buf = ROOFS.build(defaults(ROOFS), ctx);
  assert.equal(buf.count, 7);
  eqRows(buf.rows, [
    [-40, 0, CUT.SlopeReverse], [1040, 0, CUT.GoToPosition], [1000, -40, CUT.SlopeReverse], [1000, 640, CUT.GoToPosition],
    [1040, 600, CUT.Slope], [-40, 600, CUT.GoToPosition], [0, 640, CUT.Slope], [0, -40, CUT.Nothing],
  ]);
  assert.ok(buf.rows.every((r) => r.angle === 45));
  // iManualInternal = 1: ad = 0, ale kroki nadal Slope/SlopeReverse (GetRoofPositions_0.iInner nieustawiane)
  const inner = ROOFS.build({ ...defaults(ROOFS), inner: true }, { ...ctx, internal: 1 });
  eqRows(inner.rows.slice(0, 2), [[0, 0, CUT.Slope], [1000, 0, CUT.GoToPosition]]);
  assert.equal(inner.rows[4].step, CUT.SlopeReverse);
});

test('ROOFS: korekty X/Y tylko w czesci punktow, sciany 2 i 4', () => {
  const out = getRoofPositions({
    fStartXPosition: 100, fStartYPosition: 50, fLength: 1000, fWidth: 600, fAngle: 0, fBAngle: 30, fAdditionalDistance: 10,
    fRoofCorrectionX: 2, fRoofCorrectionY: 3, iInner: 0, bRoofInner: true, bWall1: false, bWall2: true, bWall3: false, bWall4: true,
  });
  assert.equal(out.iNumber, 3);
  // sciana 2: X + korektaX; koniec sciany 2 (dalej sciana 4) - GoToPosition
  near(out.aXPositions[0], 100 + 1000 + 2); near(out.aYPositions[0], 50 - 10); assert.equal(out.aIndex[0], CUT.Slope);
  near(out.aXPositions[1], 1102); near(out.aYPositions[1], 50 + 600 + 10 + 3); assert.equal(out.aIndex[1], CUT.GoToPosition);
  // sciana 4: bRoofInner -> SlopeReverse
  near(out.aXPositions[2], 100); near(out.aYPositions[2], 50 + 600 + 10 + 3); assert.equal(out.aIndex[2], CUT.SlopeReverse);
  near(out.aXPositions[3], 100); near(out.aYPositions[3], 40); assert.equal(out.aIndex[3], CUT.Nothing);
  // bez scian: iNumber = -1
  assert.equal(getRoofPositions({ fStartXPosition: 0, fStartYPosition: 0, fLength: 1, fWidth: 1, fAngle: 0 }).iNumber, -1);
});

test('WORKTOP: CompleteLengths uzupelnia G i H z domkniecia obrysu', () => {
  const r = completeLengths(0, [3000, 600, 1000, 400, 1500, 300, 0, 0]);
  assert.ok(r.ok);
  // A - C - E - G = 0, B + D - F - H = 0
  assert.deepEqual(r.aLengthsCalc, [3000, 600, 1000, 400, 1500, 300, 500, 700]);
  // dwa puste w grupie -> blad
  assert.equal(completeLengths(0, [3000, 600, 0, 400, 0, 300, 0, 0]).ok, false);
  // bez pustych - ostatni bok grupy wyliczany (nadpisywany)
  assert.deepEqual(completeLengths(2, [1000, 500, 400, 300, 600, 999]).aLengthsCalc, [1000, 500, 400, 300, 600, 800, 0, 0]);
  assert.throws(() => WORKTOP.build({ ...defaults(WORKTOP), lengths: '3000, 600, 0, 400, 0' }, ctx), /Blat/);
});

test('WORKTOP Full: wierzcholki + grubosc pily (4) w +X/+Y, naroza wklesle', () => {
  const buf = WORKTOP.build(defaults(WORKTOP), ctx);
  assert.equal(buf.count, 8);
  eqRows(buf.rows, [
    [0, 0, CUT.Cut], [3004, 0, CUT.Cut], [3004, 604, CUT.CutInnerEnd], [2004, 604, CUT.CutInnerStart],
    [2004, 1004, CUT.Cut], [500, 1004, CUT.CutInnerEnd], [500, 704, CUT.CutInnerStart], [0, 704, CUT.Cut], [0, 0, CUT.Nothing],
  ]);
  // lista jako tablica i przesuniety start
  const b2 = WORKTOP.build({ xs: 10, ys: 20, type: 2, lengths: [1000, 500, 400, 300, 600, 0] }, ctx);
  assert.equal(b2.count, 6);
  near(b2.rows[0].x, 10); near(b2.rows[0].y, 20); near(b2.rows[6].x, 10); near(b2.rows[6].y, 20);
});

test('CURVED_STAIRS: alfa = ASIN(L/2/R) przed gruboscia pily', () => {
  const buf = CURVED_STAIRS.build(defaults(CURVED_STAIRS), ctx);
  const alfa = Math.asin(500 / 2000);
  assert.equal(buf.count, 4);
  eqRows(buf.rows, [
    [-2, 0, CUT.CutArcCW], [1002, 0, CUT.Cut],
    [1002 - Math.sin(alfa) * 300, -Math.cos(alfa) * 300 - 4, CUT.CutArcCCW], [-2 + Math.sin(alfa) * 300, -Math.cos(alfa) * 300 - 4, CUT.Cut],
    [-2, 0, CUT.Nothing],
  ]);
  assert.deepEqual(buf.rows.map((r) => r.r), [2002, 2002, 1702, 1702, 2002]);
  assert.throws(() => CURVED_STAIRS.build({ ...defaults(CURVED_STAIRS), radius: 400 }, ctx), /promień/);
});

test('BOOKS: punkty co L/4, promien L/2 (bez bServiceBookMinimalRadius), wygladzanie iNumber = 10', () => {
  const buf = BOOKS.build(defaults(BOOKS), ctx);
  assert.equal(buf.count, 4);
  eqRows(buf.rows, [[0, 0, CUT.ProfileConvexX], [250, 0, CUT.ProfileConcaveX], [500, 0, CUT.ProfileConcaveX], [750, 0, CUT.ProfileConvexX], [1000, 0, CUT.Nothing]]);
  assert.ok(buf.rows.every((r) => r.r === 500 && r.length === 300 && r.depth === 20 && r.depthEnd === 20));
  const s = BOOKS.build({ ...defaults(BOOKS), smoothing: true, bookType: 1 }, ctx);
  assert.equal(s.count, 10);
  assert.deepEqual(s.rows.map((r) => r.step), [10, 8, 8, 10, CUT.GoToPosition, 17, 15, 15, 17, CUT.Nothing, CUT.Nothing]);
  // punkt 10 wyzerowany (jak w PLC)
  assert.equal(s.rows[10].x, 0); near(s.rows[9].x, 1000);
});

test('BOOKS: GetMinimalRadius i rozne glebokosci', () => {
  // rowne glebokosci: (d^2 + (L/2)^2) / 2d
  near(getMinimalRadius(20, 20, 250), (400 + 125 ** 2) / 40);
  near(getMinimalRadius(0, 0, 250), 125);
  assert.equal(getMinimalRadius(0, 0, 0), 0);
  const L = 250; const s = 10; const e = 30; const dd = s - e;
  const lim = ((s + e) * (L * L + dd * dd)) / (2 * dd * dd) - (L * Math.sqrt(s * e * (L * L + dd * dd))) / (dd * dd);
  near(getMinimalRadius(s, e, L), Math.max(Math.sqrt(L * L + dd * dd) / 2, lim));
  const out = getBookPositions({
    fStartXPosition: 0, fStartYPosition: 0, fLength: 1000, fWidth: 300, fDepth: 10, fDepth2: 30, fDepth3: 20, fDepth4: 20, fDepth5: 5,
    bBookMultipleDepth: true, iBookType: 0, bCalculateJump: true, fParameterBladeWidth: 4,
  }, { bServiceBookMinimalRadius: true });
  assert.deepEqual([out.aDepthStart[0], out.aDepthEnd[0], out.aDepthStart[3], out.aDepthEnd[3], out.aDepthStart[4]], [10, 30, 20, 5, 0]);
  near(out.aRadius[0], getMinimalRadius(10, 30, 250));
  near(out.aRadius[2], getMinimalRadius(20, 20, 250));
  assert.equal(out.aRadius[4], 0);
  near(out.globals.fProfileJump, 3.9);
  assert.equal(out.globals.fCutDepthCutHeight, 20);
});

test('QUATER_ROUND: pojedynczy X - ostatni punkt (0, 0), promien = glebokosc', () => {
  const buf = QUATER_ROUND.build({ ...defaults(QUATER_ROUND), xs: 100, ys: 50 }, ctx);
  assert.equal(buf.count, 2);
  eqRows(buf.rows, [[100, 50, CUT.ProfileConvexX], [120, 50, CUT.Nothing], [0, 0, CUT.Nothing]]);
  assert.deepEqual(buf.rows.map((r) => [r.r, r.depth, r.depthEnd, r.length]), [[20, 20, 0, 300], [20, 0, 0, 300], [20, 0, 0, 300]]);
});

test('QUATER_ROUND: podwojny Y z wygladzaniem', () => {
  const out = getQuaterRoundPositions({
    fStartXPosition: 0, fStartYPosition: 0, fLength: 600, fWidth: 300, fDepth: 20, iType: 1, bX: false, bSmoothing: true,
    bCalculateJump: true, fParameterBladeWidth: 4,
  });
  assert.equal(out.iNumber, 8);
  const exp = [
    [0, 0, CUT.ProfileConvexY], [0, 20, CUT.GoToPosition], [0, 580, CUT.ProfileConvexY], [0, 600, CUT.GoToPosition],
    [0, 0, CUT.SmoothingConvexY], [0, 20, CUT.GoToPosition], [0, 580, CUT.SmoothingConvexY], [0, 600, CUT.Nothing], [0, 0, CUT.Nothing],
  ];
  exp.forEach(([x, y, s], i) => { near(out.aXPositions[i], x); near(out.aYPositions[i], y); assert.equal(out.aIndex[i], s, `step ${i}`); });
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => [out.aDepthStart[i], out.aDepthEnd[i]]), [[20, 0], [0, 0], [0, 20], [0, 0], [20, 0], [0, 0], [0, 20]]);
  assert.equal(out.aRadius[100], 20); assert.equal(out.aRadius[101], 0);
  assert.deepEqual(out.globals, { fProfileJump: 3.9, fCutDepthCutHeight: 20, fSmoothingJump: 4 });
});
