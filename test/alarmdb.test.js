// Historia alarmow PLC w SQLite (alarmdb.js): wystapienie, ustapienie, kwitowanie, trwalosc po ponownym otwarciu bazy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AlarmDb } from '../src/server/alarmdb.js';
import { alarmByNumber } from '../src/shared/alarms.js';

test('historia alarmow w SQLite: nowe wpisy, ustapienie, kwitowanie, zachowana po ponownym otwarciu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-alarms-'));
  const file = path.join(dir, 'alarms.db');
  let db = new AlarmDb(file);
  assert.equal(db.update([1, 24], 1000, 'opc.tcp://plc:4840'), true);
  assert.equal(db.update([1, 24], 2000), false, 'te same aktywne - bez zmian');
  assert.equal(db.update([24], 3000), true, 'alarm 1 ustapil');
  let l = db.list();
  assert.equal(l.total, 2);
  assert.equal(l.unacked, 2);
  const one = l.entries.find((e) => e.n === 1);
  assert.deepEqual([one.on, one.off, one.name], [1000, 3000, alarmByNumber(1)?.pl || alarmByNumber(1)?.en || 'Alarm 1']);
  assert.equal(l.entries.find((e) => e.n === 24).off, null);
  assert.deepEqual(db.list({ active: true }).entries.map((e) => e.n), [24]);
  assert.equal(db.ack(), 2);
  assert.equal(db.list().unacked, 0);
  // alarm 1 znow - nowy wpis (historia, nie nadpisanie)
  db.update([1, 24], 4000);
  assert.equal(db.list().total, 3);
  db.close();
  // po restarcie serwera: historia i aktywne wpisy w bazie
  db = new AlarmDb(file);
  l = db.list();
  assert.equal(l.total, 3);
  assert.deepEqual(l.entries.map((e) => e.n), [1, 24, 1], 'najnowsze najpierw');
  assert.equal(db.update([], 5000), true, 'po restarcie ustapienie aktywnych z bazy');
  assert.equal(db.list({ active: true }).entries.length, 0);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
