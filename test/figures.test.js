// Figury automatu: rejestr (wszystkie FigureType), prostokat 1:1 z GetRectanglePositions_1, bufor -> program automatu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURES, figureById, FIGURE_CONTEXT_FIELDS, figureContext, MILL_STEPS, previewMill } from '../src/shared/figures/index.js';
import { CUT, MILL, CONTEXT_DEFAULTS } from '../src/shared/figures/common.js';
import { defaults, COMMON_FIELDS } from '../src/shared/ops.js';
import { machine } from '../src/shared/geometry.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { addAutomat } from '../src/shared/automat.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DYN = { cutVel: 30, cutAcc: 60, cutDec: 60, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, zUpVel: 20, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
const COMMON = { ...defaults(COMMON_FIELDS), bladeWidth: 4 };
const CTX = figureContext(defaults(FIGURE_CONTEXT_FIELDS), M, COMMON);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('rejestr: wszystkie figury FigureType (bez PROFILES), kazda buduje bufor count + 1 wierszy', () => {
  const ids = FIGURES.map((f) => f.v);
  const expected = [10, 20, 25, 30, 40, 50, 60, 70, 80, 90, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230];
  assert.deepEqual(ids, expected);
  const cutSteps = new Set(Object.values(CUT));
  const millSteps = new Set(Object.values(MILL));
  for (const fig of FIGURES) {
    const buf = fig.build(defaults(fig.fields), CTX);
    assert.equal(buf.rows.length, buf.count + 1, fig.id);
    assert.ok(buf.count > 0, `${fig.id}: pusty bufor`);
    for (const r of buf.rows) {
      for (const k of ['x', 'y', 'step', 'r', 'angle', 'depth', 'depthEnd', 'length', 'outIn']) assert.ok(Number.isFinite(r[k]), `${fig.id}.${k}`);
      assert.ok((fig.kind === 'mill' ? millSteps : cutSteps).has(r.step), `${fig.id}: krok ${r.step}`);
    }
  }
});

test('prostokat jak GetRectanglePositions_1: naroznik, kroki Cut / CutReverse (bServiceBlocksReverse), iNumber 7', () => {
  const fig = figureById('RECTANGLE');
  const buf = fig.build({ xs: 0, ys: 0, length: 1000, width: 600, angle: 0 }, { ...CTX, blocksReverse: true });
  assert.equal(buf.count, 7);
  const pts = buf.rows.map((r) => [r.x, r.y, r.step]);
  assert.deepEqual(pts.slice(0, 5), [[0, 0, CUT.Cut], [1000, 0, CUT.CutReverse], [1000, 600, CUT.Cut], [0, 600, CUT.CutReverse], [0, 0, CUT.Nothing]]);
  // pod katem 30 st., wewnetrzne: CutInnerFull / CutInnerReverse
  const b2 = fig.build({ xs: 100, ys: 50, length: 1000, width: 600, angle: 30 }, { ...CTX, internal: 1, blocksReverse: true });
  near(b2.rows[2].x, 100 + Math.cos(Math.PI / 6) * 1000 - Math.sin(Math.PI / 6) * 600);
  near(b2.rows[2].y, 50 + Math.sin(Math.PI / 6) * 1000 + Math.cos(Math.PI / 6) * 600);
  assert.equal(b2.rows[0].step, CUT.CutInnerFull);
  assert.equal(b2.rows[1].step, CUT.CutInnerReverse);
  // z dodatkowa droga: 8 punktow z przejazdami (GoToPosition) miedzy bokami
  const b3 = fig.build({ xs: 0, ys: 0, length: 1000, width: 600, angle: 0 }, { ...CTX, additional: true, additionalDistance: 50 });
  assert.deepEqual(b3.rows.slice(0, 3).map((r) => [r.x, r.y, r.step]), [[-50, 0, CUT.Cut], [1050, 0, CUT.GoToPosition], [1000, -50, CUT.CutReverse]]);
});

test('bufor figury pily -> program automatu (ProgramAutoCutST)', () => {
  const buf = figureById('RECTANGLE').build({ xs: 0, ys: 0, length: 800, width: 500, angle: 0 }, CTX);
  const pb = new ProgramBuilder({ x: 0, y: 0, z: 0, a: 0, b: 0 }, M, DYN);
  addAutomat(pb, buf.rows, buf.rows.length, [400, 300], { profileJump: 5, smoothingJump: 100 }, COMMON);
  const prog = pb.build();
  assert.ok(prog.duration > 0);
  const cutSteps = prog.segments.filter((s) => s.step === 'StartSingleCut' || s.step === 'StartLastCut');
  assert.ok(cutSteps.length >= 4, 'cztery boki');
});

test('frez: nazwy krokow i podglad toru', () => {
  assert.ok(MILL_STEPS.find((s) => s.v === MILL.Drilling));
  const prev = previewMill([{ x: 0, y: 0, step: MILL.Mill, r: 0 }, { x: 100, y: 0, step: MILL.Drilling, r: 0 }, { x: 100, y: 0, step: 0, r: 0 }], 3, [10, 10], 20);
  assert.deepEqual(prev[0].path, [[10, 10], [110, 10]]);
  assert.ok(prev[1].path.length > 2);
  assert.equal(CONTEXT_DEFAULTS.modeMill, false);
});
