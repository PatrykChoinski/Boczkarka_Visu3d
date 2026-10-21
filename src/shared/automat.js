// Automat - bufor krokow programu jak ProgramAutoCutST / ProgramAutoProfileST (PLC):
// tablice aProgramXPosition / YPosition / NextStep / Radius / Angle / Depth / DepthEnd / Length / OutIn [0..249],
// punkty wzgledem fProgramStartPositionX/Y. Krok i dziala od punktu i do punktu i+1 (luk: promien z wiersza i,
// okrag: punkt i = gora / srodek). Kazdy krok uruchamia program jak w PLC (CutST, CutArcST, CutCircleST, GoTo,
// profil, wygladzanie); kolejny krok startuje po zakonczeniu poprzedniego.

import { addCutST } from './cutst.js';
import { cutParams } from './common.js';
import { addArc, addCircle, arcPlan, circlePlan } from './arcs.js';
import { addProfile, addSmoothing, profileCuts } from './profiles.js';
import { getAngleFun } from './sawlines.js';
import { plcAxisXY } from './geometry.js';

const DEG = Math.PI / 180;

// ProgramCutStep (PLC) - nazwy na ekranie; prof - tylko w programie profili (ProgramAutoProfileST)
export const STEPS = [
  { v: 0, id: 'Nothing', name: 'Nic' },
  { v: 1, id: 'Cut', name: 'Cięcie' },
  { v: 2, id: 'GoToPosition', name: 'Przejazd' },
  { v: 3, id: 'CutArcCW', name: 'Łuk CW' },
  { v: 4, id: 'CutArcCCW', name: 'Łuk CCW' },
  { v: 5, id: 'CutInnerFull', name: 'Cięcie wewn.' },
  { v: 6, id: 'CutInnerStart', name: 'Wewn. początek' },
  { v: 7, id: 'CutInnerEnd', name: 'Wewn. koniec' },
  { v: 8, id: 'ProfileConvexX', name: 'Profil wypukły X', prof: true },
  { v: 9, id: 'ProfileConvexY', name: 'Profil wypukły Y', prof: true },
  { v: 10, id: 'ProfileConcaveX', name: 'Profil wklęsły X', prof: true },
  { v: 11, id: 'ProfileConcaveY', name: 'Profil wklęsły Y', prof: true },
  { v: 12, id: 'Slope', name: 'Skos' },
  { v: 13, id: 'SlopeReverse', name: 'Skos odwrócony' },
  { v: 14, id: 'SlopeDouble', name: 'Skos podwójny' },
  { v: 15, id: 'SmoothingConvexX', name: 'Wygładz. wypukłe X', prof: true },
  { v: 16, id: 'SmoothingConvexY', name: 'Wygładz. wypukłe Y', prof: true },
  { v: 17, id: 'SmoothingConcaveX', name: 'Wygładz. wklęsłe X', prof: true },
  { v: 18, id: 'SmoothingConcaveY', name: 'Wygładz. wklęsłe Y', prof: true },
  { v: 19, id: 'ChangeDepth', name: 'Zmień głębokość' },
  { v: 20, id: 'SlopeInner', name: 'Skos wewn.' },
  { v: 21, id: 'SlopeInnerReverse', name: 'Skos wewn. odwr.' },
  { v: 22, id: 'CutReverse', name: 'Cięcie odwrócone' },
  { v: 23, id: 'CutInnerReverse', name: 'Wewn. odwrócone' },
  { v: 25, id: 'CircleTopPointOuter', name: 'Okrąg zewn. (góra)' },
  { v: 26, id: 'CircleCenterPointOuter', name: 'Okrąg zewn. (środek)' },
  { v: 27, id: 'Confirm', name: 'Potwierdzenie' },
  { v: 29, id: 'CircleTopPointInner', name: 'Okrąg wewn. (góra)' },
  { v: 30, id: 'CircleCenterPointInner', name: 'Okrąg wewn. (środek)' },
];
export const stepName = (v) => STEPS.find((s) => s.v === Number(v))?.name ?? String(v);

// Proste ciecia: krok -> {internal, reverse, slope}
const LINE_STEPS = {
  1: { internal: 0 }, 5: { internal: 1 }, 6: { internal: 2 }, 7: { internal: 3 },
  22: { internal: 0, reverse: true }, 23: { internal: 1, reverse: true },
  12: { internal: 0, slope: [false] }, 13: { internal: 0, slope: [true] }, 14: { internal: 0, slope: [true, false] },
  20: { internal: 1, slope: [false] }, 21: { internal: 1, slope: [true] },
};
const CIRCLE_STEPS = { 25: { inner: false, center: false }, 26: { inner: false, center: true }, 29: { inner: true, center: false }, 30: { inner: true, center: true } };
const PROFILE_STEPS = { 8: { convex: true, x: true }, 9: { convex: true, x: false }, 10: { convex: false, x: true }, 11: { convex: false, x: false } };
const SMOOTH_STEPS = { 15: { convex: true, x: true }, 16: { convex: true, x: false }, 17: { convex: false, x: true }, 18: { convex: false, x: false } };

// Konce ciec prostych w automacie (#135): zewnetrzne wychodza za material o szerokosc tarczy (najnizszy punkt tarczy
// za punkt linii, jak fCutOuterAdditionalDistance), wewnetrzne / pol-wewnetrzne nie wychodza za punkt (tez przy skosie)
const OUTER_INNER_ENDS = (m) => ({ outerAdd: m.bladeWidth, innerSlant: true });

// Wiersze programu z tablic PLC
export function rowsFromArrays(v, count) {
  const n = Math.max(0, Math.min(250, Math.round(Number(count) || 0)));
  const at = (arr, i) => Number(arr?.[i]) || 0;
  const rows = [];
  for (let i = 0; i < n + 1; i++) {
    rows.push({
      x: at(v.progX, i), y: at(v.progY, i), step: at(v.progStep, i), r: at(v.progRadius, i), angle: at(v.progAngle, i),
      depth: at(v.progDepth, i), depthEnd: at(v.progDepthEnd, i), length: at(v.progLength, i), outIn: at(v.progOutIn, i),
    });
  }
  return rows;
}

// Linia kroku i (punkt i -> i+1) z punktem startowym; OuterInner (bServiceCutProgramOuterInner) - przesuniecie o szer. tarczy
function stepLine(rows, i, origin, opt, bladeWidth) {
  const p = rows[i]; const q = rows[i + 1] || rows[i];
  let l = { x0: origin[0] + p.x, y0: origin[1] + p.y, x1: origin[0] + q.x, y1: origin[1] + q.y };
  if (opt.outerInner && (p.outIn === 1 || p.outIn === 2)) {
    const a = getAngleFun(l.x0, l.y0, l.x1, l.y1) * DEG;
    const s = p.outIn === 2 ? 1 : -1;
    const dx = Math.sin(a) * bladeWidth * s; const dy = -Math.cos(a) * bladeWidth * s;
    l = { x0: l.x0 + dx, y0: l.y0 + dy, x1: l.x1 + dx, y1: l.y1 + dy };
  }
  return l;
}

// Opis krokow do podgladu: [{i, step, kind, path: [[x, y], ...]}]
export function previewSteps(rows, count, origin, opt, common) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const st = rows[i].step;
    const l = stepLine(rows, i, origin, opt, common.bladeWidth);
    let path = null;
    if (LINE_STEPS[st] || st === 2) path = [[l.x0, l.y0], [l.x1, l.y1]];
    else if (st === 3 || st === 4) {
      const p = arcPlan([l.x0, l.y0], [l.x1, l.y1], rows[i].r, st === 3);
      if (p) {
        const t0 = Math.atan2(p.S[1] - p.C[1], p.S[0] - p.C[0]);
        let t1 = Math.atan2(p.E[1] - p.C[1], p.E[0] - p.C[0]);
        if (p.cw) { while (t1 > t0) t1 -= 2 * Math.PI; } else { while (t1 < t0) t1 += 2 * Math.PI; }
        path = Array.from({ length: 33 }, (_, k) => { const t = t0 + (t1 - t0) * k / 32; return [p.C[0] + p.R * Math.cos(t), p.C[1] + p.R * Math.sin(t)]; });
      }
    } else if (CIRCLE_STEPS[st]) {
      const c = circlePlan({ x: l.x0, y: l.y0, R: rows[i].r, ...CIRCLE_STEPS[st] }, common.bladeWidth);
      path = Array.from({ length: 65 }, (_, k) => { const t = 2 * Math.PI * k / 64; return [c.C[0] + c.Rc * Math.cos(t), c.C[1] + c.Rc * Math.sin(t)]; });
    } else if (PROFILE_STEPS[st]) {
      const pr = PROFILE_STEPS[st];
      const { cuts } = profileCuts({ P0: [l.x0, l.y0], P1: [l.x1, l.y1], d0: rows[i].depth, d1: rows[i].depthEnd, R: rows[i].r, length: rows[i].length, convex: pr.convex, xProfile: pr.x, jump: opt.profileJump || 1 });
      path = cuts.flatMap((c) => [[c.x0, c.y0], [c.x1, c.y1], null]);
    } else if (SMOOTH_STEPS[st]) {
      path = [[l.x0, l.y0], [l.x1, l.y1]];
    }
    out.push({ i, step: st, path });
  }
  return out;
}

// Program automatu w kreatorze pb: rows - wiersze, count - liczba krokow (iProgramCutNumber / iProgramProfilesNumber),
// origin - punkt startowy, opt {outerInner, profileJump, smoothingJump, smoothingArrays, startIndex},
// common - wspolne parametry ciecia. Kazdy krok zaczyna nowy fragment (pb.mark) - do podswietlenia w widoku.
export function addAutomat(pb, rows, count, origin, opt, common) {
  let thickness = common.thickness;
  const m = pb.m;
  for (let i = opt.startIndex || 0; i < count; i++) {
    const row = rows[i];
    const st = row.step;
    // kroki od punktu i do i+1 - bez nastepnego punktu nie ma czego ciac (ostatni wiersz programu)
    const needsNext = LINE_STEPS[st] || st === 2 || st === 3 || st === 4 || PROFILE_STEPS[st] || SMOOTH_STEPS[st];
    if (needsNext && i + 1 >= rows.length) continue;
    const label = `Krok ${i + 1}: ${stepName(st)}`;
    pb.label = label;
    pb.stepIndex = i;
    const c = { ...common, thickness };
    const l = stepLine(rows, i, origin, opt, m.bladeWidth);
    if (LINE_STEPS[st]) {
      const ls = LINE_STEPS[st];
      const slopes = ls.slope || [Boolean(ls.reverse)];
      for (const rev of slopes) {
        const tilt = Boolean(ls.slope);
        addCutST(pb, cutParams({ ...l, internal: ls.internal, reverse: rev }, { ...c, tilt, b: tilt ? row.angle : 0 }, OUTER_INNER_ENDS(m)));
      }
    } else if (st === 2) {
      // przejazd na punkt i+1 z aktualnym A / B, bez zjazdu Z (bGoToPositionNoLastMove)
      const [x, y] = plcAxisXY(l.x1, l.y1, pb.cur.a, pb.cur.b, m);
      pb.goto({ x, y }, c.above, 'GoToPosition');
    } else if (st === 3 || st === 4) {
      addArc(pb, { S: [l.x0, l.y0], E: [l.x1, l.y1], R: row.r, cw: st === 3 }, cutParams(l, c));
    } else if (CIRCLE_STEPS[st]) {
      addCircle(pb, { x: l.x0, y: l.y0, R: row.r, ...CIRCLE_STEPS[st] }, cutParams(l, c));
    } else if (st === 19) {
      // ChangeDepth: nowa grubosc do tablicy glebokosci kolejnych ciec
      // (PLC bierze aProgramDepth[iActualNumberOfProgramMills] - tu glebokosc z wiersza kroku)
      if (row.depth > 0) thickness = row.depth;
    } else if (st === 27) {
      pb.dwell(1, 'Confirm');
    } else if (PROFILE_STEPS[st]) {
      const pr = PROFILE_STEPS[st];
      addProfile(pb, { P0: [l.x0, l.y0], P1: [l.x1, l.y1], d0: row.depth, d1: row.depthEnd, R: row.r, length: row.length, convex: pr.convex, xProfile: pr.x, jump: opt.profileJump || 1 }, c);
    } else if (SMOOTH_STEPS[st]) {
      // SmoothingShapeFull (bServiceSmoothingArrays): kolejne wiersze wygladzania w jednym przejsciu
      const chain = [];
      let j = i;
      do {
        const r = rows[j];
        const sm = SMOOTH_STEPS[r.step];
        const lj = stepLine(rows, j, origin, opt, m.bladeWidth);
        chain.push({ P0: [lj.x0, lj.y0], P1: [lj.x1, lj.y1], d0: r.depth, d1: r.depthEnd, R: r.r, length: r.length, convex: sm.convex, xProfile: sm.x, jump: opt.smoothingJump || 50 });
        j++;
      } while (opt.smoothingArrays && j < count && SMOOTH_STEPS[rows[j].step]);
      addSmoothing(pb, chain, c);
      i = j - 1;
    }
  }
  pb.label = null;
  pb.stepIndex = null;
}
