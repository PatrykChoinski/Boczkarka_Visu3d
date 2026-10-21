// Ruchy reczne offline: rampa, predkosc, droga hamowania, kierunki wzgledem lasera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JogMotion, laserDirection, interpolationDir } from '../src/shared/jog.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const pose0 = { x: 0, y: 0, z: 0, a: 0, b: 0 };

test('jog: rozpedzanie do predkosci, po puszczeniu hamowanie z droga v^2/2d', () => {
  const jog = new JogMotion({ x: 1 }, 100, 200, 400);   // 100 mm/s, rampa 0.5 s, hamowanie 0.25 s
  let p = pose0;
  for (let i = 0; i < 200; i++) p = jog.step(p, 0.005);  // 1 s
  near(jog.v, 100);
  near(p.x, 0.5 * 200 * 0.5 ** 2 + 100 * 0.5, 1e-6);    // 25 mm rampy + 50 mm stalej predkosci
  const before = p.x;
  jog.release();
  while (!jog.done) p = jog.step(p, 0.001);
  near(p.x - before, 100 * 100 / (2 * 400), 1e-3);       // 12.5 mm
  near(p.y, 0); near(p.a, 0);
});

test('jog: krancowka zatrzymuje ruch', () => {
  const jog = new JogMotion({ z: -1 }, 50, 100);
  let p = { ...pose0, z: 10 };
  for (let i = 0; i < 100; i++) p = jog.step(p, 0.01, { z: [0, 600] });
  near(p.z, 0);
  assert.ok(jog.done);
});

test('kierunki interpolacji wzgledem lasera (domyslnie w prawo, +kierunek ciecia)', () => {
  const [lx, ly] = laserDirection(90);
  near(lx, 0); near(ly, 1);
  const d = interpolationDir('perp', 0);
  near(d.x, 0); near(d.y, 1);
  const b = interpolationDir('back', 0, -1);
  near(b.x, 1); near(b.y, 0);
  const jog = new JogMotion(interpolationDir('along', 45), 100, 1000);
  const p = jog.step(pose0, 0.1);
  near(p.x, p.y);
  near(Math.hypot(p.x, p.y), jog.distance);
});

test('laser: start na linii ciecia (najnizszy punkt tarczy przy B = 0), dalej wzdluz kierunku ciecia', async () => {
  const { machine, bladeFrame, plcAxisXY, plcAxisZ } = await import('../src/shared/geometry.js');
  const { laserLine } = await import('../src/shared/jog.js');
  const m = machine({ discDiameter: 625, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40 });
  const [x, y] = plcAxisXY(1000, 800, 30, 0, m);
  const pose = { x, y, z: plcAxisZ(-20, 0, m), a: 30, b: 0 };
  const pts = laserLine(pose, m, 1, 1000, () => -450);
  near(pts[0][0], bladeFrame(pose, m).lowest[0], 1e-6);
  near(pts[0][0], 1000, 1e-6); near(pts[0][1], 800, 1e-6); near(pts[0][2], -450);
  const last = pts[pts.length - 1];
  near(last[0], 1000 + 1000 * Math.cos(30 * Math.PI / 180), 1e-6);
  near(last[1], 800 + 1000 * Math.sin(30 * Math.PI / 180), 1e-6);
  const left = laserLine(pose, m, -1, 1000, () => -450);
  assert.ok(left[left.length - 1][0] < 1000);
});

test('predkosci ruchow recznych (#140): kazda os z wlasnej fJogVelocity, przepisanie przy pile, jazda "o" kat', async () => {
  const { jogVelocity, relativeMoveDynamics } = await import('../src/shared/jog.js');
  const { gotoProgram } = await import('../src/shared/motion.js');
  const d = { jogXVel: 100, jogYVel: 80, jogZVel: 20, jogAVel: 15, jogBVel: 5, fastAcc: 300, zAcc: 40, aAcc: 60, bAcc: 20, cutVel: 30, zVel: 10,
    fastVel: 150, aVel: 30, bVel: 10 };
  assert.deepEqual(['x', 'y', 'z', 'a', 'b'].map((ax) => jogVelocity(ax, d).vel), [100, 80, 20, 15, 5]);
  assert.deepEqual(['x', 'y', 'z', 'a', 'b'].map((ax) => jogVelocity(ax, d).acc), [300, 300, 40, 60, 20]);
  // bServiceManualRewriteJogSpeed przy pile: X / Y - fVelocitySawMode, Z - fVelocityAxisZWork, A / B bez zmian
  assert.deepEqual(['x', 'y', 'z', 'a', 'b'].map((ax) => jogVelocity(ax, d, true).vel), [30, 30, 10, 15, 5]);
  // jazda o 90 stopni A: z predkoscia jog A (15 deg/s) wolniej niz na A z VelA (30 deg/s)
  const from = { x: 0, y: 0, z: 0, a: 0, b: 0 };
  const rel = gotoProgram(from, { ...from, a: 90 }, relativeMoveDynamics(d));
  const abs = gotoProgram(from, { ...from, a: 90 }, d);
  assert.ok(rel.duration > abs.duration + 2, `${rel.duration} vs ${abs.duration}`);
  let maxV = 0;
  for (let t = 0.01; t < rel.duration; t += 0.01) maxV = Math.max(maxV, (rel.at(t).pose.a - rel.at(t - 0.01).pose.a) / 0.01);
  assert.ok(Math.abs(maxV - 15) < 0.5, `max ${maxV}`);
});
