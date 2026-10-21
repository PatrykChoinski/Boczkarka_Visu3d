// Figury grupy A (trojkaty, trapezy, krzyz, wielokat): bufor jak w PLC (FiguresGeometricSt + Get*Positions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUT, CONTEXT_DEFAULTS } from '../src/shared/figures/common.js';
import { FIGURES_A, getTrapezoidPositions, TRAPEZOID_TYPE } from '../src/shared/figures/groupA.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const STEPS = new Set(Object.values(CUT));
const fig = (id) => FIGURES_A.find((f) => f.id === id);
const defaults = (f) => Object.fromEntries(f.fields.map((x) => [x.k, x.d]));
const build = (id, over = {}, ctx = {}) => {
  const f = fig(id);
  return f.build({ ...defaults(f), ...over }, { ...CONTEXT_DEFAULTS, ...ctx });
};
const pt = (b, i) => [b.rows[i].x, b.rows[i].y];
const nearPt = (b, i, x, y) => { near(b.rows[i].x, x); near(b.rows[i].y, y); };
const steps = (b) => b.rows.map((r) => r.step);

test('kolejnosc i wartosci FigureType', () => {
  assert.deepEqual(FIGURES_A.map((f) => [f.id, f.v]), [
    ['TRIANGLE_RECT', 20], ['TRIANGLE_EQUAL', 25], ['TRIANGLE_ISOS', 30], ['TRAPEZOID', 130], ['TRAPEZOID45', 140],
    ['CROSS', 190], ['POLYGON', 220],
  ]);
});

for (const f of FIGURES_A) {
  test(`${f.id}: bufor z domyslnymi polami`, () => {
    assert.equal(f.kind, 'cut');
    const b = f.build(defaults(f), { ...CONTEXT_DEFAULTS });
    assert.ok(b.count > 0);
    assert.equal(b.rows.length, b.count + 1);
    for (const r of b.rows) {
      for (const k of ['x', 'y', 'r', 'angle', 'depth', 'depthEnd', 'length']) assert.ok(Number.isFinite(r[k]), `${k} = ${r[k]}`);
      assert.ok(STEPS.has(r.step), `krok ${r.step}`);
    }
    assert.equal(b.rows[b.count].step, CUT.Nothing);
  });
}

test('TRIANGLE_RECT: punkty + szerokosc tarczy (zewn.)', () => {
  const b = build('TRIANGLE_RECT');   // podstawa 1000, wys. 600, tarcza 4
  assert.equal(b.count, 3);
  assert.deepEqual(steps(b), [CUT.Cut, CUT.Cut, CUT.Cut, CUT.Nothing]);
  nearPt(b, 0, 0, 0);
  nearPt(b, 1, 1004, 0);
  nearPt(b, 2, 0, 604);
  nearPt(b, 3, 0, 0);
  // kat 90: X1 = -SIN*... -> podstawa wzdluz Y, wysokosc w -X; wewn.: odjecie szerokosci
  const r = build('TRIANGLE_RECT', { xs: 100, ys: 50, angle: 90 }, { internal: 1 });
  nearPt(r, 1, 100, 50 + 1000 - 4);
  nearPt(r, 2, 100 - 600 + 4, 50);
});

test('TRIANGLE_RECT: dodatkowa droga - aIndex[1] = Nothing jak w PLC (linia 41)', () => {
  const b = build('TRIANGLE_RECT', {}, { additional: true, additionalDistance: 50 });
  assert.equal(b.count, 5);
  assert.deepEqual(steps(b), [CUT.Cut, CUT.Nothing, CUT.Cut, CUT.GoToPosition, CUT.Cut, CUT.Nothing]);
  // fAdditionalDistance nieustawiane w FiguresGeometricSt -> 0
  nearPt(b, 0, 0, 0);
  nearPt(b, 1, 1004, 0);
});

test('TRIANGLE_EQUAL: wierzcholek', () => {
  const b = build('TRIANGLE_EQUAL');
  assert.equal(b.count, 3);
  nearPt(b, 1, 1004, 0);
  nearPt(b, 2, 500, Math.sqrt(3) / 2 * 1000 + 4);
});

test('TRIANGLE_ISOS: wierzcholek + dodatkowa droga (aIndex[3] = Nothing, linia 50)', () => {
  const b = build('TRIANGLE_ISOS');
  nearPt(b, 2, 500, 604);
  const a = build('TRIANGLE_ISOS', { height: 400 }, { additional: true });
  assert.deepEqual(steps(a), [CUT.Cut, CUT.GoToPosition, CUT.Cut, CUT.Nothing, CUT.Cut, CUT.Nothing]);
  nearPt(a, 3, 500 - 0, 400 + 4);
});

test('TRAPEZOID: rownoramienny z korekta 4/SIN(alfa)', () => {
  const b = build('TRAPEZOID');   // L 1000, W 600, H 400 -> alfa = ATAN(2)
  const sin = 2 / Math.sqrt(5);
  assert.equal(b.count, 4);
  assert.deepEqual(steps(b), [CUT.Cut, CUT.Cut, CUT.Cut, CUT.Cut, CUT.Nothing]);
  nearPt(b, 1, 1000 + 4 / sin, 0);
  nearPt(b, 2, 800 + 4 / sin - 2, 404);
  nearPt(b, 3, 202, 404);
  nearPt(b, 4, 0, 0);
});

test('TRAPEZOID: prostokatny lewy, wewn., bServiceBlocksReverse', () => {
  const b = build('TRAPEZOID', { type: TRAPEZOID_TYPE.RectangularLeft }, { internal: 1, blocksReverse: true });
  assert.deepEqual(steps(b), [CUT.CutInnerFull, CUT.CutInnerFull, CUT.CutInnerFull, CUT.CutInnerReverse, CUT.Nothing]);
  nearPt(b, 3, 0, 400 - 4);
  // typ > 6 -> Isosceles (FiguresGeometricSt)
  assert.deepEqual(build('TRAPEZOID', { type: 9 }).rows, build('TRAPEZOID').rows);
  // RectangularRight: alfa z (L-W)/2 (jak w PLC)
  const r = getTrapezoidPositions({ fStartXPosition: 0, fStartYPosition: 0, fLength: 1000, fWidth: 600, fHeight: 400,
    fParameterBladeWidth: 4, iInner: 0, iTrapezoidType: TRAPEZOID_TYPE.RectangularRight, bHalf: false }, { bServiceBlocksReverse: false });
  near(r.aXPositions[3], 400 + 4 / 2);
});

test('TRAPEZOID45: przeliczenie wejsc jak w FiguresGeometricSt + polowa', () => {
  // H 200, W 500 -> fLength 208, fWidth 108, (L-W)/2 = 50, alfa = ATAN(4)
  const sin = 4 / Math.sqrt(17);
  const b = build('TRAPEZOID45');
  nearPt(b, 1, 208 + 4 / sin, 0);
  nearPt(b, 3, 51, 204);
  const h = build('TRAPEZOID45', { half: true });
  assert.equal(h.count, 4);
  assert.deepEqual(steps(h), [CUT.Cut, CUT.GoToPosition, CUT.Cut, CUT.Nothing, CUT.Nothing]);
  nearPt(h, 0, 208 + 4 / sin, 0);
  nearPt(h, 1, 158 + 4 / sin - 1, 204);
  nearPt(h, 2, 51, 204);
  nearPt(h, 3, 0, 0);
});

test('CROSS: ramiona i kroki naroznikow', () => {
  const b = build('CROSS');   // L 1000 + 4, W 1000 + 4, w2 200, H 300 -> arm1 402, arm2 504
  assert.equal(b.count, 12);
  const I = [CUT.CutInnerEnd, CUT.CutInnerStart, CUT.Cut];
  assert.deepEqual(steps(b), [...I, ...I, ...I, ...I, CUT.Nothing]);
  nearPt(b, 1, 402, 0);
  nearPt(b, 3, 602, -300);
  nearPt(b, 5, 1004, 0);
  nearPt(b, 8, 602, 704);
  nearPt(b, 12, 0, 0);
  const i = build('CROSS', {}, { internal: 1 });
  assert.ok(i.rows.slice(0, 12).every((r) => r.step === CUT.CutInnerFull));
  nearPt(i, 5, 996, 0);
  // w trybie frezu nadal fParameterBladeWidth
  assert.deepEqual(build('CROSS', {}, { modeMill: true }).rows, b.rows);
});

test('POLYGON: punkty wzgledne, zamkniecie w (0, 0), aPolygonFunction bez wplywu', () => {
  const b = build('POLYGON', { xs: 300, ys: 200 });
  assert.equal(b.count, 5);
  assert.deepEqual(steps(b), [CUT.Cut, CUT.Cut, CUT.Cut, CUT.Cut, CUT.Cut, CUT.Nothing]);
  assert.deepEqual(b.rows.map((r) => [r.x, r.y]), [[0, 0], [1000, 0], [1000, 600], [500, 900], [0, 600], [0, 0]]);
  assert.deepEqual(build('POLYGON', { pf: [2, 3, 4, 22] }).rows, build('POLYGON').rows);
  // punkt (0, 0) w srodku listy konczy wielokat
  const c = build('POLYGON', { px: [100, 0, 300], py: [100, 0, 300], pf: [] });
  assert.equal(c.count, 2);
  assert.deepEqual(pt(c, 2), [0, 0]);
  // tryb frezu: ProgramMillStep.Mill (= 1)
  assert.equal(build('POLYGON', {}, { modeMill: true }).rows[0].step, 1);
});
