// #136 Obroty narzedzi: znaczniki (ostrza frezu, segmenty koronki, sektory polerki) leza na narzedziu
// i obracaja sie wokol osi narzedzia o kat wrzeciona.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, toolFrame } from '../src/shared/geometry.js';
import { toolSpinMarks, toolLayout } from '../src/shared/toolspin.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

const base = { discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40,
  millWidth: 50, millTiltDiameter: 100, millLength: 250, drillLength: 250, millCorrection: 0, polishDiameter: 120, polishHeight: -60 };
const POSES = [{ x: 500, y: 300, z: 100, a: 0, b: 90 }, { x: 800, y: 600, z: 150, a: 37, b: 90 }, { x: 200, y: 900, z: 50, a: -90, b: 60 }];

// wspolrzedne punktu w ukladzie narzedzia: k wzdluz osi od kolnierza, rho od osi, kat t (d -> u)
function local(f, p) {
  const rel = sub(p, f.flange);
  const k = dot(rel, f.normal);
  const x = dot(rel, f.d); const y = dot(rel, f.u);
  return { k, rho: Math.hypot(x, y), t: Math.atan2(y, x) };
}

for (const mode of ['mill', 'drill', 'polishing']) {
  test(`${mode}: znaczniki na narzedziu (na obwodzie albo na czole) i w obrebie czesci`, () => {
    for (const pose of POSES) {
      const m = machine({ ...base, mode });
      const f = toolFrame(pose, m);
      const { lines, accent, layout } = toolSpinMarks(f, mode, 0.7);
      assert.ok(lines.length > 0 && accent.length > 0 && lines.length % 2 === 0 && accent.length % 2 === 0);
      const [s0] = layout.shank; const [, w1, r] = layout.work;
      for (const p of [...lines, ...accent]) {
        const l = local(f, p);
        assert.ok(l.k >= s0 - 1e-6 && l.k <= w1 + 0.5 + 1e-6, `k ${l.k}`);
        assert.ok(l.rho <= r * 1.031 + 1e-6, `rho ${l.rho} > ${r}`);
      }
    }
  });

  test(`${mode}: obrot wrzeciona obraca wszystkie znaczniki wokol osi narzedzia o ten sam kat`, () => {
    const m = machine({ ...base, mode });
    const f = toolFrame(POSES[1], m);
    const a = toolSpinMarks(f, mode, 0.3);
    const b = toolSpinMarks(f, mode, 0.3 + 1.1);
    assert.equal(a.lines.length, b.lines.length);
    let rotated = 0;
    a.accent.forEach((p, i) => {
      const la = local(f, p); const lb = local(f, b.accent[i]);
      near(la.k, lb.k); near(la.rho, lb.rho);
      if (la.rho > 1) { near(Math.cos(lb.t - la.t), Math.cos(1.1), 1e-9); near(Math.sin(lb.t - la.t), Math.sin(1.1), 1e-9); rotated++; }
    });
    assert.ok(rotated > 0);
  });
}

test('uklad czesci: czesc robocza konczy sie na czole (dlugosc narzedzia), frez - 4 ostrza spiralne', () => {
  for (const mode of ['mill', 'drill', 'polishing']) {
    const lay = toolLayout(mode, 25, 250);
    assert.equal(lay.work[1], 250);
    assert.ok(lay.shank[1] <= lay.work[0] + 1e-9);
  }
  const m = machine({ ...base, mode: 'mill' });
  const f = toolFrame(POSES[0], m);
  const { accent, layout } = toolSpinMarks(f, 'mill', 0);
  // wyrozniony: kreska na chwycie (1 odcinek) + pierwsze ostrze (12 odcinkow spirali + 1 na czole)
  assert.equal(accent.length / 2, 1 + 12 + 1);
  // spirala: kat rosnie wzdluz osi o HELIX
  const flute = accent.slice(2, 2 + 24);
  const t0 = local(f, flute[0]).t; const t1 = local(f, flute[flute.length - 1]).t;
  near(t1 - t0, 0.9, 1e-9);
  near(local(f, flute[0]).k, layout.work[0]);
});
