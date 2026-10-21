// #124 G-kod / CNC 3D: parser jak preprocesor PLC, G54 -> pozycje osi, mapa wysokosci, program ruchu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGcode, gcodeSummary, arcCenterR, arcPoints } from '../src/shared/gcode.js';
import { cncAxis, g54FromPose, cncProgram, cncTipPath, CNC_LIMITS } from '../src/shared/cnc.js';
import { HeightMap, shadeHeightMap } from '../src/shared/heightmap.js';
import { machine, toolFrame, plcToolAxisZ, topZ } from '../src/shared/geometry.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const M = machine({
  discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 60,
  millWidth: 25, millTiltDiameter: 100, millLength: 250, drillLength: 250, millCorrection: 0, mode: 'mill',
});
const DYN = { cutVel: 30, cutAcc: 300, cutDec: 300, fastVel: 150, fastAcc: 300, zVel: 20, zAcc: 40, zUpVel: 20, aVel: 30, aAcc: 60, bVel: 10, bAcc: 20 };
// fragment przykladowego pliku (Dodatkowe Programy/madonna_frez_fi25mm_fixed.nc)
const SAMPLE = `S5500 M03
G00 X43.750 Y-327.475
G00 X43.750 Y-327.475 Z-20.995
G00 X43.750 Y-327.475 Z-4.995
G01 X43.750 Y-327.475 Z1.505 F20
G01 X43.750 Y-313.939 F4000
G01 X46.910 Y-317.087
(komentarz) G01 X50.160 Y-320.142 ; koniec
G00 X-25.000 Y-364.688 Z-30.000
G00 G53 Z100
M30
G01 X999 Y999`;

test('parser: G0 / G1, F modalne, komentarze, G53 bez ruchu, koniec na M30, wrzeciono', () => {
  const p = parseGcode(SAMPLE);
  assert.equal(p.moves.length, 8);
  assert.deepEqual(p.moves.map((m) => m.kind), ['rapid', 'rapid', 'rapid', 'feed', 'feed', 'feed', 'feed', 'rapid']);
  assert.deepEqual(p.moves[3].to, [43.75, -327.475, 1.505]);
  assert.equal(p.moves[3].f, 20);
  assert.equal(p.moves[5].f, 4000);                         // F modalne
  assert.deepEqual(p.moves[6].to, [50.16, -320.142, 1.505]); // komentarze ( ) i ; pominiete
  assert.equal(p.end, 11);
  assert.deepEqual(p.spindle, [{ line: 1, on: true }]);
  assert.ok(!p.moves.some((m) => m.to[0] === 999), 'po M30 nic');
});

test('luki: G2 / G3 z I J i z R, punkty na okregu, kierunek', () => {
  const p = parseGcode('G00 X0 Y0 Z0\nG02 X10 Y0 I5 J0 F1000\nG03 X0 Y0 R5');
  assert.equal(p.moves[1].kind, 'arc');
  assert.deepEqual([p.moves[1].arc.cx, p.moves[1].arc.cy], [5, 0]);
  const pts = arcPoints(p.moves[1], 1);
  for (const q of pts) near(Math.hypot(q[0] - 5, q[1]), 5, 1e-9);
  assert.ok(pts[Math.floor(pts.length / 2)][1] > 0, 'G2 z (0,0) do (10,0) wokol (5,0) idzie przez gore');
  assert.ok(p.warnings.some((w) => /R/.test(w)), 'R - ostrzezenie (w PLC nieobslugiwane)');
  const c = arcCenterR([0, 0], [10, 0], 5, false);
  near(c[0], 5); near(c[1], 0);
});

test('G91 przyrostowo i G20 cale', () => {
  const p = parseGcode('G00 X10 Y10 Z0\nG91\nG01 X5 Y-5 F100\nG90 G20\nG01 X1 Y1');
  assert.deepEqual(p.moves[1].to, [15, 5, 0]);
  near(p.moves[2].to[0], 25.4); near(p.moves[2].to[1], 25.4);
});

test('G54 jak CNCInfo / preprocesor: X osi = G54_X + X, Y osi = G54_Y - Y, Z osi = G54_Z + Z; bez promienia +r', () => {
  const g = { x: 1000, y: 800, z: 300 };
  assert.deepEqual(cncAxis(g, [43.75, -327.475, 1.5]), { x: 1043.75, y: 1127.475, z: 301.5 });
  assert.deepEqual(g54FromPose({ x: 10, y: 20, z: 30 }, 25, true), { x: 22.5, y: 32.5, z: 30 });
});

test('mapa wysokosci: frez schodzi na glebokosc toru, szerokosc rowka = srednica', () => {
  const hm = new HeightMap([0, 0, 200, 100], 0, -60, 1);
  hm.carve([20, 50, -10], [180, 50, -10], 12.5);
  near(hm.minZ(), -10);
  const at = (x, y) => hm.at(Math.round(x), Math.round(y));
  near(at(100, 50), -10); near(at(100, 62), -10); assert.equal(at(100, 64), 0); assert.equal(at(5, 50), 0);   // poczatek toru X 20 - r 12.5
  hm.carve([100, 10, -100], [100, 90, -100], 5);
  near(hm.minZ(), -60);                                       // nie glebiej niz spod kamienia
});

test('program ruchu: czolo frezu na torze z pliku przy G54 na powierzchni, predkosci w limitach PLC', () => {
  const pose0 = { x: 0, y: 0, z: 0, a: 0, b: 90 };
  const g54 = { x: 1200, y: 900, z: plcToolAxisZ(0, 90, M) };
  const p = parseGcode(SAMPLE);
  const prog = cncProgram(pose0, p, g54, M, DYN, { zAbove: 20 });
  assert.ok(prog.duration > 0);
  // koniec: ostatni ruch pliku (G00 X-25 Y-364.688 Z-30), czolo 30 mm nad powierzchnia
  const end = prog.at(prog.duration).pose;
  const tip = toolFrame(end, M).tip;
  near(end.x, g54.x - 25, 1e-6); near(end.y, g54.y + 364.688, 1e-6);
  near(tip[2], topZ(M) + 30, 1e-6);
  // najglebiej: Z 1.505 pod powierzchnia
  const paths = cncTipPath(p, g54, pose0, M);
  const minZ = Math.min(...paths.flatMap((q) => q.pts.map((x) => x[2])));
  near(minZ, topZ(M) - 1.505, 1e-6);
  // predkosc posuwu: F4000 mm/min = 66.7 mm/s, zejscie F20 = 0.33 mm/s, nigdzie szybciej niz limity
  let maxZ = 0;
  for (let t = 0.05; t < prog.duration; t += 0.05) {
    const a = prog.at(t - 0.05).pose; const b = prog.at(t).pose;
    maxZ = Math.max(maxZ, Math.abs(b.z - a.z) / 0.05);
  }
  assert.ok(maxZ <= Math.max(CNC_LIMITS.z, DYN.zUpVel) * 1.01, `Z ${maxZ}`);
});

test('przykladowy plik z Dodatkowe Programy: parsuje sie bez bledow, zakres jak w pliku', { skip: !fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'Dodatkowe Programy', 'madonna_frez_fi25mm_fixed.nc')) }, () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'Dodatkowe Programy', 'madonna_frez_fi25mm_fixed.nc');
  const p = parseGcode(fs.readFileSync(file, 'utf8'));
  const s = gcodeSummary(p);
  assert.ok(p.moves.length > 50000);
  assert.equal(p.warnings.length, 0);
  near(s.lo[0], -25, 1e-6); near(s.hi[0], 307.315, 1e-6);
  near(s.lo[1], -412.047, 1e-6); near(s.hi[1], 25, 1e-6);
  near(s.lo[2], -30, 1e-6); near(s.hi[2], 57.377, 1e-6);   // najglebiej 57.4 mm pod G54_Z
});

test('animacja: probki programu (czolo frezu z pozycji osi) wycinaja to samo co tor - glebokosc Z 1.505', () => {
  const pose0 = { x: 0, y: 0, z: 0, a: 0, b: 90 };
  const g54 = { x: 1200, y: 900, z: plcToolAxisZ(0, 90, M) };
  const p = parseGcode(SAMPLE);
  const prog = cncProgram(pose0, p, g54, M, DYN, { zAbove: 20 });
  const top = topZ(M);
  const hm = new HeightMap([g54.x - 100, g54.y - 100, g54.x + 200, g54.y + 500], top, top - 60, 1);
  let last = null;
  for (let t = 0; t <= prog.duration; t += 0.01) {
    const tip = toolFrame(prog.at(t).pose, M).tip;
    if (last) hm.carve(last, tip, 12.5); else hm.stamp(tip[0], tip[1], tip[2], 12.5);
    last = tip;
  }
  near(hm.top - hm.minZ(), 1.505, 1e-3);
  assert.ok(hm.cut > 500, `obrobione komorki ${hm.cut}`);
});

test('testowy PLC --mode cnc: frez po bazowaniu, G54 w HMI.G54_X / Y / Z, czolo schodzi na glebokosc programu (6 mm)', async () => {
  const { plcTimeline, cncG54 } = await import('./fake-plc-server.js');
  const tl = plcTimeline('cnc');
  const v0 = tl(0);
  assert.equal(v0.modeMill, true);
  assert.equal(v0.systemBased, true);
  const m = machine({ ...v0, mode: 'mill' });
  assert.deepEqual([v0.g54X, v0.g54Y, v0.g54Z], Object.values(cncG54(m)));
  let deepest = Infinity;
  for (let t = 0; t < 120; t += 0.1) {
    const v = tl(t);
    assert.equal(v.b, 90);
    deepest = Math.min(deepest, toolFrame(v, m).tip[2]);
  }
  near(topZ(m) - deepest, 6, 1e-6);
});

test('mapa wysokosci: zakres zmienionych komorek (aktualizacja tylko fragmentu siatki w widoku)', () => {
  const hm = new HeightMap([0, 0, 200, 100], 0, -60, 1);
  assert.equal(hm.takeDirty(), null);
  hm.carve([50, 50, -5], [60, 50, -5], 5);
  const d = hm.takeDirty();
  assert.deepEqual(d, [45, 45, 65, 55]);
  assert.equal(hm.takeDirty(), null);
  hm.stamp(10, 10, 5, 3);                                   // nad materialem - bez zmian
  assert.equal(hm.takeDirty(), null);
});

test('przyklad w Visu3D/examples jest tym samym plikiem co w Dodatkowe Programy', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const ex = path.join(dir, '..', 'examples', 'madonna_frez_fi25mm_fixed.nc');
  assert.ok(fs.existsSync(ex));
  const orig = path.join(dir, '..', '..', 'Dodatkowe Programy', 'madonna_frez_fi25mm_fixed.nc');
  if (fs.existsSync(orig)) assert.ok(fs.readFileSync(ex).equals(fs.readFileSync(orig)));
});

test('kody z listy PLC (GCodes): G4 postoj w programie i czasie, G70 / G71 jak cale / mm, G28 / G55 / G81 - uwaga', () => {
  const p = parseGcode('G00 X0 Y0 Z0\nG01 X10 F600\nG04 P1500\nG4 X2\nG70\nG01 X1\nG71\nG28\nG55\nG81 X0 Y0 Z5 R2');
  const dw = p.moves.filter((m) => m.kind === 'dwell');
  assert.deepEqual(dw.map((m) => m.t), [1.5, 2]);
  near(p.moves.find((m) => m.line === 6).to[0], 25.4);
  assert.ok(['G28', 'G55', 'G81'].every((g) => p.warnings.some((w) => w.includes(g))));
  const s = gcodeSummary(p, 6000);
  near(s.time, 10 / 600 * 60 + 3.5 + (25.4 - 10) / 600 * 60 + 0, 0.5);
  const prog = cncProgram({ x: 0, y: 0, z: 0, a: 0, b: 90 }, p, { x: 500, y: 500, z: 100 }, M, DYN, { zAbove: 20 });
  assert.equal(prog.segments.filter((sg) => sg.step === 'G4').length, 2);
  near(prog.segments.filter((sg) => sg.step === 'G4').reduce((a, sg) => a + sg.duration, 0), 3.5);
});

test('podglad 2D: +Y do gory obrazu, sciana od strony swiatla (lewa gora) jasniejsza, dno ciemniejsze', () => {
  const hm = new HeightMap([0, 0, 100, 60], 0, -40, 1);
  // kieszen w gornej czesci (duze Y): x 30..70, y 35..55, glebokosc 20
  for (let y = 35; y <= 55; y += 1) hm.carve([30, y, -20], [70, y, -20], 0.5);
  const img = shadeHeightMap(hm);
  const px = (x, y) => { const o = ((hm.ny - 1 - y) * hm.nx + x) * 4; return img[o]; };
  assert.ok(px(50, 45) < px(50, 10), 'dno kieszeni ciemniejsze niz gora kamienia');
  // gora obrazu (wiersz 0) = najwieksze Y: kieszen jest w gornej polowie obrazu
  const row = (r) => { let m = 255; for (let x = 0; x < hm.nx; x++) m = Math.min(m, img[(r * hm.nx + x) * 4]); return m; };
  assert.ok(row(hm.ny - 1 - 45) < row(hm.ny - 1 - 10));
  // sciana prawa (opada w lewo, czyli wznosi sie w prawo) ciemniejsza od lewej (wznosi sie w lewo, do swiatla)
  assert.ok(px(70, 45) > px(30, 45) || px(71, 45) > px(29, 45));
});
