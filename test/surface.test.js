// #152 profile i wygladzanie: tarcza obniza mape wysokosci kamienia - ksztalt w XZ / YZ widoczny jako powierzchnia
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeightMap } from '../src/shared/heightmap.js';
import { addSmoothing, profileCircle, profileDepth } from '../src/shared/profiles.js';
import { hasSurfaceSteps } from '../src/shared/automat.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { machine, bladeFrame, topZ } from '../src/shared/geometry.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DYN = { cutVel: 30, cutAcc: 60, cutDec: 60, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, zUpVel: 20, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };

test('tarcza na mapie wysokosci: dolny luk tarczy w pasie o grubosci tarczy', () => {
  const top = 0;
  const hm = new HeightMap([-400, -50, 400, 50], top, -40, 1);
  const r = 312.5;
  hm.bladeStamp([0, 0, top + r - 10], [1, 0], r, 4);
  const at = (x, y) => hm.at(Math.round((x + 400) / hm.res), Math.round((y + 50) / hm.res));
  assert.ok(Math.abs(at(0, 0) - (top - 10)) < 1e-6);
  const x = 50;
  assert.ok(Math.abs(at(x, 0) - (top + r - 10 - Math.sqrt(r * r - x * x))) < 1e-6);
  assert.equal(at(0, 10), top);           // poza grubością tarczy
  assert.equal(at(200, 0), top);          // poza cięciwą na tej głębokości
});

test('wygladzanie (XZ): przejscia tarczy w poprzek po luku - powierzchnia mapy wzdluz X jak profil', () => {
  const row = { P0: [500, 400], P1: [540, 400], d0: 0, d1: 30, R: 40, length: 200, jump: 20, convex: true, xProfile: true };
  const pb = new ProgramBuilder({ x: 0, y: 0, z: 0, a: 0, b: 0 }, M, DYN);
  addSmoothing(pb, [row], { above: 20 });
  const prog = pb.build();
  const top = topZ(M);
  const hm = new HeightMap([450, 350, 600, 650], top, top - 40, 1);
  let last = null;
  for (let t = 0; t <= prog.duration; t += 0.01) {
    const { pose, step } = prog.at(t);
    const f = bladeFrame(pose, M);
    if (step === 'StartSingleCut' && last && last.u[0] === f.u[0]) hm.bladeCarve(last.c, f.center, f.u, f.radius, M.bladeWidth);
    last = { c: f.center, u: f.u };
  }
  assert.ok(hm.cut > 100);
  const circle = profileCircle([500, 0], [540, 30], 40, true);
  // w srodku dlugosci (y = 400 + 100): glebokosc wzdluz X jak luk profilu; tarcza ma grubosc 4 mm - komorke
  // obniza najglebszy punkt profilu w pasie +-2 mm
  for (const x of [505, 515, 525, 535]) {
    const z = hm.at(Math.round(x - 450), Math.round(500 - 350));
    const want = Math.max(...[-2, -1, 0, 1, 2].map((d) => profileDepth(circle, Math.min(540, x + d))));
    assert.ok(Math.abs(top - z - want) < 1.5, `x ${x}: ${(top - z).toFixed(2)} != ${want.toFixed(2)}`);
  }
});

test('program z profilami / wygladzaniem rozpoznany (kroki 8-11, 15-18)', () => {
  assert.ok(hasSurfaceSteps([{ step: 1 }, { step: 9 }, { step: 0 }]));
  assert.ok(hasSurfaceSteps([{ step: 16 }]));
  assert.ok(!hasSurfaceSteps([{ step: 1 }, { step: 5 }, { step: 12 }]));
  assert.ok(!hasSurfaceSteps([{ step: 1 }, { step: 9 }], 1));
});
