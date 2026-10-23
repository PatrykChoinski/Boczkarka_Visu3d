// Odczyt przez OPC UA z testowego serwera o drzewie jak w CODESYS, przez serwer VizuApp (SSE).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakePlc, DEVICE } from './fake-plc-server.js';
import { OpcUaSource } from '../src/server/opcua-source.js';
import { loadConfig, createServer } from '../src/server/main.js';
import { VARIABLES, BACKGROUND_KEYS, SCREEN_KEYS } from '../src/shared/config.js';

const PORT = 48461;
let plc;

before(async () => { plc = await startFakePlc(PORT); });
after(async () => { await plc.stop(); });

function config(extra = {}) {
  const cfg = loadConfig('nie-ma-takiego-pliku.json');
  return { ...cfg, endpoint: `opc.tcp://localhost:${PORT}`, ...extra };
}

// czekaj, az zrodlo poda n zestawow wartosci (albo status z tekstem)
function collect(source, n, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const xs = new Set();
    let count = 0;
    const timer = setTimeout(() => reject(new Error(`timeout, status: ${source.status}`)), timeoutMs);
    source.on('values', (v) => {
      // pozycja osi (X / Y / Z / A / B) - w przebiegu testowego PLC sama X potrafi stac ~10 s (zjazd w Z)
      xs.add([v.x, v.y, v.z, v.a, v.b].map((q) => Math.round(q * 1000)).join());
      if (++count >= n) { clearTimeout(timer); resolve({ values: v, xs }); }
    });
  });
}

test('wyszukiwanie wezlow w drzewie OPC UA, subskrypcja zmiennych w tle (bez zmiennych ekranow)', async () => {
  const source = new OpcUaSource(config()).start();
  try {
    const { values, xs } = await collect(source, 30);
    assert.deepEqual(Object.keys(values).sort(), [...BACKGROUND_KEYS].sort());
    assert.equal(Object.keys(source.resolved).length, Object.keys(VARIABLES).length, 'wszystkie zmienne znalezione w OPC UA');
    assert.ok(xs.size > 5, 'pozycja osi sie nie zmienia');
    assert.equal(typeof values.cutStep, 'number');
    assert.equal(typeof values.cutStart, 'boolean');
    // tablice punktow stolu / kamienia jako zwykle tablice (JSON), liczba wierzcholkow
    assert.ok(Array.isArray(values.boardX) && values.boardX.length === 8, 'aCuttingBoardX');
    assert.ok(Array.isArray(values.rockY) && values.rockY.length === 8, 'aCuttingRockY');
    assert.equal(values.boardCount, 4);
    assert.equal(values.rockCount, 5);
    assert.match(source.resolved.x, new RegExp(`\\|var\\|${DEVICE}\\.Application\\.HMI2\\.fXRealPosition`));
    assert.ok(source.connected);
  } finally {
    await source.stop();
  }
});

test('#148 zmiana adresu PLC w trakcie pracy: zly adres, potem sterownik - bez restartu serwera', async () => {
  const source = new OpcUaSource(config({ endpoint: 'opc.tcp://localhost:48499' })).start();
  try {
    await new Promise((resolve) => {
      const check = ({ status }) => { if (status.startsWith('Brak połączenia')) { source.off('status', check); resolve(); } };
      source.on('status', check);
    });
    assert.ok(!source.connected);
    source.reconnect(`opc.tcp://localhost:${PORT}`);
    const { values } = await collect(source, 5);
    assert.ok(source.connected);
    assert.ok(source.status.startsWith(`Połączono (opc.tcp://localhost:${PORT})`), source.status);
    assert.equal(typeof values.x, 'number');
    // i z powrotem na zly adres - polaczenie zerwane od razu
    source.reconnect('opc.tcp://localhost:48499');
    await new Promise((resolve) => {
      const check = ({ status }) => { if (status.includes('48499')) { source.off('status', check); resolve(); } };
      source.on('status', check);
    });
    assert.ok(!source.connected);
  } finally {
    await source.stop();
  }
});

test('nodePrefix z configu', async () => {
  const source = new OpcUaSource(config({ nodePrefix: `ns=${plc.nsIndex};s=|var|${DEVICE}.Application.` })).start();
  try {
    const { values } = await collect(source, 5);
    assert.deepEqual(Object.keys(values).sort(), [...BACKGROUND_KEYS].sort());
  } finally {
    await source.stop();
  }
});

test('subskrypcja zmiennych ekranu: tylko na czas otwarcia (nowy ekran - nowa lista, zamkniecie - koniec)', async () => {
  const source = new OpcUaSource(config()).start();
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
  try {
    await collect(source, 3);
    assert.ok(!('fastVel' in source.values), 'zmienne ekranu Predkosc nie sa subskrybowane bez ekranu');
    source.watch('strona1', { keys: SCREEN_KEYS.speed });
    assert.ok(await until(() => typeof source.values.fastVel === 'number'), 'ekran Predkosc - wartosci z subskrypcji');
    // drugi ekran tej samej strony: Predkosc zamknieta, zmienne ekranu G-kod
    source.watch('strona1', { keys: SCREEN_KEYS.cnc });
    assert.ok(await until(() => typeof source.values.g54X === 'number'));
    assert.ok(!('fastVel' in source.values), 'po zmianie ekranu poprzednie zmienne usuniete');
    source.watch('strona1', { paths: ['HMI.fManualXZeroPosition'] });
    assert.ok(await until(() => 'HMI.fManualXZeroPosition' in source.hmiValues), 'zmienna spoza konfiguracji (pole formularza)');
    // zamkniecie strony - koniec subskrypcji ekranu, zmienne w tle zostaja
    source.unwatch('strona1');
    assert.ok(!('HMI.fManualXZeroPosition' in source.hmiValues) && !('g54X' in source.values));
    assert.equal(source.clients.size, 0);
    assert.equal(typeof source.values.x, 'number');
  } finally {
    await source.stop();
  }
});

test('brak wymaganej zmiennej - czytelny komunikat', async () => {
  const source = new OpcUaSource(config({ variables: { ...VARIABLES, x: 'HMI2.fNieMaTakiejZmiennej' } }));
  const status = new Promise((resolve) => source.on('status', (s) => { if (s.status.includes('brak zmiennych')) resolve(s.status); }));
  source.start();
  try {
    assert.match(await status, /HMI2\.fNieMaTakiejZmiennej/);
  } finally {
    await source.stop();
  }
});

test('serwer VizuApp: /api/config i strumien /api/events z wartosciami z PLC', async () => {
  const cfg = config({ httpPort: 0 });
  const source = new OpcUaSource(cfg).start();
  const server = createServer(cfg, source);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const conf = await (await fetch(`${base}/api/config`)).json();
    assert.equal(conf.plc, true);
    assert.equal(conf.cutSteps[50], 'StartSingleCut');
    const res = await fetch(`${base}/api/events`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let got = null;
    const deadline = Date.now() + 30000;
    while (!got && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      for (const chunk of buf.split('\n\n')) {
        if (!chunk.startsWith('data: ')) continue;
        const msg = JSON.parse(chunk.slice(6));
        if (msg.values && typeof msg.values.x === 'number') got = msg.values;
      }
    }
    await reader.cancel();
    assert.ok(got, 'brak wartosci w strumieniu SSE');
    assert.equal(typeof got.discDiameter, 'number');
  } finally {
    server.close();
    server.closeAllConnections?.();
    await source.stop();
  }
});
