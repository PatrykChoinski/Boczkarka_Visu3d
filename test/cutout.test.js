// #156 ukrywanie wycietych elementow: kawalki kamienia rozdzielone cieciami przez cala grubosc
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, COMMON_FIELDS, defaults } from '../src/shared/ops.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { machine } from '../src/shared/geometry.js';
import { CutRecorder } from '../src/shared/cuts.js';
import { cutoutShapes, maskContours, signedArea } from '../src/shared/cutout.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DYN = { cutVel: 30, cutAcc: 60, cutDec: 60, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, zUpVel: 20, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
const ROCK = [[300, 200], [2800, 200], [2800, 1800], [300, 1800]];
const op = (id) => OPS.find((o) => o.id === id);

// program operacji -> zapis ciec (jak symulacja)
function cutsOf(id, v, thickness) {
  const pb = new ProgramBuilder({ x: 0, y: 0, z: 0, a: 0, b: 0 }, M, DYN);
  op(id).build(pb, { ...defaults(op(id).fields), ...v }, { ...defaults(COMMON_FIELDS), bladeWidth: 4, thickness });
  const prog = pb.build();
  const rec = new CutRecorder();
  for (let t = 0; t <= prog.duration; t += 0.05) rec.update(prog.at(t).pose, M);
  return rec.cuts;
}

const area = (shape) => signedArea(shape.outer) + shape.holes.reduce((s, h) => s + signedArea(h), 0);

test('prostokat wyciety przez cala grubosc: jeden element, kamien z otworem', () => {
  const cuts = cutsOf('edges', { xs: 800, ys: 600, length: 1000, width: 600, internal: 0 }, 40);
  const r = cutoutShapes(ROCK, cuts);
  assert.ok(r, 'brak wycietego elementu');
  assert.equal(r.elements, 1);
  assert.equal(r.shapes.length, 1);
  assert.equal(r.shapes[0].holes.length, 1);
  // otwor ~ prostokat 1000 x 600 (w srodku rzazow), kamien bez otworu ~ 2500 x 1600
  const hole = -signedArea(r.shapes[0].holes[0]);
  assert.ok(Math.abs(hole - 1000 * 600) / (1000 * 600) < 0.03, `otwor ${hole}`);
  assert.ok(Math.abs(signedArea(r.shapes[0].outer) - 2500 * 1600) / (2500 * 1600) < 0.01);
  assert.ok(area(r.shapes[0]) < 2500 * 1600 - 1000 * 600 * 0.95);
});

test('ten sam prostokat ciety plycej niz grubosc - nic nie jest wyciete', () => {
  const cuts = cutsOf('edges', { xs: 800, ys: 600, length: 1000, width: 600, internal: 0 }, 20);
  assert.equal(cutoutShapes(ROCK, cuts), null);
});

test('ciecie przez caly kamien: dwa kawalki, mniejszy ukryty (bez otworu)', () => {
  const cuts = cutsOf('cut', { twoPoint: true, x0: 2300, y0: 0, x1: 2300, y1: 2000, internal: 0 }, 40);
  const r = cutoutShapes(ROCK, cuts);
  assert.ok(r);
  assert.equal(r.elements, 1);
  assert.equal(r.shapes.length, 1);
  assert.equal(r.shapes[0].holes.length, 0);
  // zostaje plyta X 300 .. ~2300
  const xs = r.shapes[0].outer.map((p) => p[0]);
  assert.ok(Math.max(...xs) < 2310 && Math.max(...xs) > 2290, `${Math.max(...xs)}`);
});

test('kontury maski: obrys przeciwnie do wskazowek, otwor zgodnie', () => {
  // 4 x 4 z dziura 2 x 2 w srodku
  const mask = new Uint8Array(16).fill(1);
  for (const k of [5, 6, 9, 10]) mask[k] = 0;
  const loops = maskContours(mask, 4, 4, 0, 0, 1);
  assert.equal(loops.length, 2);
  assert.deepEqual(loops.map(signedArea).sort((a, b) => a - b), [-4, 16]);
});
