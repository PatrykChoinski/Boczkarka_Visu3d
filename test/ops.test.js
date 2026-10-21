// Operacje piły (offline) i automat: programy jak w PLC - kroki, geometria, tarcza w materiale tylko przy cieciu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, COMMON_FIELDS, defaults } from '../src/shared/ops.js';
import { ProgramBuilder } from '../src/shared/motion.js';
import { machine, bladeFrame, penetration, plcAxisXY, plcAxisZ } from '../src/shared/geometry.js';
import { depthTables, choosePrimary, cutPlan, sawOffset } from '../src/shared/cutst.js';
import { stripesLines, blocksLines, edgesLines, getAngleFun } from '../src/shared/sawlines.js';
import { arcPlan, ellipsePoints } from '../src/shared/arcs.js';
import { profileCuts, profileDepth, profileCircle } from '../src/shared/profiles.js';
import { addAutomat } from '../src/shared/automat.js';
import { CutRecorder } from '../src/shared/cuts.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const DYN = { cutVel: 30, cutAcc: 60, cutDec: 60, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, zUpVel: 20, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
const START = { x: 0, y: 0, z: 0, a: 0, b: 0 };
const COMMON = { ...defaults(COMMON_FIELDS), bladeWidth: 4 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const CUT_STEPS = new Set(['StartCutDepth', 'StartSingleCut', 'StartLastCut', 'StartCutOvertaking', 'StartMoveAboveMaterial', 'CutDepthPrepare', 'MOVE_Z_DOWN', 'MOVE_CUT', 'MOVE_Z_UP', 'MoveToBasePosition', 'MoveToStartPosition']);

function run(build) {
  const pb = new ProgramBuilder(START, M, DYN);
  build(pb);
  return pb.build();
}

// probkowanie programu: wartosci skonczone, maks. zaglebienie, zapis rzazu
function sample(prog, dt = 0.1) {
  const rec = new CutRecorder();
  let maxPen = 0;
  for (let t = 0; t <= prog.duration + 1e-9; t += dt) {
    const { pose } = prog.at(t);
    for (const k of ['x', 'y', 'z', 'a', 'b']) assert.ok(Number.isFinite(pose[k]), `${k} = ${pose[k]} w t = ${t}`);
    maxPen = Math.max(maxPen, penetration(bladeFrame(pose, M), M));
    rec.update(pose, M);
  }
  return { maxPen, rec };
}

for (const op of OPS) {
  test(`operacja ${op.name} (${op.plc}): program z domyslnymi wartosciami tnie material`, () => {
    const prog = run((pb) => op.build(pb, defaults(op.fields), COMMON));
    assert.ok(prog.duration > 1 && Number.isFinite(prog.duration), `czas ${prog.duration}`);
    const { maxPen, rec } = sample(prog);
    assert.ok(maxPen > 5, `max zaglebienie ${maxPen}`);
    assert.ok(rec.cuts.length > 0);
    // koniec nad materialem
    const end = prog.at(prog.duration).pose;
    assert.ok(penetration(bladeFrame(end, M), M) < 0, 'koniec nad materialem');
  });
}

test('GetAngleFun: kat linii (-90, 90] niezalezny od kierunku', () => {
  near(getAngleFun(0, 0, 100, 0), 0); near(getAngleFun(100, 0, 0, 0), 0);
  near(getAngleFun(0, 0, 0, 100), 90); near(getAngleFun(0, 100, 0, 0), 90);
  near(getAngleFun(0, 0, 100, 100), 45); near(getAngleFun(0, 0, 100, -100), -45); near(getAngleFun(100, 100, 0, 0), 45);
});

test('tablice glebokosci: przeciwna parzystosc, ostatnia = calosc, wybor tablicy jak IsPrimaryTable', () => {
  for (const passes of [1, 2, 3, 4, 5]) {
    const t = depthTables({ mode: 'same', total: 30, passes, maxJump: 0 });
    assert.equal(t.primary.length, passes);
    near(t.primary.at(-1), 30); near(t.secondary.at(-1), 30);
    assert.notEqual(t.primary.length % 2, t.secondary.length % 2);
  }
  const t = depthTables({ mode: 'step', total: 25, step: 10, minLast: 2 });
  assert.deepEqual(t.primary, [10, 20, 25]);
  // domyslnie nieparzysta liczba przejsc (koniec w punkcie koncowym); odwrocenie zmienia parzystosc
  const tt = depthTables({ mode: 'same', total: 30, passes: 2 });
  const c = { x0: 0, y0: 0, x1: 100, y1: 0 };
  assert.equal((choosePrimary(c, tt) ? tt.primary : tt.secondary).length % 2, 1);
  assert.equal((choosePrimary({ ...c, reverse: true }, tt) ? tt.primary : tt.secondary).length % 2, 0);
});

test('ciecie wewnetrzne: konce odsuniete o pol cieciwy tarczy, glebokosc ograniczona do dlugosci', () => {
  const c = { x0: 0, y0: 0, x1: 1000, y1: 0, internal: 1, depth: { mode: 'same', total: 30, passes: 3 }, innerCorr: 0 };
  const plan = cutPlan(c, M);
  const last = plan.passes.at(-1);
  // 3 przejscia: ostatnie od poczatku do konca; cel z korekta +2 mm, start tam, gdzie skonczylo poprzednie
  near(1000 - last.to[0], sawOffset(last.depth, 1000, M.discDiameter, 2), 1e-6);
  near(last.from[0], sawOffset(last.depth, 1000, M.discDiameter, 0), 1e-6);
  const short = cutPlan({ ...c, x1: 200 }, M);
  assert.ok(short.table.at(-1) < 30, `krotkie ciecie wewn. ${short.table.at(-1)}`);
});

test('skos: plaszczyzna tarczy przecina gorna powierzchnie na linii ciecia przy kazdej glebokosci', () => {
  const pb = new ProgramBuilder(START, M, DYN);
  OPS[0].build(pb, { x0: 400, y0: 400, x1: 1200, y1: 400, internal: 0, reverse: false }, { ...COMMON, tilt: true, b: 45 });
  const prog = pb.build();
  let n = 0;
  for (let t = 0; t <= prog.duration; t += 0.05) {
    const { pose, step } = prog.at(t);
    if (step !== 'StartSingleCut' && step !== 'StartLastCut') continue;
    const f = bladeFrame(pose, M);
    const top = -M.materialHeight;
    // A = 0: normalna bez skladowej X -> y przeciecia z plaszczyzna z = top
    const y = f.center[1] - f.normal[2] * (top - f.center[2]) / f.normal[1];
    near(y, 400, 1e-6);
    near(pose.b, 45);
    n++;
  }
  assert.ok(n > 10);
});

test('pasy / bloki / krawedzie: linie jak w PLC', () => {
  const s = stripesLines({ xs: 0, ys: 0, xCut: true, twoPoint: false, length: 1000, constant: true, width: 100, number: 3, bladeWidth: 4, passes: 1 });
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((l) => l.y0), [0, 104, 208, 312]);
  assert.deepEqual(s.map((l) => l.x0), [0, 1000, 0, 1000]);     // co druga zamieniona (jedno przejscie)
  const b = blocksLines({ xs: 0, ys: 0, lengths: [500, 400], widths: [300], bladeWidth: 4, passes: 3 });
  assert.equal(b.length, 2 + 3);
  near(b[1].y0, 304);
  assert.ok(b.slice(2).every((l) => l.reverse));
  const e = edgesLines({ xs: 0, ys: 0, length: 1000, width: 500, angle: 0, internal: 0, bladeWidth: 4 });
  assert.equal(e.length, 4);
  assert.deepEqual([e[1].x0, e[1].y0, e[1].x1, e[1].y1], [1004, 0, 1004, 504]);
  assert.deepEqual(e.map((l) => l.reverse), [false, true, false, true]);
});

test('luk: srodek po wlasciwej stronie, A styczne, os glowicy na promieniu R -+ h/2', () => {
  const p = arcPlan([0, 0], [1000, 0], 800, true);
  assert.ok(p.C[1] < 0, 'CW - srodek pod cieciwa');
  near(Math.hypot(p.C[0], p.C[1]), 800, 1e-6);
  const [x, y] = plcAxisXY(0, 0, p.aS, 0, M);
  near(Math.hypot(x - p.C[0], y - p.C[1]), p.inner ? 800 - 50 : 800 + 50, 1e-6);
});

test('elipsa: 120 odcinkow, start i koniec w gornym wierzcholku, punkty na elipsie', () => {
  const e = ellipsePoints(1000, 1000, 1400, 900);
  assert.equal(e.pts.length, 122 - 1);
  near(e.pts[0][0], 1000); near(e.pts[0][1], 1000);
  for (const [x, y] of e.pts) near(((x - 1000) / 700) ** 2 + ((y - 550) / 450) ** 2, 1, 1e-9);
});

test('profil: ostatnie ciecie na punkcie koncowym, glebokosc z okregu', () => {
  const { cuts, circle } = profileCuts({ P0: [0, 0], P1: [40, 0], d0: 0, d1: 30, R: 40, length: 500, convex: true, xProfile: true, jump: 5 });
  assert.equal(cuts.length, 9);
  near(cuts.at(-1).x0, 40); near(cuts[0].depth, 0, 1e-6); near(cuts.at(-1).depth, 30, 1e-6);
  assert.ok(cuts.every((c) => c.reverse));
  // wypukly: glebokosc rosnie coraz szybciej (zaokraglenie krawedzi)
  const d = cuts.map((c) => c.depth);
  assert.ok(d[4] - d[3] < d[8] - d[7]);
  near(profileDepth(circle, 40), 30, 1e-6);
  assert.ok(profileCircle([0, 0], [40, 30], 40, false).center[1] < profileCircle([0, 0], [40, 30], 40, true).center[1]);
});

test('automat: kroki jak ProgramAutoCutST - ciecie, luk, przejazd, okrag, skos, zmiana glebokosci', () => {
  const rows = [
    { x: 0, y: 0, step: 1 }, { x: 1000, y: 0, step: 3, r: 700 }, { x: 1000, y: 800, step: 2 },
    { x: 600, y: 400, step: 26, r: 150 }, { x: 0, y: 800, step: 19, depth: 20 }, { x: 0, y: 800, step: 12, angle: 30 },
    { x: 0, y: 0, step: 0 },
  ];
  const prog = run((pb) => addAutomat(pb, rows, 6, [300, 300], {}, COMMON));
  const idx = [...new Set(prog.segments.map((s) => s.index))];
  assert.deepEqual(idx, [0, 1, 2, 3, 5]);
  const labels = prog.segments.map((s) => s.label);
  assert.ok(labels.some((l) => /Łuk CW/.test(l)) && labels.some((l) => /Skos/.test(l)));
  // skos po zmianie glebokosci - najglebiej 20 mm
  let maxSlope = 0;
  for (let t = 0; t <= prog.duration; t += 0.05) {
    const r = prog.at(t);
    if (r.index === 5) maxSlope = Math.max(maxSlope, penetration(bladeFrame(r.pose, M), M));
  }
  near(maxSlope, 20, 0.5);
  const { maxPen } = sample(prog, 0.05);
  assert.ok(maxPen > 25);
  void CUT_STEPS; void plcAxisZ;
});

test('ciecie proste kat + dlugosc (CutST.GetPositions): koniec z kata, w strone lasera odwrotnie, kat glowicy zadany', () => {
  const op = OPS.find((o) => o.id === 'cut');
  const base = { twoPoint: false, x0: 500, y0: 400, angle: 30, length: 1000, internal: 0, reverse: false };
  const [l] = op.lines({ ...base, toLaser: false });
  near(l.x1, 500 + 1000 * Math.cos(30 * Math.PI / 180), 1e-9);
  near(l.y1, 400 + 1000 * Math.sin(30 * Math.PI / 180), 1e-9);
  const [t] = op.lines({ ...base, toLaser: true });
  near(t.x1, 500 - 1000 * Math.cos(30 * Math.PI / 180), 1e-9);
  const pb = new ProgramBuilder(START, M, DYN);
  op.build(pb, { ...base, toLaser: true }, COMMON);
  const prog = pb.build();
  let n = 0;
  for (let s = 0; s <= prog.duration; s += 0.1) {
    const { pose, step } = prog.at(s);
    if (step === 'StartSingleCut' || step === 'StartLastCut') { near(pose.a, 30, 1e-9); n++; }
  }
  assert.ok(n > 5);
  // pola widoczne tylko w swoim trybie
  const vis = (k, v) => { const f = op.fields.find((x) => x.k === k); return !f.show || f.show(v); };
  assert.ok(vis('x1', { twoPoint: true }) && !vis('x1', { twoPoint: false }));
  assert.ok(vis('angle', { twoPoint: false }) && !vis('angle', { twoPoint: true }));
});

// #135: konce ciec prostych w automacie - linia 0 .. 1000 w X od punktu startowego (500, 500)
function automatEnds(step, angle = 0) {
  const prog = run((pb) => addAutomat(pb, [{ x: 0, y: 0, step, angle }, { x: 1000, y: 0, step: 0 }], 1, [500, 500], {}, { ...COMMON, thickness: 40 }));
  const rec = new CutRecorder();
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = 0; t <= prog.duration; t += 0.01) {
    const pose = prog.at(t).pose;
    rec.update(pose, M);
    const f = bladeFrame(pose, M);
    if (penetration(f, M) > 0.05) { lo = Math.min(lo, f.lowest[0] - 500); hi = Math.max(hi, f.lowest[0] - 500); }
  }
  let top = [Infinity, -Infinity];
  for (const c of rec.cuts) for (const r of c.runs()) for (const [s] of r) { const x = c.pointAt(s, 0)[0] - 500; top = [Math.min(top[0], x), Math.max(top[1], x)]; }
  return { lo, hi, top };
}

test('automat (#135): ciecie zewnetrzne wychodzi za punkt o szerokosc tarczy, wewnetrzne / pol-wewnetrzne nie wychodza (tez skos)', () => {
  const bw = M.bladeWidth;
  const outer = automatEnds(1);
  near(outer.lo, -bw, 0.2);
  near(outer.hi, 1000 + bw, 0.2);
  const inner = automatEnds(5);
  assert.ok(inner.top[0] >= 0 && inner.top[1] <= 1000, `wewn. rzaz ${inner.top}`);
  const start = automatEnds(6);           // wewn. poczatek: poczatek w punkcie, koniec zewnetrzny
  assert.ok(start.top[0] >= 0);
  near(start.hi, 1000 + bw, 0.2);
  const end = automatEnds(7);             // wewn. koniec
  near(end.lo, -bw, 0.2);
  assert.ok(end.top[1] <= 1000);
  const slopeOuter = automatEnds(12, 45);
  near(slopeOuter.lo, -bw, 0.2);
  near(slopeOuter.hi, 1000 + bw, 0.2);
  const slopeInner = automatEnds(20, 45);  // skos wewn.: odsuniecie z glebokosci w plaszczyznie tarczy
  assert.ok(slopeInner.top[0] >= 0 && slopeInner.top[1] <= 1000, `skos wewn. rzaz ${slopeInner.top}`);
});
