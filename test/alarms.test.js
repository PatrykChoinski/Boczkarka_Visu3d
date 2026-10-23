// #155 alarmy przepisane z HMI: lista, bity PLC (zmienne opcjonalne), aktywne z wartosci, historia
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALARMS, SIM_ALARMS, AlarmLog, activeFromValues, alarmByVar, alarmIndex } from '../src/shared/alarms.js';
import { VARIABLES, SLOW_KEYS } from '../src/shared/config.js';

test('lista alarmow jak w HMI: 81 alarmow, bity HMI2.bAlarm..., teksty PL / EN', () => {
  assert.equal(ALARMS.length, 81);
  assert.deepEqual(ALARMS.slice(0, 3).map((a) => [a.n, a.v, a.pl]), [[1, 'HMI2.bAlarmAxisXError', 'Błąd osi X'], [2, 'HMI2.bAlarmAxisYError', 'Błąd osi Y'], [3, 'HMI2.bAlarmAxisZError', 'Błąd osi Z']]);
  assert.equal(new Set(ALARMS.map((a) => a.n)).size, 81);
  assert.ok(ALARMS.every((a) => a.pl || a.en));
  // wylaczone w HMI (kolizje 38, 39) i bez bitu (84 polerowanie)
  assert.deepEqual(ALARMS.filter((a) => a.off).map((a) => a.n), [38, 39]);
  assert.deepEqual(ALARMS.filter((a) => !a.v).map((a) => a.n), [38, 39, 84]);
  for (const v of Object.values(SIM_ALARMS)) assert.ok(alarmByVar(v), v);
});

test('alarmy z tablicy HMI2.aAlarms jak w HMI (alarm n = aAlarms[n - 1]), czytanej rzadziej', () => {
  assert.equal(VARIABLES.alarms, 'HMI2.aAlarms');
  assert.ok(SLOW_KEYS.includes('alarms'));
  assert.ok(!Object.values(VARIABLES).some((v) => /^HMI2\.bAlarm/.test(v)));
  assert.equal(alarmIndex(1), 0);
  assert.ok(ALARMS.every((a) => alarmIndex(a.n) >= 0 && alarmIndex(a.n) < 200));
});

test('aktywne alarmy z wartosci PLC i historia: wystapienie, ustapienie, kwitowanie', () => {
  const alarms = new Array(200).fill(false);
  alarms[7] = true;                                   // 8 cisnienie powietrza
  alarms[37] = true;                                  // 38 - wylaczony w HMI, pomijany
  alarms[83] = true;                                  // 84 polerowanie - bez wlasnego bitu, z tablicy dziala
  assert.deepEqual(activeFromValues({ alarms, x: 1 }), [8, 84]);
  assert.deepEqual(activeFromValues({ x: 1 }), []);
  const log = new AlarmLog(3);
  assert.ok(log.update([8, 16], 1000));
  assert.deepEqual(log.active.sort((a, b) => a - b), [8, 16]);
  assert.ok(!log.update([8, 16], 1500));             // bez zmian
  assert.ok(log.update([8], 2000));
  assert.equal(log.entries.find((e) => e.n === 16).off, 2000);
  assert.equal(log.unacked, 2);
  log.ack();
  assert.equal(log.unacked, 0);
  log.update([8, 16, 21, 58], 3000);                  // limit historii
  assert.equal(log.entries.length, 3);
});
