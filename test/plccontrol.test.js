// Sterowanie maszyna z Visu3D w trybie PLC: zapis przez serwer VizuApp do testowego PLC (OPC UA) -
// tylko zmienne zapisywane przez HMI (hmiwrites.json), poziomy dostepu, STOP bez logowania, przycisk chwilowy puszczany przez serwer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startFakePlc } from './fake-plc-server.js';
import { OpcUaSource } from '../src/server/opcua-source.js';
import { loadConfig, createServer } from '../src/server/main.js';
import { Auth, hashPassword } from '../src/server/auth.js';
import { hmiAccess, HOLD_MS } from '../src/server/plcwrite.js';
import { AlarmDb } from '../src/server/alarmdb.js';
import os from 'node:os';
import path from 'node:path';

const PORT = 48471;
const HTTP = 48472;
const HMI = JSON.parse(fs.readFileSync(new URL('../src/server/hmiwrites.json', import.meta.url), 'utf8'));
let plc;
let source;
let server;
const base = `http://127.0.0.1:${HTTP}`;

const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return false;
};

before(async () => {
  plc = await startFakePlc(PORT);
  const cfg = { ...loadConfig('nie-ma-takiego-pliku.json'), endpoint: `opc.tcp://localhost:${PORT}` };
  source = new OpcUaSource(cfg).start();
  const users = { Operator: { level: 1, ...hashPassword('op') }, Serwis: { level: 2, ...hashPassword('sv') } };
  alarmDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-alarms-'));
  alarmDb = new AlarmDb(path.join(alarmDir, 'alarms.db'));
  server = createServer(cfg, source, new Auth(users), HMI, alarmDb);
  await new Promise((r) => server.listen(HTTP, '127.0.0.1', r));
  assert.ok(await until(() => source.connected && source.session), `PLC: ${source.status}`);
  // wymiana danych tylko przez subskrypcje: kazdy Read po polaczeniu liczony (na koncu musi byc 0)
  const read = source.session.read.bind(source.session);
  source.session.read = (...a) => { reads.push(JSON.stringify(a[0]).slice(0, 120)); return read(...a); };
});
const reads = [];
let alarmDb;
let alarmDir;

after(async () => {
  alarmDb?.close();
  fs.rmSync(alarmDir, { recursive: true, force: true });
  server.close();
  await source.stop();
  await plc.stop();
});

const post = (url, body, token) => fetch(base + url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
const login = async (user, password) => (await (await post('/api/login', { user, password })).json()).token;

test('dostep z listy HMI: zmienne zapisu z poziomem, STOP / PAUZA bez logowania, ekrany serwisowe - Serwis', () => {
  const { write, read } = hmiAccess(HMI);
  assert.equal(write['HMI2.bBaseSaw'].level, 1);
  assert.equal(write['HMI.bStopMachine'].level, 0);
  assert.equal(write['HMI2.bPauseMachine'].level, 0);
  assert.ok(write['HMI2.bManualXJogRight'].kinds.has('mom'), 'jog X+ - przycisk chwilowy');
  assert.equal(write['HMI.fParameterHeadRotationDiameter'].level, 2, 'parametr maszyny - ekran serwisowy');
  assert.equal(write['HMI.bServicePauseNotStopping'].level, 2, 'bity serwisowe to nie STOP');
  assert.ok(read.has('HMI2.fXActualPosition'));
  assert.equal(write['HMI2.fXActualPosition'], undefined, 'pozycji osi HMI nie zapisuje');
});

test('niezalogowany: STOP tak, bazowanie nie; Operator: bazowanie i pole ciecia; Serwis: parametr maszyny', async () => {
  let r = await post('/api/plc/write', { items: [{ v: 'HMI2.bBaseSaw', value: true }] });
  assert.equal(r.status, 403);
  assert.equal(plc.panel['HMI2.bBaseSaw'], false);
  r = await post('/api/plc/write', { items: [{ v: 'HMI.bStopMachine', value: true }] });
  assert.equal(r.status, 200, await r.text());
  assert.equal(plc.overrides.stopMachine, true, 'HMI.bStopMachine w PLC');

  const op = await login('Operator', 'op');
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.bBaseSaw', value: true }, { v: 'HMI.fManualXZeroPosition', value: 1234.5 }] }, op);
  assert.equal(r.status, 200, await r.text());
  assert.equal(plc.panel['HMI2.bBaseSaw'], true);
  assert.equal(plc.panel['HMI.fManualXZeroPosition'], 1234.5);
  // INT zaokraglony, BOOL z liczby
  r = await post('/api/plc/write', { items: [{ v: 'HMI.iManualInternal', value: 1.4 }] }, op);
  assert.equal(r.status, 200, await r.text());
  assert.equal(plc.panel['HMI.iManualInternal'], 1);

  r = await post('/api/plc/write', { items: [{ v: 'HMI.fParameterHeadRotationDiameter', value: 200 }] }, op);
  assert.equal(r.status, 403, 'Operator nie zmienia parametrow maszyny');
  const sv = await login('Serwis', 'sv');
  r = await post('/api/plc/write', { items: [{ v: 'HMI.fParameterHeadRotationDiameter', value: 200 }] }, sv);
  assert.equal(r.status, 200, await r.text());
  assert.equal(plc.overrides.headRotationDiameter, 200);

  // zmienna spoza ekranow HMI (pozycja osi) - nigdy
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.fXRealPosition', value: 0 }] }, sv);
  assert.equal(r.status, 403);
  // poza zakresem typu INT - blad, nic nie zapisane
  r = await post('/api/plc/write', { items: [{ v: 'HMI.fManualXZeroPosition', value: 1 }, { v: 'HMI.iManualInternal', value: 99999 }] }, op);
  assert.equal(r.status, 502);
  assert.equal(plc.panel['HMI.fManualXZeroPosition'], 1234.5);
});

test('przycisk chwilowy (jog X+): wcisniety - TRUE, bez potwierdzenia serwer puszcza sam (FALSE)', async () => {
  const op = await login('Operator', 'op');
  let r = await post('/api/plc/hold', { v: 'HMI2.bManualXJogRight', on: true });
  assert.equal(r.status, 403, 'jog tylko po zalogowaniu');
  r = await post('/api/plc/hold', { v: 'HMI.fManualXZeroPosition', on: true }, op);
  assert.equal(r.status, 400, 'pole liczbowe to nie przycisk chwilowy');
  r = await post('/api/plc/hold', { v: 'HMI2.bManualXJogRight', on: true }, op);
  assert.equal(r.status, 200, await r.text());
  assert.equal(plc.panel['HMI2.bManualXJogRight'], true);
  // puszczony z panelu
  await post('/api/plc/hold', { v: 'HMI2.bManualXJogRight', on: false }, op);
  assert.equal(plc.panel['HMI2.bManualXJogRight'], false);
  // wcisniety, panel przestaje potwierdzac (zerwane polaczenie) - FALSE po HOLD_MS
  await post('/api/plc/hold', { v: 'HMI2.bManualYJogUp', on: true }, op);
  assert.equal(plc.panel['HMI2.bManualYJogUp'], true);
  const t0 = Date.now();
  assert.ok(await until(() => plc.panel['HMI2.bManualYJogUp'] === false, 3000), 'serwer nie puscil przycisku');
  assert.ok(Date.now() - t0 >= HOLD_MS - 150);
});

test('odczyt zmiennych formularza (watch) - wartosci w strumieniu SSE {hmi}', async () => {
  plc.panel['HMI.fManualXEndPosition'] = 777;
  let r = await post('/api/plc/watch', { paths: ['HMI.fManualXEndPosition'] });
  assert.equal(r.status, 400, 'bez identyfikatora strony (cid)');
  r = await post('/api/plc/watch', { cid: 'test1', paths: ['HMI.fManualXEndPosition', 'HMI2.bManualXJogRight', 'NieMa.zmiennej'] });
  assert.deepEqual(await r.json(), { watched: 2 }, 'tylko zmienne z listy HMI');
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/events?cid=test1`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  let buf = '';
  let hmi = null;
  const t0 = Date.now();
  while (!hmi && Date.now() - t0 < 10000) {
    buf += new TextDecoder().decode((await reader.read()).value);
    for (const m of buf.matchAll(/data: (.*)\n\n/g)) { const msg = JSON.parse(m[1]); if (msg.hmi && 'HMI.fManualXEndPosition' in msg.hmi) hmi = msg.hmi; }
  }
  ctrl.abort();
  assert.ok(hmi, 'brak {hmi} w SSE');
  assert.equal(hmi['HMI.fManualXEndPosition'], 777);
  assert.equal(hmi['HMI2.bManualXJogRight'], false);
});

test('historia alarmow z PLC zapisywana w SQLite (subskrypcja w tle), /api/alarms, kwitowanie po zalogowaniu', async () => {
  const arr = Array(200).fill(false);
  arr[0] = true;    // alarm 1
  plc.overrides.alarms = arr;
  const get = async () => (await fetch(`${base}/api/alarms`)).json();
  assert.ok(await until(async () => (await get()).entries.some((e) => e.n === 1 && e.off === null), 10000), 'alarm 1 w bazie');
  plc.overrides.alarms = Array(200).fill(false);
  assert.ok(await until(async () => (await get()).entries.some((e) => e.n === 1 && e.off !== null), 10000), 'ustapienie zapisane');
  let r = await post('/api/alarms/ack', {});
  assert.equal(r.status, 403, 'kwitowanie tylko po zalogowaniu');
  r = await post('/api/alarms/ack', {}, await login('Operator', 'op'));
  assert.equal(r.status, 200);
  assert.equal((await get()).unacked, 0);
});

test('kreator figur w PLC: nazwy pol -> sciezki, FiguresGeometricSt liczy aFigure*, kopia calej tablicy do bufora programu', async () => {
  const op = await login('Operator', 'op');
  let r = await post('/api/plc/resolve', { names: ['fFigureLength', 'fFigureWidth', 'aPolygonX[3]', 'nieMaTakiej'] }, op);
  const paths = await r.json();
  assert.equal(paths.fFigureLength, 'HMI2.fFigureLength');
  assert.equal(paths['aPolygonX[3]'], 'HMI2.aPolygonX[3]');
  assert.ok(!('nieMaTakiej' in paths));
  r = await post('/api/plc/write', { items: [{ v: paths.fFigureLength, value: 1200 }, { v: paths.fFigureWidth, value: 600 }] }, op);
  assert.equal(r.status, 200, await r.text());
  // makro HMI: iFigureType + bFigureAddToCurrent (zmienne spoza elementow HMI - lista MACRO_WRITES)
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.bFigureCalculated', value: false }] }, op);
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.iFigureType', value: 10 }, { v: 'HMI2.bFigureAddToCurrent', value: true }] }, op);
  assert.equal(r.status, 200, await r.text());
  assert.ok(await until(() => plc.panel['HMI2.bFigureCalculated'] === true, 5000), 'bFigureCalculated');
  const n = plc.panel['HMI2.iFigureNumber'];
  assert.ok(n >= 4, `prostokat - kroki ${n}`);
  // bufor programu: cala tablica jednym zapisem (jak makro HMI / GetDemoProgram)
  const xs = plc.panel['HMI2.aFigureXPosition'];
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.aProgramXPosition', value: xs }, { v: 'HMI2.iProgramCutNumber', value: n }] }, op);
  assert.equal(r.status, 200, await r.text());
  assert.deepEqual(Array.from(plc.overrides.progX).slice(0, n + 1), xs.slice(0, n + 1));
  assert.equal(plc.overrides.progCutCount, n);
  r = await post('/api/plc/write', { items: [{ v: 'HMI2.aProgramXPosition', value: 5 }] }, op);
  assert.equal(r.status, 502, 'tablica - tylko lista wartosci');
  await post('/api/plc/write', { items: [{ v: 'HMI2.bFigureCalculated', value: false }] }, op);
  assert.equal(plc.panel['HMI2.iFigureType'], 0, 'PLC wraca do NONE');
});

test('po polaczeniu zadnego odczytu (Read) - wartosci i typy do zapisu tylko z subskrypcji', () => {
  assert.deepEqual(reads, []);
});

test('GET /api/plc: poziom dostepu - logowanie, bez tokenu podglad', async () => {
  let p = await (await fetch(`${base}/api/plc`)).json();
  assert.equal(p.level, 0);
  assert.equal(p.auth, true);
  const op = await login('Operator', 'op');
  p = await (await fetch(`${base}/api/plc`, { headers: { authorization: `Bearer ${op}` } })).json();
  assert.equal(p.level, 1);
  assert.equal(p.user, 'Operator');
});
