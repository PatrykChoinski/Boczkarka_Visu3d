// Tryb online: serwer VizuApp z testowym PLC (OPC UA): zmienne boczkarki, zmiana adresu serwera OPC UA ze strony,
// sterowanie (START / STOP) z lista PLC_WRITES.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakePlc } from './fake-plc-server.js';
import { OpcUaSource } from '../src/server/opcua-source.js';
import { loadConfig, createServer } from '../src/server/main.js';
import { VARIABLES, STEP } from '../src/shared/config.js';

const PORT_A = 4861;
const PORT_B = 4862;
let plcA;
let plcB;
let server;
let source;
let base;
let dir;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(cond, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await cond()) return; await sleep(100); }
  throw new Error('timeout');
}
const api = (p, body) => fetch(base + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then((r) => r.json());

before(async () => {
  plcA = await startFakePlc(PORT_A);
  plcB = await startFakePlc(PORT_B, { auto: true });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-edge-'));
  const cfgFile = path.join(dir, 'config.json');
  fs.writeFileSync(cfgFile, JSON.stringify({ endpoint: `opc.tcp://127.0.0.1:${PORT_A}` }));
  const cfg = loadConfig(cfgFile);
  source = new OpcUaSource(cfg);
  server = createServer(cfg, source);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  source.start();
});

after(async () => {
  await source.stop();
  await new Promise((r) => server.close(r));
  await plcA.stop();
  await plcB.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('wszystkie zmienne boczkarki w OPC UA (przegladanie drzewa jak w CODESYS)', async () => {
  await until(() => source.connected);
  const v = await api('/api/variables');
  assert.equal(v.variables.filter((x) => x.found).length, Object.keys(VARIABLES).length);
  await until(() => source.values.cycleKind !== undefined && source.values.alarms !== undefined);
  assert.equal(source.values.activeName, 'Ćwierćwałek górny');
  assert.equal(source.values.alarms.length, 32);
});

test('sterowanie: START z listy PLC_WRITES uruchamia cykl, STOP zatrzymuje; zmienna spoza listy odrzucona', async () => {
  await until(() => source.connected);
  const bad = await fetch(`${base}/api/plc/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ v: 'AxesConfig.ParamsX.MaxVelocity', value: 1 }] }) });
  assert.equal(bad.status, 403);
  assert.deepEqual(await api('/api/plc/write', { items: [{ v: 'EdgeProfile.Start', value: true }] }), { ok: true });
  await until(() => source.values.step !== STEP.WaitForStart);
  await until(() => source.values.step === STEP.SpindleStart || source.values.spindleRunning);
  assert.deepEqual(await api('/api/plc/write', { items: [{ v: 'EdgeProfile.Stop', value: true }] }), { ok: true });
  await until(() => source.values.step === STEP.WaitForCommand);
  await api('/api/plc/write', { items: [{ v: 'Alarms.Reset', value: true }] });
  await until(() => source.values.step === STEP.WaitForStart);
});

test('adres IP serwera OPC UA ze strony: przelaczenie na inny PLC, zapis connection.json, powrot do domyslnego', async () => {
  await until(() => source.connected);
  const bad = await fetch(`${base}/api/connection`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: 'http://zly' }) });
  assert.equal(bad.status, 400);
  const c = await api('/api/connection', { endpoint: `opc.tcp://127.0.0.1:${PORT_B}` });
  assert.equal(c.endpoint, `opc.tcp://127.0.0.1:${PORT_B}`);
  assert.ok(fs.existsSync(path.join(dir, 'connection.json')));
  // PLC B pracuje w petli (--auto): po przelaczeniu wartosci z cyklu
  await until(() => source.connected && source.status.includes(String(PORT_B)) && source.values.step > 0);
  const d = await api('/api/connection', { endpoint: '' });
  assert.equal(d.endpoint, `opc.tcp://127.0.0.1:${PORT_A}`);
  assert.equal(fs.existsSync(path.join(dir, 'connection.json')), false);
  await until(() => source.connected && source.status.includes(String(PORT_A)));
});
