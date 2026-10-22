import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Auth, hashPassword } from '../src/server/auth.js';
import { createServer, loadConfig, pageUrls, CONNECTION_FILE } from '../src/server/main.js';
import { validEndpoint } from '../src/shared/config.js';

// hasla testowe (nie hasla maszyny)
const USERS = { Operator: { level: 1, ...hashPassword('op-test') }, Serwis: { level: 2, ...hashPassword('serwis-test') } };

// zrodlo OPC UA bez sterownika - zapamietuje adres z reconnect()
const fakeSource = (cfg) => ({
  status: 'Łączenie...', connected: false, values: {}, endpoints: [], on() {},
  reconnect(endpoint) { cfg.endpoint = endpoint; this.endpoints.push(endpoint); },
});

test('#148 adres PLC: opc.tcp://host[:port], adresy strony w sieci', () => {
  for (const ok of ['opc.tcp://localhost:4840', 'opc.tcp://192.168.1.10:4840', 'opc.tcp://plc-promasz', 'opc.tcp://10.0.0.5:4840/CODESYS']) assert.ok(validEndpoint(ok), ok);
  for (const bad of ['', 'http://192.168.1.10', 'opc.tcp://', 'opc.tcp://a b:4840', 'opc.tcp://x:4840?y=1', null, 42]) assert.ok(!validEndpoint(bad), String(bad));
  assert.deepEqual(pageUrls('127.0.0.1', 8128), ['http://localhost:8128/']);
  const lan = pageUrls('0.0.0.0', 8128);
  assert.equal(lan[0], 'http://localhost:8128/');
  assert.ok(lan.slice(1).every((u) => /^http:\/\/\d+\.\d+\.\d+\.\d+:8128\/$/.test(u)));
});

test('#148 /api/connection: zmiana adresu (Serwis), zapis w connection.json, adres domyslny', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-conn-'));
  const cfg = loadConfig(path.join(dir, 'brak.json'));
  assert.equal(cfg.endpoint, 'opc.tcp://localhost:4840');
  assert.equal(cfg.connectionFile, path.join(dir, CONNECTION_FILE));
  const source = fakeSource(cfg);
  const server = createServer(cfg, source, new Auth(USERS));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, token) => fetch(`${base}/api/connection`, {
    method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  });
  const login = async (user, password) => (await (await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user, password }) })).json()).token;
  try {
    const info = await (await fetch(`${base}/api/connection`)).json();
    assert.equal(info.endpoint, 'opc.tcp://localhost:4840');
    assert.equal(info.defaultEndpoint, 'opc.tcp://localhost:4840');
    assert.equal(info.plc, true);
    // bez logowania i Operator - nie wolno
    assert.equal((await post({ endpoint: 'opc.tcp://192.168.1.10:4840' })).status, 403);
    assert.equal((await post({ endpoint: 'opc.tcp://192.168.1.10:4840' }, await login('Operator', 'op-test'))).status, 403);
    const serwis = await login('Serwis', 'serwis-test');
    assert.equal((await post({ endpoint: 'http://192.168.1.10' }, serwis)).status, 400);
    const r = await post({ endpoint: 'opc.tcp://192.168.1.10:4840' }, serwis);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).endpoint, 'opc.tcp://192.168.1.10:4840');
    assert.deepEqual(source.endpoints, ['opc.tcp://192.168.1.10:4840']);
    assert.deepEqual(JSON.parse(fs.readFileSync(cfg.connectionFile, 'utf8')), { endpoint: 'opc.tcp://192.168.1.10:4840' });
    // po ponownym uruchomieniu serwera - adres z connection.json
    assert.equal(loadConfig(path.join(dir, 'brak.json')).endpoint, 'opc.tcp://192.168.1.10:4840');
    // pusty adres - domyslny, connection.json usuniety
    assert.equal((await (await post({ endpoint: '' }, serwis)).json()).endpoint, 'opc.tcp://localhost:4840');
    assert.ok(!fs.existsSync(cfg.connectionFile));
  } finally {
    server.close();
  }
});

test('#148 /api/connection bez logowania (brak users.json): zmiana tylko z tego komputera; bez PLC - 409', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-conn-'));
  const cfg = loadConfig(path.join(dir, 'brak.json'));
  const source = fakeSource(cfg);
  const server = createServer(cfg, source, new Auth({}));
  const noPlc = createServer(loadConfig(path.join(dir, 'brak.json')), null, new Auth({}));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await new Promise((r) => noPlc.listen(0, '127.0.0.1', r));
  try {
    const body = JSON.stringify({ endpoint: 'opc.tcp://10.0.0.5:4840' });
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/connection`, { method: 'POST', body });
    assert.equal(r.status, 200);
    assert.deepEqual(source.endpoints, ['opc.tcp://10.0.0.5:4840']);
    const n = await fetch(`http://127.0.0.1:${noPlc.address().port}/api/connection`, { method: 'POST', body });
    assert.equal(n.status, 409);
  } finally {
    server.close();
    noPlc.close();
  }
});
