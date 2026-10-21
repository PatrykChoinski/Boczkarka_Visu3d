// Stol i kamien z punktow jak w PLC (WorkArea): aCuttingBoard / aCuttingRock, liczba wierzcholkow, Z min.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apexPoints, boardZMin, isArea, bounds, pointInPolygon, rectangle } from '../src/shared/area.js';

test('punkty z tablic PLC: tylko pierwsze iApexNumber, maks. 8', () => {
  const xs = [0, 3500, 3500, 0, 9, 9, 9, 9];
  const ys = [0, 0, 3000, 3000, 9, 9, 9, 9];
  const zs = [490, 490, 495, 490, 9, 9, 9, 9];
  assert.deepEqual(apexPoints(xs, ys, zs, 4), [[0, 0, 490], [3500, 0, 490], [3500, 3000, 495], [0, 3000, 490]]);
  assert.equal(apexPoints(xs, ys, zs, 20).length, 8);
  assert.deepEqual(apexPoints(xs, ys, zs, 0), []);
});

test('Z min stolu jak fCuttingBoardZMin: pierwszy punkt zawsze, kolejne tylko z Z > 0', () => {
  assert.equal(boardZMin([[0, 0, 490], [1, 0, 485], [1, 1, 0]]), 485);
  assert.equal(boardZMin([[0, 0, 0], [1, 0, 485]]), 0);
  assert.equal(boardZMin([]), null);
});

test('wielokat kamienia: obrys, punkt w srodku / poza', () => {
  const rock = [[100, 150, 450], [2600, 150, 450], [2900, 900, 450], [2200, 1700, 450], [100, 1700, 450]];
  assert.ok(isArea(rock));
  assert.deepEqual(bounds(rock), [100, 150, 2900, 1700]);
  assert.ok(pointInPolygon(1000, 1000, rock));
  assert.ok(!pointInPolygon(2850, 1600, rock));   // naroznik obrysu, poza scietym rogiem
  assert.ok(!isArea([[0, 0, 0], [10, 0, 0]]));
  assert.ok(!isArea(rectangle(0, 0, 0, 100, 0)));
});
