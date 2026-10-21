import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, plcToolAxisXY, workAxisZ } from '../src/shared/geometry.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { ToolRecorder } from '../src/shared/toolcuts.js';
import { defaults } from '../src/shared/ops.js';
import { MILL } from '../src/shared/figures/common.js';
import {
  MILL_OPS, MILL_COMMON_DEFAULTS, millDepths, addMillLine, addAutomatMill, circleGeometry, ellipseGeometry, millStripesLines,
  millBlocksLines, millEdgesLines,
} from '../src/shared/millops.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const BASE = { cutTiltDiameter: 640, headRotationDiameter: 198, millTiltDiameter: 450, millWidth: 40, millLength: 250, drillLength: 180,
  materialHeight: 800, materialThickness: 30, polishDiameter: 120, polishHeight: -60, mode: 'mill' };
const DYN = { cutVel: 100, cutAcc: 500, cutDec: 500, fastVel: 300, fastAcc: 1000, zVel: 50, zAcc: 500, zUpVel: 50, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
const M = machine(BASE);
const START = { x: 0, y: 0, z: 0, a: 0, b: 90 };

function record(p, dt = 0.02) {
  const rec = new ToolRecorder();
  for (let t = 0; t <= p.duration; t += dt) rec.update(p.at(t).pose, M);
  rec.update(p.at(p.duration).pose, M);
  return rec;
}

function runOp(id, values = {}, common = {}) {
  const op = MILL_OPS.find((o) => o.id === id);
  const pb = new ProgramBuilder(START, M, DYN);
  op.build(pb, { ...defaults(op.fields), ...values }, { ...MILL_COMMON_DEFAULTS, ...common });
  return pb.build();
}

test('tablica glebokosci frezu (Depths): rowne przejscia, staly skok z minimalnym ostatnim, jedno przejscie', () => {
  assert.deepEqual(millDepths({ depthMode: 'same', passes: 3, reserve: 0 }, 30), [10, 20, 30]);
  assert.deepEqual(millDepths({ depthMode: 'same', passes: 2, reserve: 2 }, 30), [16, 32]);
  // T 30, skok 12: 12, 24, 30 (ostatni 6 >= 2)
  assert.deepEqual(millDepths({ depthMode: 'step', step: 12, minLast: 2, reserve: 0 }, 30), [12, 24, 30]);
  // T 25, skok 12: ostatni skok 1 < 2 - przejscie mniej: 12, 25
  assert.deepEqual(millDepths({ depthMode: 'step', step: 12, minLast: 2, reserve: 0 }, 25), [12, 25]);
  assert.deepEqual(millDepths({ depthMode: 'one', reserve: 1 }, 30), [31]);
});

test('MillST: przejscia na zmiane, zjazd Z w trakcie ruchu (fCutOvertakingPrecent), przejscie czyszczace, os = narzedzie + (0, -MTD/2)', () => {
  const pb = new ProgramBuilder(START, M, DYN);
  addMillLine(pb, [600, 500], [1600, 500], { ...MILL_COMMON_DEFAULTS, passes: 2, overtaking: 50 });
  const p = pb.build();
  const mills = p.segments.filter((s) => s.step === 'Mill');
  assert.equal(mills.length, 2);
  // pierwsze przejscie konczy sie na koncu linii, drugie wraca na poczatek
  const [ax1] = plcToolAxisXY(1600, 500, 0, 90, M);
  const [ax0, ay0] = plcToolAxisXY(600, 500, 0, 90, M);
  near(mills[0].end.x, ax1);
  near(mills[1].end.x, ax0);
  near(mills[1].end.y, ay0);
  near(ay0, 500 - 225);
  near(mills[1].end.z, workAxisZ(30, 90, M));
  // w polowie pierwszego przejscia Z juz na glebokosci 15 (zjazd na 50 % dlugosci)
  const mid = p.segments.indexOf(mills[0]);
  const t0 = p.segments.slice(0, mid).reduce((t, s) => t + s.duration, 0);
  near(mills[0].poseAt(mills[0].duration * 0.6).z, workAxisZ(15, 90, M), 0.5);
  assert.ok(t0 > 0);
  const last = p.segments.find((s) => s.step === 'MillLast');
  near(last.end.x, ax1);
  near(p.at(p.duration).pose.z, workAxisZ(-20, 90, M));
  const rec = record(p);
  near(rec.summary().depth, 30, 0.05);
});

test('MillST z bServiceMillZFirst: najpierw Z, potem przejscie, bez przejscia czyszczacego', () => {
  const pb = new ProgramBuilder(START, M, DYN);
  addMillLine(pb, [600, 500], [1600, 500], { ...MILL_COMMON_DEFAULTS, passes: 3, zFirst: true });
  const p = pb.build();
  assert.equal(p.segments.filter((s) => s.step === 'MillZDown').length, 3);
  assert.equal(p.segments.filter((s) => s.step === 'MillLast').length, 0);
});

test('operacje frezu: tor narzedzia (slad) w polach operacji', () => {
  // linia pod katem i dlugoscia
  let rec = record(runOp('millLine', { twoPoint: false, x0: 600, y0: 600, angle: 90, length: 500 }));
  let b = rec.bounds();
  near(b[1], 600 - 20, 1); near(b[3], 1100 + 20, 1); near(b[0], 580, 1);
  // okrag wewnetrzny od srodka: tor promien R - W/2, slad do R
  rec = record(runOp('millCircle', { x: 1500, y: 1200, r: 300, internal: 1, center: true }));
  b = rec.bounds();
  near(b[0], 1200, 1.5); near(b[2], 1800, 1.5); near(b[1], 900, 1.5); near(b[3], 1500, 1.5);
  near(rec.summary().depth, 30, 0.05);
  // okrag zewnetrzny od gory toru (bManualCircleCenter FALSE): srodek ponizej punktu o r + W/2
  const g = circleGeometry({ x: 1000, y: 1000, r: 200, internal: 0, center: false }, 40);
  assert.deepEqual(g.C, [1000, 780]);
  near(g.r, 220);
  // elipsa zewnetrzna: dlugosc / szerokosc + W
  const e = ellipseGeometry({ xs: 800, ys: 1000, length: 1000, width: 600, internal: 0 }, 40);
  near(e.a, 520); near(e.b, 320);
  rec = record(runOp('millEllipse', { xs: 800, ys: 1000, length: 1000, width: 600, internal: 1 }));
  b = rec.bounds();
  near(b[0], 780, 1.5); near(b[2], 1760 + 20, 1.5); near(b[3], 1000 + 280 + 20, 1.5);   // tor od lewego wierzcholka (xs)
  // luk z promienia: slad od poczatku do konca
  rec = record(runOp('millArc', { x0: 600, y0: 500, x1: 1600, y1: 500, type: 0, r: 800, cw: true }));
  b = rec.bounds();
  near(b[0], 580, 1.5); near(b[2], 1620, 1.5);
  assert.ok(b[3] > 600, 'luk CW wypukly w gore');
});

test('pasy, bloki, krawedzie frezu: linie jak MillStripesST / MillBlocksST / EdgesST', () => {
  // N pasow = N+1 linii, odstep W + szerokosc frezu
  const s = millStripesLines({ xs: 500, ys: 500, xCut: true, number: 2, width: 200, length: 1000 }, 40);
  assert.deepEqual(s.map((l) => l.zero), [[500, 500], [500, 740], [500, 980]]);
  assert.deepEqual(s.map((l) => l.end[0]), [1500, 1500, 1500]);
  // stol: N = szerokosc stolu / szerokosc frezu, linie co szerokosc frezu
  const t = millStripesLines({ table: true, xs: 0, ys: 0, xCut: true, tableWidth: 200, tableLength: 800 }, 40);
  assert.equal(t.length, 6);
  near(t[5].zero[1], 200);
  const bl = millBlocksLines({ xs: 500, ys: 400, xLast: 1200, yLast: 800, widths: [400, 400], lengths: [600] }, 40);
  assert.deepEqual(bl.filter((l) => l.phase === 'X').map((l) => l.zero[1]), [400, 840, 1280]);
  assert.deepEqual(bl.filter((l) => l.phase === 'Y').map((l) => l.zero[0]), [500, 1140]);
  const ed = millEdgesLines({ xs: 0, ys: 0, length: 1000, width: 500, angle: 0, internal: 0 }, 40);
  assert.deepEqual(ed.map((l) => l.zero.map((v) => Math.round(v))), [[0, 0], [1040, 0], [1040, 540], [0, 540]]);
  // symulacja pasow: kazda linia osobne przejscia frezem (MillST) z postojem miedzy liniami
  const p = runOp('millStripes', { xs: 500, ys: 500, xCut: true, number: 1, width: 200, length: 600 }, { passes: 1 });
  assert.equal(p.segments.filter((sg) => sg.step === 'WAIT_START').length, 1);
  assert.equal(p.segments.filter((sg) => sg.step === 'Mill').length, 2);
});

test('automat frezu (ProgramAutoMillST): linie, luk, okrag, wiercenie, zmiana glebokosci', () => {
  const R = (x, y, step, more = {}) => ({ x, y, step, r: 0, angle: 0, depth: 0, depthEnd: 0, length: 0, ...more });
  const rows = [
    R(0, 0, MILL.Mill), R(1000, 0, MILL.MillArcCW, { r: 800 }), R(1000, 600, MILL.GoToPosition), R(200, 300, MILL.Drilling, { depth: 25 }),
    R(0, 0, MILL.ChangeDepth, { depth: 10 }), R(0, 0, MILL.CircleCenterPointInner, { r: 150 }),
  ];
  const pb = new ProgramBuilder(START, M, DYN);
  addAutomatMill(pb, rows, rows.length, [500, 400], { ...MILL_COMMON_DEFAULTS, passes: 2 });
  const p = pb.build();
  const steps = new Set(p.segments.map((s) => s.step));
  for (const st of ['Mill', 'MillArc', 'GoToPosition', 'MOVE_DRILL', 'MillCircle']) assert.ok(steps.has(st), st);
  // wiercenie na 25 mm w punkcie wiersza 4 (+ punkt startowy)
  const drill = p.segments.find((s) => s.step === 'MOVE_DRILL');
  near(drill.end.z, workAxisZ(25, 90, M));
  const [dx, dy] = plcToolAxisXY(700, 700, 0, 90, M);
  near(drill.end.x, dx); near(drill.end.y, dy);
  // po ChangeDepth okrag na glebokosci 10
  const circle = p.segments.filter((s) => s.step === 'MillCircle').at(-1);
  near(circle.end.z, workAxisZ(10, 90, M), 1e-6);
  assert.ok(p.segments.some((s) => s.label === 'Krok 1'));
});

test('automat frezu z bProgramReapitingOver: zamkniety ksztalt w calosci na kazdej glebokosci', () => {
  const R = (x, y, step) => ({ x, y, step, r: 0, angle: 0, depth: 0, depthEnd: 0, length: 0 });
  const rows = [R(0, 0, MILL.Mill), R(500, 0, MILL.Mill), R(500, 500, MILL.Mill), R(0, 0, MILL.Nothing)];
  const pb = new ProgramBuilder(START, M, DYN);
  addAutomatMill(pb, rows, rows.length, [500, 500], { ...MILL_COMMON_DEFAULTS, passes: 3 }, { closedShapes: true });
  const p = pb.build();
  assert.equal(p.segments.filter((s) => s.step === 'MillShape').length, 3);
  assert.equal(p.segments.filter((s) => s.step === 'Mill').length, 0);
});
