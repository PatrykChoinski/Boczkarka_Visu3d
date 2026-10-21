import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Auth, hashPassword, checkPassword, loadUsers, saveUsers } from '../src/server/auth.js';
import { createServer, clientConfig, loadConfig } from '../src/server/main.js';

// hasla testowe (nie hasla maszyny)
const USERS = { Operator: { level: 1, ...hashPassword('op-test') }, Serwis: { level: 2, ...hashPassword('serwis-test') } };

test('logowanie (#145): skrot scrypt, sprawdzanie hasla, sesja i wylogowanie po bezczynnosci', () => {
  const e = hashPassword('abc');
  assert.ok(checkPassword(e, 'abc'));
  assert.ok(!checkPassword(e, 'abd'));
  assert.notEqual(hashPassword('abc').salt, e.salt);
  const auth = new Auth(USERS, { timeoutMin: 1 });
  assert.equal(auth.login('Operator', 'zle'), null);
  assert.equal(auth.login('Nikt', 'op-test'), null);
  const s = auth.login('Serwis', 'serwis-test');
  assert.equal(s.level, 2);
  assert.deepEqual(auth.session(s.token), { user: 'Serwis', level: 2 });
  assert.equal(auth.session(s.token, Date.now() + 61000), null);
  const s2 = auth.login('Operator', 'op-test');
  auth.logout(s2.token);
  assert.equal(auth.session(s2.token), null);
  assert.deepEqual(auth.names(), ['Operator', 'Serwis']);
});

test('users.json: zapis i odczyt bez hasel jawnych, config strony bez skrotow', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-auth-'));
  const file = path.join(dir, 'users.json');
  saveUsers(file, USERS);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!text.includes('op-test'));
  assert.deepEqual(Object.keys(loadUsers(file)), ['Operator', 'Serwis']);
  const cfg = loadConfig(path.join(dir, 'brak.json'));
  assert.equal(cfg.usersFile, file);
  const pub = JSON.stringify(clientConfig(cfg, null, new Auth(USERS)));
  assert.ok(!pub.includes(USERS.Operator.hash) && !pub.includes(USERS.Operator.salt));
  assert.deepEqual(clientConfig(cfg, null, new Auth(USERS)).auth.users, ['Operator', 'Serwis']);
  assert.equal(clientConfig(cfg, null, null).auth.enabled, false);
});

test('serwer: /api/login, /api/session, /api/logout', async () => {
  const server = createServer(loadConfig(path.join(os.tmpdir(), 'brak.json')), null, new Auth(USERS));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const bad = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: 'Operator', password: 'x' }) });
    assert.equal(bad.status, 401);
    const ok = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ user: 'Operator', password: 'op-test' }) });
    const s = await ok.json();
    assert.equal(s.level, 1);
    const headers = { authorization: `Bearer ${s.token}` };
    assert.deepEqual(await (await fetch(`${base}/api/session`, { headers })).json(), { user: 'Operator', level: 1 });
    await fetch(`${base}/api/logout`, { method: 'POST', headers });
    assert.equal((await fetch(`${base}/api/session`, { headers })).status, 401);
  } finally {
    server.close();
  }
});
