// Panel obslugi online: logowanie i poziomy (Operator - jog / reczny, Serwis - parametry), zakres i typ parametrow,
// TIME w s na stronie / ms w PLC, jog trzymany (/api/plc/hold) na testowym PLC.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakePlc } from './fake-plc-server.js';
import { OpcUaSource } from '../src/server/opcua-source.js';
import { loadConfig, createServer } from '../src/server/main.js';
import { Auth, hashPassword } from '../src/server/auth.js';
import { AlarmDb } from '../src/server/alarmdb.js';
import { SERVICE_ITEMS, PLC_WRITES, checkParam, toPlc, fromPlc } from '../src/shared/config.js';

const PORT = 4863;
let plc;
let server;
let source;
let base;
let dir;
let alarmDb;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(cond, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return; await sleep(100); }
  throw new Error('timeout');
}
const call = async (p, body, token) => {
  const r = await fetch(base + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
};
// hasla testowe tylko w pamieci testu
const PASS = { Operator: 'op-test-1', Serwis: 'serwis-test-2' };

before(async () => {
  plc = await startFakePlc(PORT);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-access-'));
  const cfgFile = path.join(dir, 'config.json');
  fs.writeFileSync(cfgFile, JSON.stringify({ endpoint: `opc.tcp://127.0.0.1:${PORT}` }));
  const cfg = loadConfig(cfgFile);
  source = new OpcUaSource(cfg);
  const auth = new Auth({ Operator: { level: 1, ...hashPassword(PASS.Operator) }, Serwis: { level: 2, ...hashPassword(PASS.Serwis) } });
  alarmDb = new AlarmDb(path.join(dir, 'alarms.db'));
  server = createServer(cfg, source, auth, undefined, alarmDb);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  source.start();
});

after(async () => {
  await source.stop();
  await new Promise((r) => server.close(r));
  await plc.stop();
  alarmDb.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('zakres i typ parametrow, TIME s <-> ms', () => {
  const w = PLC_WRITES['AxesConfig.ParamsX.MaxVelocity'];
  assert.equal(checkParam(w, 500), null);
  assert.match(checkParam(w, 5000), /powyżej/);
  assert.match(checkParam(w, 'abc'), /liczby/);
  assert.match(checkParam(PLC_WRITES['EdgeProfileConfig.AutoReturn'], 1), /TAK/);
  assert.match(checkParam(PLC_WRITES['SpindleConfig.Poles'], 2.5), /całkowitej/);
  const t = PLC_WRITES['EdgeProfileConfig.ClampDelay'];
  assert.equal(toPlc(t, 1.5), 1500);
  assert.equal(fromPlc(t, 2500), 2.5);
  assert.ok(SERVICE_ITEMS.every((it) => PLC_WRITES[it.v].level === 2));
});

test('logowanie: bez sesji sterowanie odrzucone, Operator steruje i jedzie jogiem, parametry tylko Serwis', async () => {
  await until(() => source.connected);
  assert.equal((await call('/api/plc/write', { items: [{ v: 'EdgeProfile.Start', value: true }] })).status, 403);
  assert.equal((await call('/api/login', { user: 'Operator', password: 'zle' })).status, 401);
  const op = (await call('/api/login', { user: 'Operator', password: PASS.Operator })).body;
  assert.equal(op.level, 1);
  assert.equal((await call('/api/plc', null, op.token)).body.level, 1);
  // jog X+ trzymany: pozycja rosnie, puszczony - stoi
  const x0 = plc.model.sim.x.pos;
  assert.equal((await call('/api/plc/hold', { v: 'Manual.JogXPositive', on: true }, op.token)).status, 200);
  for (let i = 0; i < 6; i++) { await sleep(200); await call('/api/plc/hold', { v: 'Manual.JogXPositive', on: true }, op.token); }
  assert.ok(plc.model.sim.x.pos > x0 + 5, `X ${plc.model.sim.x.pos}`);
  await call('/api/plc/hold', { v: 'Manual.JogXPositive', on: false }, op.token);
  await until(() => Math.abs(plc.model.sim.x.vel) < 1e-9, 3000);
  // dojazd B, cel poza zakresem odrzucony
  assert.equal((await call('/api/plc/write', { items: [{ v: 'Manual.GotoBTarget', value: 500 }, { v: 'Manual.GotoB', value: true }] }, op.token)).status, 400);
  assert.equal((await call('/api/plc/write', { items: [{ v: 'Manual.GotoBTarget', value: 20 }, { v: 'Manual.GotoB', value: true }] }, op.token)).status, 200);
  await until(() => Math.abs(plc.model.sim.b.pos - 20) < 1e-6, 5000);
  // parametr: Operator - 403
  const r = await call('/api/plc/write', { items: [{ v: 'EdgeProfileConfig.ClampDelay', value: 2 }] }, op.token);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /Serwis/);
});

test('Serwis: odczyt parametrow (watch), zapis w zakresie zmienia PLC (TIME w ms), poza zakresem odrzucony', async () => {
  await until(() => source.connected);
  const sv = (await call('/api/login', { user: 'Serwis', password: PASS.Serwis })).body;
  assert.equal(sv.level, 2);
  const paths = SERVICE_ITEMS.map((it) => it.v);
  assert.equal((await call('/api/plc/watch', { cid: 'test-serwis', paths }, sv.token)).body.watched, paths.length);
  await until(() => paths.every((v) => source.hmiValues[v] !== undefined));
  assert.equal(source.hmiValues['EdgeProfileConfig.ClampDelay'], 1000);
  assert.equal(source.hmiValues['AxesConfig.ParamsX.SoftLimitPositive'], 2300);
  assert.equal((await call('/api/plc/write', { items: [{ v: 'EdgeProfileConfig.ClampDelay', value: 2.5 }] }, sv.token)).status, 200);
  await until(() => source.hmiValues['EdgeProfileConfig.ClampDelay'] === 2500);
  assert.equal(plc.model.sim.o.clampDelay, 2.5, 'symulator testowego PLC z nowym parametrem');
  assert.equal((await call('/api/plc/write', { items: [{ v: 'AxesConfig.ParamsX.MaxVelocity', value: 99999 }] }, sv.token)).status, 400);
  assert.equal((await call('/api/plc/write', { items: [{ v: 'EdgeProfileConfig.AutoReturn', value: false }] }, sv.token)).status, 200);
  await until(() => source.hmiValues['EdgeProfileConfig.AutoReturn'] === false);
  await call('/api/logout', {}, sv.token);
  assert.equal((await call('/api/plc', null, sv.token)).body.level, 0);
});

test('historia alarmow: alarm z PLC zapisany w bazie (wystapil / ustapil), kwitowanie od Operatora', async () => {
  await until(() => source.connected);
  plc.model.alarms[4] = true;					// alarm 5: blad serwa B
  await until(async () => (await call('/api/alarms?active=1')).body.entries.some((e) => e.n === 5));
  plc.model.alarms[4] = false;
  await until(async () => (await call('/api/alarms')).body.entries.some((e) => e.n === 5 && e.off));
  assert.equal((await call('/api/alarms/ack', {})).status, 403);
  const op = (await call('/api/login', { user: 'Operator', password: PASS.Operator })).body;
  assert.equal((await call('/api/alarms/ack', {}, op.token)).status, 200);
  const h = (await call('/api/alarms')).body;
  assert.equal(h.unacked, 0);
  assert.match(h.entries[0].name, /serwa B/i);
});
