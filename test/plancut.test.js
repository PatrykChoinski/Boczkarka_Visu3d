// Plan ciecia: linie jako zasieg rzazu na powierzchni - zewnetrzne wychodza za punkty (tarcza poza materialem),
// wewnetrzne koncza sie na punktach (linie sie nie przecinaja)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, COMMON_FIELDS, defaults, opPlanLines } from '../src/shared/ops.js';
import { previewSteps } from '../src/shared/automat.js';
import { planMarks, planDistances } from '../src/shared/planmarks.js';
import { machine } from '../src/shared/geometry.js';
import { DEFAULTS } from '../src/shared/config.js';

const m = machine({ ...DEFAULTS.offline.machine, mode: 'saw' });
const common = { ...defaults(COMMON_FIELDS), bladeWidth: m.bladeWidth };
const op = (id) => OPS.find((o) => o.id === id);
// polowa cieciwy tarczy na powierzchni przy pelnej glebokosci
const chord = (z) => Math.sqrt(m.discDiameter * z - z * z);
// polozenie punktu na linii (od poczatku ends, wzdluz linii)
const along = (l, p) => {
  const [[x0, y0], [x1, y1]] = l.ends;
  const L = Math.hypot(x1 - x0, y1 - y0);
  return ((p[0] - x0) * (x1 - x0) + (p[1] - y0) * (y1 - y0)) / L;
};
const len = (l) => Math.hypot(l.ends[1][0] - l.ends[0][0], l.ends[1][1] - l.ends[0][1]);

test('ciecie proste: zewnetrzne - rzaz za punktami o polowe cieciwy tarczy, wewnetrzne - na punktach', () => {
  const v = defaults(op('cut').fields);
  const [outer] = opPlanLines(op('cut'), { ...v, internal: 0 }, common, m);
  const h = chord(common.thickness);
  assert.ok(Math.abs(along(outer, outer.path[0]) + h) < 0.01);
  assert.ok(Math.abs(along(outer, outer.path[1]) - (len(outer) + h)) < 0.01);
  const [inner] = opPlanLines(op('cut'), { ...v, internal: 1 }, common, m);
  assert.ok(along(inner, inner.path[0]) >= -0.01 && along(inner, inner.path[1]) <= len(inner) + 0.01);
  // wewn. poczatek / koniec - tylko jeden koniec za punktem
  const [innerStart] = opPlanLines(op('cut'), { ...v, internal: 2 }, common, m);
  assert.ok(along(innerStart, innerStart.path[0]) >= -0.01 && along(innerStart, innerStart.path[1]) > len(innerStart) + h - 0.01);
  // znaczniki i wymiar - na zadanych punktach, nie na koncach rzazu
  assert.deepEqual(planMarks([outer]).map((k) => [k.x, k.y]), outer.ends);
  assert.equal(Math.round(planDistances([outer])[0].d), Math.round(len(outer)));
});

// przeciecie odcinkow (bez stykania sie koncami)
function crosses(a, b) {
  const [[x1, y1], [x2, y2]] = a; const [[x3, y3], [x4, y4]] = b;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

test('krawedzie (prostokat): wewnetrzne - linie planu sie nie przecinaja, zewnetrzne - przecinaja sie za narozami', () => {
  const v = defaults(op('edges').fields);
  const inner = opPlanLines(op('edges'), { ...v, internal: 1 }, common, m);
  const outer = opPlanLines(op('edges'), { ...v, internal: 0 }, common, m);
  assert.equal(inner.length, 4);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) assert.ok(!crosses(inner[i].path, inner[j].path), `wewn. ${i} x ${j}`);
  }
  // sasiednie krawedzie zewnetrzne - rzaz wychodzi za naroze, wiec linie sie krzyzuja
  for (let i = 0; i < 4; i++) assert.ok(crosses(outer[i].path, outer[(i + 1) % 4].path), `zewn. ${i} x ${i + 1}`);
});

test('automat: krok ciecia - zasieg rzazu (zewn. za punktami, wewn. do punktow), bez maszyny - linia z punktow', () => {
  const rows = [{ x: 0, y: 0, step: 1 }, { x: 1000, y: 0, step: 5 }, { x: 1000, y: 600, step: 0 }];
  const [outer, inner] = previewSteps(rows, 2, [500, 400], { outerInner: false }, common, m);
  assert.deepEqual(outer.ends, [[500, 400], [1500, 400]]);
  assert.ok(outer.path[0][0] < 500 - chord(common.thickness) && outer.path[1][0] > 1500 + chord(common.thickness));
  assert.ok(inner.path[0][1] >= 400 - 0.01 && inner.path[1][1] <= 1000 + 0.01);
  const plain = previewSteps(rows, 2, [500, 400], { outerInner: false }, common);
  assert.deepEqual(plain[0].path, [[500, 400], [1500, 400]]);
});
