// Ruch offline: profil trapezowy i program ciecia (predkosci, przyspieszenia, kolejnosc krokow).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile, cutProgram, gotoProgram, depthTable, AXES } from '../src/shared/motion.js';
import { machine, bladeFrame, penetration, plcAxisXY, plcAxisZ, lineAngle } from '../src/shared/geometry.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DYN = { cutVel: 30, cutAcc: 60, cutDec: 40, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('profil trapezowy: droga, czas, predkosc maksymalna', () => {
  const p = new Profile(800, 30, 60, 40);
  // rampa 0.5 s (7.5 mm), hamowanie 0.75 s (11.25 mm), reszta stala predkosc
  near(p.tAcc, 0.5); near(p.tDec, 0.75); near(p.vMax, 30);
  near(p.duration, 0.5 + 0.75 + (800 - 7.5 - 11.25) / 30);
  near(p.s(p.duration), 800); near(p.s(0.5), 7.5); near(p.v(10), 30);
});

test('profil trojkatny, gdy droga za krotka', () => {
  const p = new Profile(5, 30, 60, 60);
  assert.ok(p.vMax < 30);
  near(p.tCruise, 0);
  near(p.s(p.duration), 5);
  near(p.s(p.duration / 2), 2.5);
});

// predkosc i przyspieszenie z rozniczkowania pozycji
function checkLimits(program) {
  const dt = 0.002;
  let prev = null; let prevV = null; let maxV = 0;
  for (let t = 0; t <= program.duration; t += dt) {
    const { pose, step } = program.at(t);
    if (prev && prev.step === step) {
      const v = Math.hypot(pose.x - prev.pose.x, pose.y - prev.pose.y) / dt;
      if (step === 'StartSingleCut' || step === 'StartLastCut') {
        assert.ok(v <= DYN.cutVel * 1.001, `predkosc ciecia ${v}`);
        if (prevV !== null) assert.ok(Math.abs(v - prevV) / dt <= Math.max(DYN.cutAcc, DYN.cutDec) * 1.05, `przyspieszenie ${(v - prevV) / dt}`);
        maxV = Math.max(maxV, v);
        prevV = v;
      }
      const vz = Math.abs(pose.z - prev.pose.z) / dt;
      assert.ok(vz <= DYN.zVel * 1.001, `predkosc Z ${vz}`);
      assert.ok(Math.abs(pose.b - prev.pose.b) / dt <= DYN.bVel * 1.001);
    } else {
      prevV = null;
    }
    prev = { pose, step };
  }
  return maxV;
}

test('program ciecia: kroki jak CutST, predkosci i przyspieszenia w granicach, koniec nad materialem', () => {
  const cut = { x0: 200, y0: 300, x1: 900, y1: 700, b: 30, above: 20, depths: depthTable(24, 3) };
  const prog = cutProgram({ x: 0, y: 0, z: 0, a: 0, b: 0 }, cut, M, DYN);
  const steps = [...new Set(prog.segments.map((s) => s.step))];
  assert.deepEqual(steps, ['MoveToStartPosition', 'StartCutDepth', 'StartSingleCut', 'StartLastCut', 'StartMoveAboveMaterial', 'CutFinish']);
  near(checkLimits(prog), DYN.cutVel, 0.01);
  const end = prog.at(prog.duration).pose;
  const a = lineAngle(200, 300, 900, 700);
  const [x, y] = plcAxisXY(900, 700, a, 30, M);    // 3 przejscia - koniec po drugiej stronie
  near(end.x, x, 1e-6); near(end.y, y, 1e-6); near(end.a, a); near(end.z, plcAxisZ(-20, 30, M), 1e-6);
});

test('tarcza w materiale tylko przy zjezdzie, cieciu i wyjezdzie (dojazd z innym wychylem nie zahacza)', () => {
  // poprzednie ciecie B = 0 konczy sie nad materialem, kolejne B = 45 - obrot B dopiero wysoko
  const first = cutProgram({ x: 0, y: 0, z: 0, a: 0, b: 0 }, { x0: 200, y0: 300, x1: 1000, y1: 300, b: 0, above: 20, depths: [10] }, M, DYN);
  const from = first.at(first.duration).pose;
  const prog = cutProgram(from, { x0: 200, y0: 300, x1: 900, y1: 700, b: 45, above: 20, depths: [8, 16] }, M, DYN);
  for (let t = 0; t <= prog.duration; t += 0.01) {
    const { pose, step } = prog.at(t);
    const pen = penetration(bladeFrame(pose, M), M);
    if (!['StartCutDepth', 'StartSingleCut', 'StartLastCut', 'StartMoveAboveMaterial'].includes(step)) assert.ok(pen <= 1e-6, `${step}: tarcza ${pen.toFixed(2)} mm w materiale`);
  }
});

test('dojazd do pozycji: wszystkie osie na koncu w zadanej pozycji, Z najpierw w gore', () => {
  const from = { x: 100, y: 100, z: 200, a: 0, b: 0 };
  const target = { x: 600, y: -200, z: 50, a: 90, b: 30 };
  const prog = gotoProgram(from, target, DYN);
  const end = prog.at(prog.duration).pose;
  for (const ax of AXES) near(end[ax], target[ax]);
  assert.equal(prog.segments.length, 2);
  near(prog.segments[0].end.z, 50);
  checkLimits(prog);
});
