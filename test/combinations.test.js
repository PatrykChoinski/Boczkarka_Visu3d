// Wszystkie kombinacje programu obrobki: rodzaj profilu (0..20 bez Custom) x strona (gora / dol / obie) x etapy
// polerowania (0, 1, 3) x tryb przejsc (w obie strony / jeden kierunek z powrotem). Generator jak PLC, walidacja,
// ksztalt (lustro dolu, suma obu stron) i pelny cykl symulatora (przejazdy, etapy, wymiana narzedzia, powroty).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_TYPE, PROFILE_NAMES, SIDE_KINDS, FORM_KINDS, EDGE_SIDE, newProfile, setProfileDefaults, generatePasses, validateProfile,
} from '../src/shared/edgeprofile.js';
import { edgeOutline } from '../src/shared/edgeshape.js';
import { EdgeSimulator } from '../src/shared/simulator.js';
import { STEP } from '../src/shared/config.js';

const SHAPE = { quarterRadius: 20, chamferSize: 8, straightDepth: 1 };
const T = 30;
const KINDS = Object.values(PROFILE_TYPE).filter((k) => k !== PROFILE_TYPE.Custom);
const SIDES = [EDGE_SIDE.Top, EDGE_SIDE.Bottom, EDGE_SIDE.Both];

const make = (kind, side = 0, over = {}) => ({
  ...setProfileDefaults(newProfile({ name: PROFILE_NAMES[kind], xStart: 100, xEnd: 400, overtravel: 20, feed: 6 }), kind), side, ...over,
});

// oczekiwana liczba przejsc (niezaleznie od generatora): luk 0..90 co krok, strona obie bez dublowania 0
function expectedCount(kind, side) {
  const arc = kind === PROFILE_TYPE.QuarterRound ? 7 : 10;
  const sided = SIDE_KINDS.includes(kind);
  if (FORM_KINDS.includes(kind)) return 1;
  if (kind === PROFILE_TYPE.European) return 3;
  if (kind === PROFILE_TYPE.HalfRound) return 19;
  if (kind === PROFILE_TYPE.HalfBevel) return side === EDGE_SIDE.Both ? 2 : 1;
  if ([PROFILE_TYPE.TopQuarterRound, PROFILE_TYPE.BottomQuarterRound].includes(kind)) return 10;
  if (sided && [PROFILE_TYPE.QuarterRound, PROFILE_TYPE.QuarterBullnose, PROFILE_TYPE.DemiBullnose].includes(kind)) {
    return side === EDGE_SIDE.Both ? 2 * arc - 1 : arc;
  }
  return 1;
}

test('generator i walidacja: kazdy rodzaj x strona x etapy polerowania', () => {
  let n = 0;
  for (const kind of KINDS) {
    for (const side of SIDES) {
      for (const polishSteps of [0, 1, 3, 7]) {
        const p = make(kind, side, { polishSteps });
        const g = generatePasses(p);
        assert.ok(g.ok, `${PROFILE_NAMES[kind]} strona ${side}`);
        assert.equal(g.passes.length, expectedCount(kind, side), `${PROFILE_NAMES[kind]} strona ${side}`);
        assert.equal(validateProfile(p, g.passes), 0, `${PROFILE_NAMES[kind]} strona ${side} polerowanie ${polishSteps}`);
        // strona dolna: katy przejsc lustrzane (ujemne); gora: nieujemne (profile asymetryczne)
        if (SIDE_KINDS.includes(kind) && !FORM_KINDS.includes(kind)) {
          if (side === EDGE_SIDE.Bottom) assert.ok(g.passes.every((x) => x.angleB <= 0));
          if (side === EDGE_SIDE.Top) assert.ok(g.passes.every((x) => x.angleB >= 0));
        }
        n += 1;
      }
    }
  }
  assert.equal(n, KINDS.length * 3 * 4);
  assert.equal(validateProfile(make(PROFILE_TYPE.Ogee, 0, { polishSteps: 8 }), generatePasses(make(PROFILE_TYPE.Ogee)).passes), 8);
});

test('ksztalt: strona dolna = lustro gornej, obie strony = suma obu (kazdy profil katalogowy asymetryczny)', () => {
  for (const kind of SIDE_KINDS) {
    const out = (side) => edgeOutline(kind, generatePasses(make(kind, side)).passes, T, SHAPE, 60, side);
    const top = out(EDGE_SIDE.Top);
    const bottom = out(EDGE_SIDE.Bottom);
    const both = out(EDGE_SIDE.Both);
    const N = top.f.length - 1;
    for (let i = 0; i <= N; i++) {
      assert.ok(Math.abs(bottom.f[i] - top.f[N - i]) < 1e-6, `${PROFILE_NAMES[kind]} lustro v=${top.vs[i]}`);
      assert.ok(Math.abs(both.f[i] - Math.min(top.f[i], top.f[N - i])) < 1e-6, `${PROFILE_NAMES[kind]} obie v=${top.vs[i]}`);
    }
    assert.ok(top.f.some((x) => x < -1), `${PROFILE_NAMES[kind]} zdejmuje material`);
  }
});

// pelny cykl symulatora: liczba przejazdow (PassX), etapy, wymiany narzedzia, powroty w trybie jednokierunkowym
function runCycle(p) {
  const sim = new EdgeSimulator({ clampDelay: 0.1, spindleRamp: 200, xMaxVelocity: 2000, xAcceleration: 20000, returnVelocity: 2000, bVelocity: 400, bAcceleration: 5000 });
  assert.ok(sim.start(p), `start ${p.name}`);
  const c = { passX: 0, returns: 0, toolChanges: 0, dirs: [] };
  let prev = -1;
  for (let t = 0; t < 4000; t += 0.05) {
    sim.tick(0.05);
    const s = sim.step;
    if (s !== prev) {
      if (s === STEP.PassX) { c.passX += 1; c.dirs.push(sim.direction); }
      if (s === STEP.ReturnX) c.returns += 1;
      if (s === STEP.ToolChange) { c.toolChanges += 1; sim.start(); }
      if (s === STEP.WaitForStart && prev !== -1) return { ...c, state: sim.state() };
      prev = s;
    }
  }
  throw new Error(`cykl nie skonczony: ${p.name}, krok ${sim.step}`);
}

test('pelny cykl w symulatorze: kazdy rodzaj x strona x etapy polerowania (0, 1, 3) x tryb przejsc', () => {
  let cycles = 0;
  for (const kind of KINDS) {
    const sides = SIDE_KINDS.includes(kind) ? SIDES : [EDGE_SIDE.Top];
    for (const side of sides) {
      for (const polishSteps of [0, 1, 3]) {
        for (const bothDirections of [true, false]) {
          const p = make(kind, side, { polishSteps, bothDirections });
          const passes = generatePasses(p).passes;
          const perStage = passes.reduce((a, x) => a + x.repeats, 0);
          const r = runCycle(p);
          const name = `${PROFILE_NAMES[kind]} strona ${side} pol. ${polishSteps} ${bothDirections ? 'obie' : 'jeden'}`;
          assert.equal(r.passX, perStage * (polishSteps + 1), `${name}: przejazdy`);
          assert.equal(r.toolChanges, polishSteps, `${name}: wymiany narzedzia`);
          assert.equal(r.state.stage, polishSteps, `${name}: etap`);
          assert.equal(r.state.cycles, 1, `${name}: licznik`);
          if (bothDirections) {
            for (let i = 1; i < r.dirs.length; i++) {
              if (i % perStage !== 0) assert.notEqual(r.dirs[i], r.dirs[i - 1], `${name}: kierunek przemienny`);
            }
          } else {
            assert.ok(r.dirs.every((d) => d === r.dirs[0]), `${name}: jeden kierunek`);
            assert.equal(r.returns, (perStage - 1) * (polishSteps + 1), `${name}: powroty`);
          }
          cycles += 1;
        }
      }
    }
  }
  // 9 profili ksztaltowych + 4 asymetryczne garnkowe po 3 strony, reszta 1 strona; x 3 etapy x 2 tryby
  assert.equal(cycles, (SIDE_KINDS.length * 3 + (KINDS.length - SIDE_KINDS.length)) * 3 * 2);
});
