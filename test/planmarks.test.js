import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMarks, markLabel } from '../src/shared/planmarks.js';
import { previewSteps } from '../src/shared/automat.js';

test('znaczniki planu (#137): poczatek i koniec kazdej akcji z wartosciami XY, punkty wspolne raz', () => {
  const items = [
    { path: [[0, 0], [1000, 0]] },
    { path: [[1000, 0], [1000, 600]], active: true },
    { path: [[1000, 600], [500.25, 600]] },
  ];
  const m = planMarks(items);
  assert.equal(m.length, 4);
  assert.deepEqual(m.map((p) => [p.x, p.y, p.start, p.end]), [[0, 0, true, false], [1000, 0, true, true], [1000, 600, true, true], [500.25, 600, false, true]]);
  assert.deepEqual(m.map((p) => p.order), [1, 1, 2, 3]);
  assert.equal(m[1].active, true);      // koniec akcji 1 = poczatek aktywnej akcji 2
  assert.equal(m[0].active, false);
  assert.equal(m[0].label, 'X 0  Y 0');
  assert.equal(m[3].label, 'X 500.3  Y 600');
  assert.equal(markLabel(-12.04, 7.96), 'X -12  Y 8');
});

test('znaczniki planu: wlasne punkty akcji (wiercenie), okrag - jeden znacznik, przerwy w sciezce, limit', () => {
  assert.deepEqual(planMarks([{ path: [[975, 800], [1025, 800], null, [1000, 775], [1000, 825]], marks: [[1000, 800]] }]).map((p) => [p.x, p.y]), [[1000, 800]]);
  const circle = Array.from({ length: 65 }, (_, k) => [100 * Math.cos(2 * Math.PI * k / 64), 100 * Math.sin(2 * Math.PI * k / 64)]);
  assert.equal(planMarks([{ path: circle }]).length, 1);
  assert.deepEqual(planMarks([{ path: [null, [1, 2], [3, 4], null] }]).map((p) => [p.x, p.y]), [[1, 2], [3, 4]]);
  assert.equal(planMarks([{ path: [] }, {}]).length, 0);
  const many = Array.from({ length: 50 }, (_, i) => ({ path: [[i * 10, 0], [i * 10, 5]] }));
  assert.equal(planMarks(many, 30).length, 30);
});

test('znaczniki planu z automatu: punkty programu wzgledem punktu startowego', () => {
  const rows = [{ x: 0, y: 0, step: 1 }, { x: 1000, y: 0, step: 1 }, { x: 1000, y: 600, step: 2 }, { x: 0, y: 600, step: 0 }];
  const items = previewSteps(rows, 3, [500, 400], {}, { bladeWidth: 4 });
  assert.deepEqual(planMarks(items).map((p) => p.label), ['X 500  Y 400', 'X 1500  Y 400', 'X 1500  Y 1000', 'X 500  Y 1000']);
});
