// Przekroj krawedzi po przejsciach (edgeshape.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeSection, passPlane, clip, cutState } from '../src/shared/edgeshape.js';
import { PROFILE_TYPE, defaultRecipes, generatePasses } from '../src/shared/edgeprofile.js';

const SHAPE = { quarterRadius: 20, chamferSize: 8, straightDepth: 1 };
const T = 30;
const area = (poly) => Math.abs(poly.reduce((s, [x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; return s + x * y2 - x2 * y; }, 0)) / 2;

test('obciecie prostokata polplaszczyzna', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(area(clip(sq, { n: [1, 0], d: 5 })), 50);
  assert.equal(clip(sq, { n: [1, 0], d: -1 }).length, 0);
});

test('cwiercwalek: fasetki przyblizaja luk - pole zdjete ~ (1 - pi/4) R^2', () => {
  const p = defaultRecipes()[4];
  const angles = generatePasses(p).passes.map((s) => s.angleB);
  const before = area(edgeSection(p.kind, [], T, SHAPE));
  const after = area(edgeSection(p.kind, angles, T, SHAPE));
  const removed = before - after;
  const ideal = (1 - Math.PI / 4) * 20 * 20;
  assert.ok(removed > 0.9 * ideal && removed <= ideal + 1e-6, `zdjete ${removed.toFixed(1)}, luk ${ideal.toFixed(1)}`);
});

test('polwalek: cala krawedz zaokraglona promieniem T/2, dol i gora symetrycznie', () => {
  const p = defaultRecipes()[6];
  const poly = edgeSection(p.kind, generatePasses(p).passes.map((s) => s.angleB), T, SHAPE);
  const maxU = Math.max(...poly.map(([u]) => u));
  assert.ok(maxU <= 1e-9);
  const top = poly.filter(([, v]) => v > T - 0.01).map(([u]) => u);
  const bottom = poly.filter(([, v]) => v < 0.01).map(([u]) => u);
  assert.ok(Math.abs(Math.max(...top) - Math.max(...bottom)) < 1e-6, 'symetria');
  assert.ok(Math.max(...top) < -12, 'wierzch skrocony o ~R (fasetka 80° przecina wierzch ~1.3 mm przed styczna)');
});

test('faza gorna 45: odcinek o bokach chamferSize', () => {
  const poly = edgeSection(PROFILE_TYPE.TopChamfer, [45], T, SHAPE);
  assert.ok(poly.some(([u, v]) => Math.abs(u) < 1e-9 && Math.abs(v - (T - 8)) < 1e-9));
  assert.ok(poly.some(([u, v]) => Math.abs(u + 8) < 1e-9 && Math.abs(v - T) < 1e-9));
});

test('punkt styku tarczy lezy na plaszczyznie przejscia', () => {
  for (const [kind, a] of [[PROFILE_TYPE.TopQuarterRound, 40], [PROFILE_TYPE.BottomChamfer, -45], [PROFILE_TYPE.StraightEdge, 0]]) {
    const { n, d, contact } = passPlane(kind, a, T, SHAPE);
    assert.ok(Math.abs(n[0] * contact[0] + n[1] * contact[1] - d) < 1e-9);
  }
});

test('stan obrobki z migawki: biezacy przejazd jako odcinek X', () => {
  const passes = generatePasses(defaultRecipes()[4]).passes;
  assert.deepEqual(cutState({ passIndex: 0, step: 0 }, passes), { done: 0, partial: null });
  assert.deepEqual(cutState({ passIndex: 3, step: 50, x: 300, passFrom: 80 }, passes), { done: 2, partial: { angle: 20, from: 80, to: 300 } });
  assert.deepEqual(cutState({ passIndex: 11, step: 0 }, passes), { done: 10, partial: null });
});
