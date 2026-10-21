// Woda i laser na glowicy (#141): dysze po obu stronach tarczy, woda na tarcze / narzedzie, modul lasera na oslonie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, bladeFrame, toolFrame, sub, dot } from '../src/shared/geometry.js';
import { waterLayout, waterDrops, laserMount, guardRadius, GUARD_OUTLINE } from '../src/shared/water.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const len = (p) => Math.hypot(...p);
const near3 = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('woda pila: dwie dysze po obu stronach tarczy, woda na tarcze, weze od korpusu A do dysz', () => {
  for (const pose of [{ x: 800, y: 600, z: 100, a: 0, b: 0 }, { x: 800, y: 600, z: 120, a: 37, b: 45 }]) {
    const f = bladeFrame(pose, M);
    const w = waterLayout(pose, M);
    assert.equal(w.hoses.length, 2);
    const sides = w.nozzles.map((n) => dot(sub(n, f.center), f.normal));
    assert.ok(sides[0] > M.bladeWidth / 2 + 30 && sides[1] < -(M.bladeWidth / 2 + 30), `dysze ${sides}`);
    for (const t of w.targets) {
      const rel = sub(t, f.center);
      const off = dot(rel, f.normal);
      assert.ok(Math.abs(Math.abs(off) - (M.bladeWidth / 2 + 0.5)) < 1e-6, `odsuniecie celu ${off}`);
      assert.ok(Math.hypot(dot(rel, f.u), dot(rel, f.d)) < f.radius, 'cel na tarczy');
    }
    w.hoses.forEach((h, i) => assert.deepEqual(h[h.length - 1], w.nozzles[i]));
    // jak na zdjeciu w #141: dysze pod dolna krawedzia oslony, przy piascie; rozdzielacz za tarcza (z tylu)
    const guardBottom = Math.min(...GUARD_OUTLINE.map((p) => p[1])) * f.radius;
    for (const n of w.nozzles) {
      const t = -dot(sub(n, f.center), f.d);
      const s = dot(sub(n, f.center), f.u);
      assert.ok(t < guardBottom && t > -0.5 * f.radius, `dysza pod oslona: t ${t}`);
      assert.ok(Math.abs(s) < 0.5 * f.radius, `dysza przy piascie: s ${s}`);
    }
    assert.ok(dot(sub(w.manifold, f.center), f.u) < -f.radius, 'rozdzielacz za tarcza');
  }
});

test('oslona tarczy: obrys zamkniety nad piasta, krawedz w gore / do przodu / do tylu', () => {
  near3(guardRadius([0, 1]), 1.12);
  near3(guardRadius([1, 0]), 0.95);
  near3(guardRadius([-1, 0]), 1.08);
  assert.ok(guardRadius([0, -1]) < 0.3, 'dol oslony tuz pod piasta - tarcza pod spodem odslonieta');
});

test('woda frez / wiertlo: dysze przy narzedziu, woda na czolo', () => {
  for (const mode of ['mill', 'drill']) {
    const m = machine({ ...M, mode, millTiltDiameter: 100 });
    const pose = { x: 900, y: 700, z: 50, a: 0, b: 90 };
    const f = toolFrame(pose, m);
    const w = waterLayout(pose, m);
    for (const t of w.targets) assert.ok(len(sub(t, f.tip)) <= f.radius + 1e-6, 'woda na czolo narzedzia');
    for (const n of w.nozzles) assert.ok(Math.abs(dot(sub(n, f.tip), f.u)) > f.radius, 'dysza obok narzedzia');
  }
});

test('krople: od dyszy do celu, n kropli, faza przesuwa krople', () => {
  const a = [0, 0, 100];
  const b = [100, 0, 0];
  const d0 = waterDrops(a, b, 10, 0, 0);
  assert.equal(d0.length, 10);
  assert.deepEqual(d0[0], a);
  const d1 = waterDrops(a, b, 10, 0.05, 0);
  assert.ok(d1[0][0] > 0 && d1[0][0] < 10);
});

test('laser: modul na oslonie tarczy od strony lasera (kat od gory), w plaszczyznie tarczy', () => {
  for (const side of [1, -1]) {
    const pose = { x: 500, y: 400, z: 100, a: 30, b: 0 };
    const f = bladeFrame(pose, M);
    const mt = laserMount(pose, M, side, 50);
    const rel = sub(mt.pos, f.center);
    assert.ok(Math.abs(dot(rel, f.normal)) < 1e-6, 'w plaszczyznie tarczy');
    const dir = [Math.sin(side * 50 * Math.PI / 180), Math.cos(50 * Math.PI / 180)];
    assert.ok(Math.abs(len(rel) - (guardRadius(dir) * f.radius + 40)) < 1e-6, 'na krawedzi oslony');
    assert.ok(dot(rel, f.u) * side > 0, 'po stronie lasera');
    assert.ok(mt.pos[2] > f.center[2], 'nad tarcza');
  }
});
