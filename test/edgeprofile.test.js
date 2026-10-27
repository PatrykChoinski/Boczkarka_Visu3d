// Receptury - zgodnosc z PLC (PLC/src/Recipes/GeneratePasses.st, ValidateProfile.st) i z testami PLC na SoftMotion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TYPE, defaultRecipes, generatePasses, validateProfile, newProfile, setProfileDefaults, profileFromValues } from '../src/shared/edgeprofile.js';

const angles = (p) => generatePasses(p).passes.map((s) => s.angleB);

test('receptury startowe: liczba przejsc jak w PLC (1/1/1/1/10/10/19)', () => {
  assert.deepEqual(defaultRecipes().map((r) => generatePasses(r).passes.length), [1, 1, 1, 1, 10, 10, 19]);
});

test('katy przejsc: fazy, cwiercwalki, polwalek bez dublowania 0', () => {
  const r = defaultRecipes();
  assert.deepEqual(angles(r[0]), [0]);
  assert.deepEqual(angles(r[1]), [45]);
  assert.deepEqual(angles(r[2]), [30]);
  assert.deepEqual(angles(r[3]), [-45]);
  assert.deepEqual(angles(r[4]), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual(angles(r[5]), [-0, -10, -20, -30, -40, -50, -60, -70, -80, -90]);
  const half = angles(r[6]);
  assert.equal(half[0], -90);
  assert.equal(half.at(-1), 90);
  assert.equal(half.filter((a) => a === 0).length, 1);
});

test('krok nietrafiajacy w koniec: koniec dokladany; za maly krok i za duzo przejsc - blad', () => {
  const p = setProfileDefaults(newProfile(), PROFILE_TYPE.TopQuarterRound);
  assert.deepEqual(angles({ ...p, angleStep: 40 }), [0, 40, 80, 90]);
  assert.equal(generatePasses({ ...p, angleStep: 0.05 }).ok, false);
  assert.equal(generatePasses({ ...p, kind: PROFILE_TYPE.HalfRound, angleStep: 4 }).ok, false, '2 x 23 > 40 przejsc');
  assert.equal(generatePasses({ ...p, repeats: 3 }).passes[0].repeats, 3);
});

test('walidacja: kody jak w PLC', () => {
  const p = { ...defaultRecipes()[4], xStart: 100, xEnd: 400, overtravel: 20 };
  const ok = generatePasses(p).passes;
  assert.equal(validateProfile(p, ok), 0);
  assert.equal(validateProfile({ ...p, xEnd: 50 }, ok), 1);
  assert.equal(validateProfile({ ...p, xEnd: 5000 }, ok), 7);
  assert.equal(validateProfile({ ...p, xStart: 0 }, ok), 7, 'naddatek poza softlimitem -5');
  assert.equal(validateProfile(p, []), 3);
  assert.equal(validateProfile({ ...p, feed: 10 }, ok), 4);
  assert.equal(validateProfile({ ...p, spindleFrequency: 150 }, ok), 5);
  assert.equal(validateProfile(p, [{ angleB: 120, repeats: 1, feed: 0, spindleFrequency: 0 }]), 2);
});

test('profil z wartosci PLC (OPC UA)', () => {
  const p = profileFromValues({ cycleKind: 5, cycleXStart: 100, cycleXEnd: 700, cycleOvertravel: 20, cycleAngleStart: 0, cycleAngleEnd: 90, cycleAngleStep: 15, cycleRepeats: 1, cycleBothDirections: true });
  assert.equal(p.kind, PROFILE_TYPE.HalfRound);
  assert.equal(generatePasses(p).passes.length, 13);
});
