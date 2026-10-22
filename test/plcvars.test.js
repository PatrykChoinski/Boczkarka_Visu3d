import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machine, plcAxisXY, plcAxisZ, plcToolAxisXY, plcToolAxisZ, plcActualPosition, axisFromActual } from '../src/shared/geometry.js';
import { VARIABLES, plcDynamics } from '../src/shared/config.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const BASE = { discDiameter: 625, bladeWidth: 4, cutTiltDiameter: 200, headRotationDiameter: 100, materialHeight: 450, materialThickness: 40,
  millWidth: 40, millTiltDiameter: 450, millLength: 250, drillLength: 180, millCorrection: 3, polishDiameter: 120, polishHeight: -60 };

test('pozycje z PLC: osie z fX/Y/ZRealPosition, punkt narzedzia (fX/Y/ZActualPosition) osobno', () => {
  assert.equal(VARIABLES.x, 'HMI2.fXRealPosition');
  assert.equal(VARIABLES.y, 'HMI2.fYRealPosition');
  assert.equal(VARIABLES.z, 'HMI2.fZRealPosition');
  assert.equal(VARIABLES.toolX, 'HMI2.fXActualPosition');
  // fBActualVelocity w PLC liczona z osi A - nie podpieta
  assert.ok(!Object.values(VARIABLES).includes('HMI2.fBActualVelocity'));
});

test('ActualPosition: punkt narzedzia z osi odwraca GetPositions / GetNextDepth (pila i narzedzia)', () => {
  const saw = machine({ ...BASE, mode: 'saw' });
  for (const [a, b] of [[0, 0], [37, 0], [-120, 30], [90, 45], [180, 60]]) {
    const [x, y] = plcAxisXY(800, 600, a, b, saw);
    const ap = plcActualPosition({ x, y, z: plcAxisZ(12, b, saw), a, b }, saw);
    near(ap.x, 800); near(ap.y, 600);
    near(ap.z, saw.materialHeight + 12);           // spod tarczy (Z w dol) na glebokosci 12
    const back = axisFromActual(ap, saw);
    near(back.x, x); near(back.y, y);
  }
  for (const mode of ['mill', 'drill', 'polishing']) {
    const m = machine({ ...BASE, mode });
    for (const a of [0, 30, -90]) {
      const [x, y] = plcToolAxisXY(1000, 700, a, 90, m);
      const ap = plcActualPosition({ x, y, z: plcToolAxisZ(5, 90, m), a, b: 90 }, m);
      near(ap.x, 1000); near(ap.y, 700);
    }
  }
  // frez: Z punktu = czolo frezu (material + glebokosc) jak MillST
  const mill = machine({ ...BASE, mode: 'mill' });
  near(plcActualPosition({ x: 0, y: 0, z: plcToolAxisZ(8, 90, mill), a: 0, b: 90 }, mill).z, mill.materialHeight + 8);
});

test('dynamika z PLC: predkosci wprost, przyspieszenia wzorami VelocityAcceleration', () => {
  const d = plcDynamics({ cutVel: 33.33, fastVel: 216.67, maxJogX: 500, autoTaccX: 0.5, maxJogZ: 200, autoTaccZ: 0.4,
    maxJogA: 600, taccA: 2, maxJogB: 600, taccB: 3, cutAcc: 'x' });
  near(d.cutVel, 33.33); near(d.fastVel, 216.67);
  near(d.fastAcc, 1000);           // AccX = fMaxVelocityJogX / fAutoTaccX
  near(d.zAcc, 500);
  near(d.aAcc, 120);               // AccA = fMaxVelocityJogA / MAX(TaccA, 5)
  near(d.bAcc, 200);
  assert.ok(!('cutAcc' in d));
  assert.ok(!('bAcc' in plcDynamics({ maxJogB: 600, taccB: 0 })));
});
