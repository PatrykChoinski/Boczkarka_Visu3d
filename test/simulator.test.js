// Symulator trybu offline - sekwencja jak EdgeProfileControl w PLC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EdgeSimulator, Axis } from '../src/shared/simulator.js';
import { defaultRecipes } from '../src/shared/edgeprofile.js';
import { STEP } from '../src/shared/config.js';
import { cutState } from '../src/shared/edgeshape.js';

const recipe = (i, over = {}) => ({ ...defaultRecipes()[i], xStart: 100, xEnd: 500, overtravel: 20, feed: 6, ...over });
function runUntil(sim, cond, maxSeconds = 600) {
  for (let t = 0; t < maxSeconds; t += 0.1) {
    sim.tick(0.1);
    if (cond(sim.state())) return t;
  }
  throw new Error(`nie doczekano warunku, krok ${sim.step}`);
}

test('os: dojazd do celu bez przestrzelenia, profil trapezowy', () => {
  const a = new Axis(0);
  a.moveTo(100, 50, 200);
  let max = 0;
  for (let i = 0; i < 500 && !a.done; i++) { a.step(0.01); max = Math.max(max, a.vel); assert.ok(a.pos <= 100 + 1e-9); }
  assert.equal(a.pos, 100);
  assert.ok(max <= 50 + 1e-9);
});

for (const [i, count] of [[0, 1], [1, 1], [4, 10], [6, 19]]) {
  test(`pelny cykl receptury ${i + 1}: ${count} przejsc, autopowrot, wrzeciono stop`, () => {
    const sim = new EdgeSimulator();
    assert.ok(sim.start(recipe(i)));
    runUntil(sim, (s) => s.step === STEP.WaitForStart);
    const s = sim.state();
    assert.equal(s.passCount, count);
    assert.equal(s.passIndex, count + 1);
    assert.equal(s.cycles, 1);
    assert.ok(Math.abs(s.x) < 1e-6 && Math.abs(s.b) < 1e-6, 'autopowrot do X 0 / B 0');
    assert.equal(s.spindleRunning, false);
    assert.deepEqual(cutState(s, sim.passes), { done: count, partial: null });
  });
}

test('przejscia w obie strony: kierunek zmienia sie co przejscie; jeden kierunek: powrot ReturnX', () => {
  const sim = new EdgeSimulator();
  sim.start(recipe(4));
  const dirs = [];
  runUntil(sim, (s) => {
    if (s.step === STEP.PassX && dirs.at(-1)?.[0] !== s.passIndex) dirs.push([s.passIndex, s.directionPositive]);
    return s.step === STEP.WaitForStart;
  });
  assert.equal(dirs.length, 10);
  for (let k = 1; k < dirs.length; k++) assert.notEqual(dirs[k][1], dirs[k - 1][1]);
  const one = new EdgeSimulator();
  one.start(recipe(4, { bothDirections: false }));
  let returns = 0;
  let prev = -1;
  runUntil(one, (s) => { if (s.step === STEP.ReturnX && prev !== STEP.ReturnX) returns += 1; prev = s.step; return s.step === STEP.WaitForStart; });
  assert.equal(returns, 9);
});

test('pauza w przejezdzie: X stoi, docisk odjety, wrzeciono pracuje; wznowienie konczy przejazd', () => {
  const sim = new EdgeSimulator();
  sim.start(recipe(4, { feed: 1 }));
  runUntil(sim, (s) => s.step === STEP.PassX && s.passIndex === 2 && Math.abs(s.x - 120) > 50);
  sim.pause();
  runUntil(sim, (s) => Math.abs(s.xVelocity) < 1e-9, 5);
  const x = sim.state().x;
  sim.tick(2);
  const p = sim.state();
  assert.equal(p.step, STEP.Pause);
  assert.equal(p.x, x);
  assert.equal(p.clamp, false);
  assert.ok(p.spindleRunning);
  const cut = cutState({ ...p, step: STEP.PassX }, sim.passes);
  assert.equal(cut.done, 1);
  sim.start();
  runUntil(sim, (s) => s.step === STEP.NextPass || s.passIndex === 3);
  assert.equal(sim.state().passIndex >= 2, true);
  runUntil(sim, (s) => s.step === STEP.WaitForStart);
  assert.equal(sim.state().cycles, 1);
});

test('stop: zatrzymanie, WaitForCommand, potwierdzenie; zla receptura nie rusza', () => {
  const sim = new EdgeSimulator();
  sim.start(recipe(4));
  runUntil(sim, (s) => s.step === STEP.PassX);
  sim.stop();
  runUntil(sim, (s) => Math.abs(s.xVelocity) < 1e-9, 5);
  assert.equal(sim.step, STEP.WaitForCommand);
  sim.acknowledge();
  assert.equal(sim.step, STEP.WaitForStart);
  assert.equal(sim.start(recipe(4, { xEnd: 50 })), false);
  assert.equal(sim.error, 1);
  assert.equal(sim.step, STEP.WaitForCommand);
});
