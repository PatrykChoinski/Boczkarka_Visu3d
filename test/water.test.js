// Woda i laser na glowicy (#141): dysze po obu stronach tarczy, woda na tarcze / narzedzie, modul lasera na oslonie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, bladeFrame, toolFrame, topZ, sub, dot } from '../src/shared/geometry.js';
import { waterLayout, waterDrops, waterSpray, laserMount, guardRadius, GUARD_OUTLINE } from '../src/shared/water.js';

const M = machine({ discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
const len = (p) => Math.hypot(...p);
const near3 = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('woda pila wg zdjecia w #141: trzy dysze po zewnetrznej stronie oslony - dwie przy piascie, jedna przy dole tarczy', () => {
  for (const pose of [{ x: 800, y: 600, z: 100, a: 0, b: 0 }, { x: 800, y: 600, z: 120, a: 37, b: 45 }]) {
    const f = bladeFrame(pose, M);
    const w = waterLayout(pose, M, -1);                  // FWD (saw.fwdSign -1): strona -u schodzi w material
    const st = (p) => [dot(sub(p, f.center), f.u) / f.radius, -dot(sub(p, f.center), f.d) / f.radius];
    assert.equal(w.hoses.length, 3);
    assert.equal(w.nozzles.length, 3);
    // wszystkie dysze na zewnatrz tarczy (strona przeciwna do silnika), przed sciana oslony
    for (const n of w.nozzles) assert.ok(dot(sub(n, f.center), f.normal) > M.bladeWidth / 2 + 20, 'dysza po zewnetrznej stronie');
    // dwie gorne: tuz obok piasty, na jej wysokosci (zdjecie: s 0.22 / 0.29, t 0.04 / -0.08)
    for (const n of w.nozzles.slice(0, 2)) {
      const [s, t] = st(n);
      assert.ok(s > 0 && s < 0.35 && Math.abs(t) < 0.1, `dysza przy piascie: ${s}, ${t}`);
    }
    // dolna: przy dolnej czesci tarczy, ponizej oslony
    const [sl, tl] = st(w.nozzles[2]);
    assert.ok(Math.abs(sl) < 0.3 && tl < -0.6, `dolna dysza: ${sl}, ${tl}`);
    // rozdzielacz przy dolnym tylnym rogu oslony
    const [sm, tm] = st(w.manifold);
    assert.ok(Math.abs(sm - 0.85) < 1e-9 && Math.abs(tm + 0.55) < 1e-9);
    // woda na poczatek tarczy (film): obwod od strony -u (tam celuja dysze), pod oslona, na scianie tarczy
    for (const t of w.targets) {
      const off = dot(sub(t, f.center), f.normal);
      const [s2, t2] = st(t);
      assert.ok(Math.abs(off - (M.bladeWidth / 2 + 1)) < 1e-6, `cel na scianie tarczy ${off}`);
      assert.ok(s2 < 0 && Math.abs(Math.hypot(s2, t2) - 0.96) < 0.05 && t2 < -0.24, `cel na poczatku tarczy: ${s2}, ${t2}`);
    }
    w.hoses.forEach((h, i) => assert.deepEqual(h[h.length - 1], w.nozzles[i]));
  }
});

test('oslona tarczy wg zdjecia: gora 0.87, pionowa krawedz 0.96 (strona -u), druga 0.81, dol 0.57 / 0.40 promienia', () => {
  near3(guardRadius([0, 1]), 0.87);
  near3(guardRadius([1, 0]), 0.81);
  near3(guardRadius([0, -1]), 0.57);
  assert.ok(Math.abs(GUARD_OUTLINE[0][0] + 0.96) < 1e-9 && Math.abs(GUARD_OUTLINE[0][1] + 0.40) < 1e-9, 'pionowa krawedz - dol');
});

test('woda frez / wiertlo: dysze przy narzedziu, woda na czolo', () => {
  for (const mode of ['mill', 'drill']) {
    const m = machine({ ...M, mode, millTiltDiameter: 100 });
    const pose = { x: 900, y: 700, z: 50, a: 0, b: 90 };
    const f = toolFrame(pose, m);
    const w = waterLayout(pose, m);
    for (const t of w.targets) assert.ok(len(sub(t, f.tip)) <= f.radius + 1e-6, 'woda na czolo narzedzia');
    for (const n of w.nozzles) assert.ok(Math.abs(dot(sub(n, f.tip), f.u)) > f.radius, 'dysza obok narzedzia');
  }
});

test('krople: od dyszy do celu, n kropli, faza przesuwa krople', () => {
  const a = [0, 0, 100];
  const b = [100, 0, 0];
  const d0 = waterDrops(a, b, 10, 0, 0);
  assert.equal(d0.length, 10);
  assert.deepEqual(d0[0], a);
  const d1 = waterDrops(a, b, 10, 0.05, 0);
  assert.ok(d1[0][0] > 0 && d1[0][0] < 10);
});

test('laser: modul na oslonie tarczy od strony lasera (kat od gory), w plaszczyznie tarczy', () => {
  for (const side of [1, -1]) {
    const pose = { x: 500, y: 400, z: 100, a: 30, b: 0 };
    const f = bladeFrame(pose, M);
    const mt = laserMount(pose, M, side, 50);
    const rel = sub(mt.pos, f.center);
    assert.ok(Math.abs(dot(rel, f.normal)) < 1e-6, 'w plaszczyznie tarczy');
    const dir = [Math.sin(side * 50 * Math.PI / 180), Math.cos(50 * Math.PI / 180)];
    assert.ok(Math.abs(len(rel) - (guardRadius(dir) * f.radius + 40)) < 1e-6, 'na krawedzi oslony');
    assert.ok(dot(rel, f.u) * side > 0, 'po stronie lasera');
    assert.ok(mt.pos[2] > f.center[2], 'nad tarcza');
  }
});

test('rozbryzg wody (film): woda na strone tarczy schodzaca w material, przez rzaz, rozbryzg za tarcza w kierunku obrotu', () => {
  const pose = { x: 800, y: 600, z: 250, a: 0, b: 0 };      // tarcza w materiale
  const f = bladeFrame(pose, M);
  for (const spin of [1, -1]) {
    const w = waterLayout(pose, M, spin);
    // trafienie tuz nad powierzchnia materialu, po stronie schodzacej w material (spin +1 - strona +u)
    const hit = w.targets[0];
    assert.ok(hit[2] > topZ(M) && hit[2] < topZ(M) + 40, `trafienie ${hit[2]} vs gora ${topZ(M)}`);
    assert.equal(Math.sign(dot(sub(hit, f.center), f.u)), spin);
    const { drops, mist } = waterSpray(w, 0.37);
    assert.equal(drops.length, 3 * 380 * 3);         // duzo wody: 380 kropli na dysze
    assert.ok(mist.length > 0);
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < drops.length; i += 3) {
      const p = [drops[i], drops[i + 1], drops[i + 2]];
      // pod powierzchnia materialu tylko w rzazie (przy tarczy)
      assert.ok(p[2] >= topZ(M) + 2 - 1e-9 || Math.hypot(...sub(p, f.center)) <= f.radius * 1.01, 'kropla pod materialem poza rzazem');
      const s = dot(sub(p, f.center), f.u);
      if (Math.abs(s) > f.radius * 1.05) { sum += s; cnt++; }
    }
    // rozbryzg poza tarcza - po stronie przeciwnej do trafienia (woda przeszla przez rzaz)
    assert.ok(cnt > 50, `kropli rozbryzgu ${cnt}`);
    assert.equal(Math.sign(sum / cnt), -spin, 'rozbryzg za tarcza w kierunku obrotu');
  }
});
