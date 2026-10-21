// Geometria glowicy vs formuly PLC (CutST) i zapis ciecia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, bladeFrame, penetration, plcAxisXY, plcAxisZ, topZ } from '../src/shared/geometry.js';
import { CutRecorder } from '../src/shared/cuts.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DEG = Math.PI / 180;

// powtarzalne liczby losowe
function rng(seed) {
  let s = seed >>> 0;
  return (lo, hi) => { s = (s * 1664525 + 1013904223) >>> 0; return lo + (hi - lo) * s / 2 ** 32; };
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('najnizszy punkt tarczy na linii ciecia i na glebokosci z GetPositions / GetNextDepth', () => {
  const r = rng(1);
  for (let i = 0; i < 500; i++) {
    const a = r(-180, 180); const b = r(0, 60);
    const lx = r(0, 3000); const ly = r(0, 2000); const depth = r(0, 40);
    const [x, y] = plcAxisXY(lx, ly, a, b, M);
    const f = bladeFrame({ x, y, z: plcAxisZ(depth, b, M), a, b }, M);
    near(f.lowest[0], lx); near(f.lowest[1], ly); near(penetration(f, M), depth);
  }
});

test('ciecie pod katem z fBX/YOffset - rzaz na zadanej linii na gornej powierzchni', () => {
  const r = rng(2);
  for (let i = 0; i < 200; i++) {
    const a = r(-180, 180); const b = r(5, 60);
    const lx = r(0, 3000); const ly = r(0, 2000); const depth = r(1, 40);
    let [x, y] = plcAxisXY(lx, ly, a, b, M);
    const tanB = Math.tan(b * DEG);
    x += -Math.sin(a * DEG) * tanB * depth;
    y += Math.cos(a * DEG) * tanB * depth;
    const f = bladeFrame({ x, y, z: plcAxisZ(depth, b, M), a, b }, M);
    const top = f.point(0, (f.center[2] - topZ(M)) / f.cosB);
    near(top[2], topZ(M));
    near((top[0] - lx) * Math.sin(a * DEG) - (top[1] - ly) * Math.cos(a * DEG), 0);
  }
});

function recordCut(a, b, length, depths) {
  const rec = new CutRecorder();
  depths.forEach((depth, i) => {
    for (let k = 0; k <= 100; k++) {
      const s = length * (i % 2 === 0 ? k : 100 - k) / 100;
      const [x, y] = plcAxisXY(500 + Math.cos(a * DEG) * s, 400 + Math.sin(a * DEG) * s, a, b, M);
      rec.update({ x, y, z: plcAxisZ(depth, b, M), a, b }, M);
    }
  });
  return rec;
}

test('ciecie proste: dlugosc rzazu na gorze i glebokosc', () => {
  const s = recordCut(0, 0, 600, [10, 20]).summary();
  const r = M.discDiameter / 2;
  assert.equal(s.count, 1);
  near(s.depth, 20, 1e-3);
  near(s.length, 600 + 2 * Math.sqrt(r * r - (r - 20) ** 2), 2);
});

test('ciecie z wychylem - kilka plaszczyzn, jedno ciecie', () => {
  const s = recordCut(30, 45, 500, [8, 16, 24]).summary();
  assert.equal(s.count, 1);
  near(s.depth, 24, 1e-3);
});

test('glebokosc ograniczona grubosci materialu, nad materialem nic', () => {
  near(recordCut(0, 0, 300, [60]).summary().depth, M.materialThickness, 1e-3);
  assert.equal(recordCut(0, 0, 300, [-5]).summary(), null);
});
