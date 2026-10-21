import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, toolFrame, headFrame, penetration, plcToolAxisXY, plcToolAxisZ, topZ, toolSize } from '../src/shared/geometry.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { MODES, modeFromValues, homingProgram, homeA, polishingPath, toolOpsFor } from '../src/shared/tools.js';
import { ToolRecorder } from '../src/shared/toolcuts.js';
import { defaults } from '../src/shared/ops.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const BASE = { cutTiltDiameter: 640, headRotationDiameter: 198, millTiltDiameter: 450, millWidth: 40, millLength: 250, drillLength: 180,
  materialHeight: 800, materialThickness: 40, polishDiameter: 120, polishHeight: -60 };   // przy Z 0 narzedzie nad materialem
const DYN = { cutVel: 100, cutAcc: 500, cutDec: 500, fastVel: 300, fastAcc: 1000, zVel: 50, zAcc: 500, zUpVel: 50, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };

test('frez / wiertlo / polerka przy B 90: czolo narzedzia w punkcie z MillST / DrillST / Polishing, glebokosc jak w PLC', () => {
  for (const mode of ['mill', 'drill', 'polishing']) {
    for (const corr of [0, 3.5]) {
      const m = machine({ ...BASE, mode, millCorrection: corr });
      for (const a of [0, 37, -90, 180]) {
        for (const depth of [0, 12.5]) {
          const [x, y] = plcToolAxisXY(800, 600, a, 90, m);
          const pose = { x, y, z: plcToolAxisZ(depth, 90, m), a, b: 90 };
          const f = toolFrame(pose, m);
          near(f.tip[0], 800);
          near(f.tip[1], 600);
          near(penetration(f, m), depth);
          assert.deepEqual(f.lowest, f.tip);   // punkt styku - srodek czola
        }
      }
    }
  }
});

test('frez pod katem (MillST, bMillAngleStart): B = 90 - fMillAngleBAngle, czolo w punkcie linii na glebokosci', () => {
  const m = machine({ ...BASE, mode: 'mill' });
  for (const b of [60, 45]) {
    const [x, y] = plcToolAxisXY(1000, 700, 30, b, m);
    const pose = { x, y, z: plcToolAxisZ(8, b, m), a: 30, b };
    const f = toolFrame(pose, m);
    near(f.tip[0], 1000);
    near(f.tip[1], 700);
    near(topZ(m) - f.tip[2], 8);
    assert.ok(penetration(f, m) > 8);    // krawedz czola nizej niz srodek
  }
});

test('srednica narzedzia: frez i wiertlo - fParameterMillWidth, polerka - wlasny parametr; pila bez zmian', () => {
  assert.equal(toolSize(machine({ ...BASE, mode: 'mill' })).diameter, 40);
  assert.equal(toolSize(machine({ ...BASE, mode: 'drill' })).diameter, 40);
  assert.equal(toolSize(machine({ ...BASE, mode: 'drill' })).length, 180);
  assert.equal(toolSize(machine({ ...BASE, mode: 'polishing' })).diameter, 120);
  assert.equal(headFrame({ x: 0, y: 0, z: 0, a: 0, b: 0 }, machine({ ...BASE, mode: 'saw' })).kind, undefined);
  assert.equal(headFrame({ x: 0, y: 0, z: 0, a: 0, b: 90 }, machine({ ...BASE, mode: 'mill' })).kind, 'tool');
});

test('tryb z PLC: bModeSaw / Mill / Drill / Polishing', () => {
  assert.equal(modeFromValues({ modeMill: true }), 'mill');
  assert.equal(modeFromValues({ modePolishing: true }), 'polishing');
  assert.equal(modeFromValues({ modeSaw: false }), null);
  assert.deepEqual(MODES.map((x) => x.homeB), [0, 90, 90, 90]);
});

test('bazowanie jak BaseHomingST: Z do 0, A na 0 najkrotsza droga, B 0 (pila) / 90 (frez, wiercenie, polerowanie)', () => {
  near(homeA(270), -90);
  near(homeA(-200), 160);
  near(homeA(45), 45);
  for (const mode of MODES) {
    const m = machine({ ...BASE, mode: 'saw' });
    const from = { x: 900, y: 500, z: 380, a: 270, b: 20 };
    const p = homingProgram(from, mode.id, m, DYN);
    const end = p.at(p.duration).pose;
    near(end.z, 0);
    near(end.a, 0);
    near(end.b, mode.homeB);
    near(end.x, 900);
    assert.equal(p.at(p.duration).step, 'CHECK_HOME');
    // Z w gore przed obrotem A / B, A nie przechodzi przez +-180
    let zDoneBeforeA = true;
    for (let t = 0; t <= p.duration; t += 0.05) {
      const s = p.at(t);
      assert.ok(Math.abs(s.pose.a) <= 90 + 1e-6);
      if (Math.abs(s.pose.a + 90) > 1e-6 && Math.abs(s.pose.z) > 1e-6) zDoneBeforeA = false;
    }
    assert.ok(zDoneBeforeA);
  }
});

test('polerowanie: tor jak Polishing (XY, YX, prostokat CCW / CW)', () => {
  const v = { xs: 0, ys: 0, width: 300, length: 200, jump: 100 };
  assert.deepEqual(polishingPath({ ...v, type: 0 }), [[0, 0], [300, 0], [300, 100], [0, 100], [0, 200], [300, 200]]);
  assert.deepEqual(polishingPath({ ...v, type: 1 }), [[0, 0], [0, 200], [100, 200], [100, 0], [200, 0], [200, 200], [300, 200], [300, 0]]);
  assert.deepEqual(polishingPath({ ...v, type: 2 }), [[0, 0], [300, 0], [300, 200], [0, 200], [0, 0]]);
  assert.deepEqual(polishingPath({ ...v, type: 3 }), [[0, 0], [0, 200], [300, 200], [300, 0], [0, 0]]);
  // skok niepelny: ostatnia linia na krawedzi (fLength)
  assert.deepEqual(polishingPath({ ...v, length: 150, type: 0 }).map((p) => p[1]), [0, 0, 100, 100, 150, 150]);
});

// Symulacja operacji narzedzia z zapisem sladu: {recorder, end}
function runOp(mode, values = {}) {
  const m = machine({ ...BASE, mode });
  const op = toolOpsFor(mode)[0];
  const pb = new ProgramBuilder({ x: 0, y: 0, z: 0, a: 0, b: 90 }, m, DYN);
  op.build(pb, { ...defaults(op.fields), ...values });
  const p = pb.build();
  const rec = new ToolRecorder();
  for (let t = 0; t <= p.duration; t += 0.01) rec.update(p.at(t).pose, m);
  rec.update(p.at(p.duration).pose, m);
  return { rec, end: p.at(p.duration).pose, m };
}

test('wiercenie (DrillST): jeden otwor w punkcie, glebokosc fDrillDepth, wyjazd nad material', () => {
  const { rec, end, m } = runOp('drill', { x: 1000, y: 800, depth: 30 });
  assert.equal(rec.passes.length, 1);
  const pass = rec.passes[0];
  near(pass.maxDepth, 30, 0.05);      // probkowanie co 10 ms
  for (const [x, y] of pass.points) { near(x, 1000); near(y, 800); }
  assert.ok(penetration(toolFrame(end, m), m) < -19.9);
});

test('frezowanie linii (MillST): przejscia na kolejnych glebokosciach wzdluz linii narzedzia', () => {
  const { rec } = runOp('mill', { x0: 600, y0: 600, x1: 1600, y1: 600, depth: 10, passes: 2 });
  const s = rec.summary();
  near(s.depth, 10, 0.05);
  const all = rec.passes.flatMap((p) => p.points);
  for (const [, y] of all) near(y, 600);
  near(Math.min(...all.map((p) => p[0])), 600, 2.5);
  near(Math.max(...all.map((p) => p[0])), 1600, 2.5);
});

test('polerowanie: slad na powierzchni (glebokosc 0) na calym torze', () => {
  const { rec } = runOp('polishing', { xs: 600, ys: 500, width: 600, length: 300, jump: 150, type: 0 });
  const b = rec.bounds();
  near(b[0], 600 - 60, 2.5);
  near(b[2], 1200 + 60, 2.5);
  near(b[3], 800 + 60, 2.5);
  assert.ok(rec.passes.every((p) => p.polish && p.maxDepth < 0.01));
});
