// VizuApp - serwer: czyta zmienne PLC przez OPC UA i podaje je stronie (http://localhost:8128).
//
//   node src/server/main.js [--config plik.json] [--users users.json] [--port 8128] [--host 127.0.0.1]
//                           [--endpoint opc.tcp://...] [--no-plc] [--alarms-db alarms.db]
//
// Domyslnie (maszyna, ekran Full HD): strona tylko na tym komputerze (127.0.0.1), PLC opc.tcp://localhost:4840.
// Tablet (#148): --host 0.0.0.0 (albo "httpHost" w config.json) - strona dostepna w sieci (http://<IP komputera>:8128);
// adres PLC do wpisania na stronie (okno Polaczenie z PLC), zapisany w connection.json obok config.json.
//
// GET /              strona (public/, budowana przez scripts/build-client.js)
// GET /api/config    konfiguracja dla strony (zmienne, kroki CutStep, wartosci poczatkowe offline)
// GET /api/events?cid=  strumien SSE: {status, connected}, pelny stan {values, hmi, full}, potem zmiany z subskrypcji
// GET /api/health    "ok" (vizu.ps1 sprawdza, czy serwer juz dziala)
// POST /api/login, POST /api/logout, GET /api/session - logowanie (#145, auth.js; uzytkownicy z users.json)
// GET /api/variables zmienne PLC: nazwa, wezel OPC UA, typ, ostatnia wartosc (diagnostyka podpiecia)
// GET /api/connection  adres PLC (OPC UA), domyslny adres, adresy strony w sieci (#148)
// POST /api/connection {endpoint} - nowy adres PLC: zapis w connection.json i laczenie od razu (Serwis / Admin;
//                    bez logowania - tylko z tego komputera)
// GET /api/alarms, POST /api/alarms/ack - historia alarmow PLC w SQLite (alarms.db obok config.json, alarmdb.js)
// GET /api/plc       poziom dostepu do sterowania (panel HMI w trybie PLC)
// POST /api/plc/write, /api/plc/hold, /api/plc/watch - sterowanie maszyna z ekranow Visu3D (zmienne jak w HMI, plcwrite.js)

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { VARIABLES, CUT_STEPS, DEFAULTS, validEndpoint } from '../shared/config.js';
import { OpcUaSource } from './opcua-source.js';
import { Auth, USERS_FILE, loadUsers, bearer } from './auth.js';
import { PlcControl, loadHmiWrites } from './plcwrite.js';
import { AlarmDb, ALARMS_DB } from './alarmdb.js';
import { activeFromValues } from '../shared/alarms.js';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
export const CONNECTION_FILE = 'connection.json';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function loadConfig(file) {
  const candidates = file ? [file] : [path.join(process.cwd(), 'config.json'), path.join(APP_DIR, 'config.json')];
  let user = {};
  let dir = file ? path.dirname(path.resolve(file)) : process.cwd();
  for (const f of candidates) {
    if (fs.existsSync(f)) { user = JSON.parse(fs.readFileSync(f, 'utf8')); dir = path.dirname(path.resolve(f)); break; }
  }
  const cfg = { ...DEFAULTS, ...user };
  // uzytkownicy (#145): users.json obok config.json; auth.timeoutMin - wylogowanie po bezczynnosci
  cfg.usersFile = path.join(dir, USERS_FILE);
  // historia alarmow PLC (SQLite) obok config.json
  cfg.alarmsDbFile = path.join(dir, ALARMS_DB);
  // adres PLC wpisany na stronie (#148): connection.json obok config.json (lokalny, poza repo)
  cfg.defaultEndpoint = cfg.endpoint;
  cfg.connectionFile = path.join(dir, CONNECTION_FILE);
  try {
    const conn = JSON.parse(fs.readFileSync(cfg.connectionFile, 'utf8'));
    if (validEndpoint(conn.endpoint)) cfg.endpoint = conn.endpoint;
  } catch { /* brak pliku - adres z config.json */ }
  cfg.auth = { ...DEFAULTS.auth, ...(user.auth || {}) };
  cfg.variables = { ...VARIABLES, ...(user.variables || {}) };
  cfg.frame = { ...DEFAULTS.frame, ...(user.frame || {}) };
  cfg.laser = { ...DEFAULTS.laser, ...(user.laser || {}) };
  cfg.saw = { ...DEFAULTS.saw, ...(user.saw || {}) };
  cfg.offline = {
    machine: { ...DEFAULTS.offline.machine, ...(user.offline?.machine || {}) },
    dynamics: { ...DEFAULTS.offline.dynamics, ...(user.offline?.dynamics || {}) },
    cut: { ...DEFAULTS.offline.cut, ...(user.offline?.cut || {}) },
    start: { ...DEFAULTS.offline.start, ...(user.offline?.start || {}) },
    board: { ...DEFAULTS.offline.board, ...(user.offline?.board || {}) },
    rock: { ...DEFAULTS.offline.rock, ...(user.offline?.rock || {}) },
    saw: { ...DEFAULTS.offline.saw, ...(user.offline?.saw || {}) },
    mode: user.offline?.mode || DEFAULTS.offline.mode,
    speedMax: { ...DEFAULTS.offline.speedMax, ...(user.offline?.speedMax || {}) },
  };
  return cfg;
}

// Konfiguracja dla strony (/api/config); plc - czy jest zrodlo OPC UA. Bez hasel i adresu logowania;
// auth - czy logowanie wlaczone i nazwy uzytkownikow (bez skrotow hasel).
// scripts/build-pages.js zapisuje ja jako plik api/config wersji statycznej (static: true)
export function clientConfig(cfg, plc, auth = null) {
  return {
    plc: Boolean(plc), endpoint: cfg.endpoint, variables: cfg.variables, cutSteps: CUT_STEPS,
    autoClearOnStart: cfg.autoClearOnStart, materialMargin: cfg.materialMargin,
    materialMinSize: cfg.materialMinSize, frame: cfg.frame, offline: cfg.offline,
    tableThickness: cfg.tableThickness, laser: cfg.laser, saw: cfg.saw,
    auth: { enabled: Boolean(auth?.enabled), users: auth?.enabled ? auth.names() : [], timeoutMin: cfg.auth?.timeoutMin ?? 30 },
  };
}

// Adresy strony w sieci (do wpisania na tablecie): IPv4 kart sieciowych; przy 127.0.0.1 - tylko ten komputer
export function pageUrls(host, port) {
  if (host && !['0.0.0.0', '::'].includes(host)) return [`http://${host === '127.0.0.1' ? 'localhost' : host}:${port}/`];
  const ips = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
  return [`http://localhost:${port}/`, ...ips.map((ip) => `http://${ip}:${port}/`)];
}

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// Poziom dostepu do sterowania: z logowania; bez users.json - pelny na komputerze z VizuApp, z sieci tylko STOP / PAUZA
function controlAccess(auth, req) {
  if (auth?.enabled) {
    const s = auth.session(bearer(req));
    return { level: s?.level ?? 0, who: s?.user ?? `niezalogowany ${req.socket.remoteAddress}` };
  }
  return isLocal(req) ? { level: 3, who: 'panel (lokalnie)' } : { level: 0, who: req.socket.remoteAddress };
}

function handleAlarms(alarmDb, auth, req, res, url) {
  if (!alarmDb) return json(res, 404, { error: 'Historia alarmów tylko z PLC (serwer bez --no-plc)' });
  if (url.pathname === '/api/alarms') {
    const n = (k, d) => (Number.isFinite(Number(url.searchParams.get(k))) && url.searchParams.get(k) !== null ? Number(url.searchParams.get(k)) : d);
    return json(res, 200, alarmDb.list({ limit: n('limit', 200), offset: n('offset', 0), active: url.searchParams.get('active') === '1' }));
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Metoda niedozwolona' });
  // kwitowanie: zalogowany (Operator+); bez users.json - komputer z VizuApp
  if (controlAccess(auth, req).level < 1) return json(res, 403, { error: 'Zaloguj się, żeby kwitować alarmy' });
  return json(res, 200, { acked: alarmDb.ack() });
}

async function handlePlc(control, source, auth, req, res, pathname) {
  const acc = controlAccess(auth, req);
  if (pathname === '/api/plc') {
    return json(res, 200, { level: acc.level, user: acc.who, control: Boolean(control), connected: Boolean(source?.connected),
      local: !auth?.enabled && isLocal(req), auth: Boolean(auth?.enabled) });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Metoda niedozwolona' });
  if (!control) return json(res, 409, { error: 'Serwer uruchomiony bez PLC (--no-plc)' });
  const body = await readJson(req, 65536);
  try {
    if (pathname === '/api/plc/watch') return json(res, 200, { watched: control.watch(body.cid, body.keys, body.paths) });
    if (pathname === '/api/plc/write') await control.write(body.items, acc.who, acc.level);
    else if (pathname === '/api/plc/hold') await control.hold(String(body.v || ''), Boolean(body.on), acc.who, acc.level);
    else return json(res, 404, { error: 'Nieznana operacja' });
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.code === 403 || err.code === 400 ? err.code : 502, { error: err.message || String(err) });
  }
}

async function handleConnection(cfg, source, auth, req, res) {
  const info = () => ({
    endpoint: cfg.endpoint, defaultEndpoint: cfg.defaultEndpoint, plc: Boolean(source),
    status: source ? source.status : 'Bez PLC (--no-plc)', connected: Boolean(source?.connected),
    urls: pageUrls(cfg.httpHost, cfg.httpPort),
  });
  if (req.method === 'GET') return json(res, 200, info());
  if (req.method !== 'POST') return json(res, 405, { error: 'Metoda niedozwolona' });
  // zmiana adresu: Serwis / Admin; bez logowania (brak users.json) - tylko z tego komputera
  if (auth?.enabled ? (auth.session(bearer(req))?.level ?? 0) < 2 : !isLocal(req)) {
    return json(res, 403, { error: auth?.enabled ? 'Zmiana adresu PLC – zaloguj jako Serwis albo Admin' : 'Zmiana adresu PLC tylko na komputerze z VizuApp' });
  }
  if (!source) return json(res, 409, { error: 'Serwer uruchomiony bez PLC (--no-plc)' });
  const { endpoint } = await readJson(req);
  const want = endpoint === '' || endpoint === null ? cfg.defaultEndpoint : endpoint;
  if (!validEndpoint(want)) return json(res, 400, { error: 'Zły adres – np. opc.tcp://192.168.1.10:4840' });
  try {
    if (want === cfg.defaultEndpoint) fs.rmSync(cfg.connectionFile, { force: true });
    else fs.writeFileSync(cfg.connectionFile, `${JSON.stringify({ endpoint: want }, null, 2)}
`);
  } catch (err) {
    return json(res, 500, { error: `Nie zapisano ${CONNECTION_FILE}: ${err.message}` });
  }
  source.reconnect(want);
  return json(res, 200, info());
}

const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(obj));

// Tresc zadania JSON (domyslnie najwyzej 4 kB)
function readJson(req, max = 4096) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > max) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function handleAuth(auth, req, res, pathname) {
  if (!auth?.enabled) return json(res, 404, { error: 'Logowanie wyłączone (brak users.json)' });
  if (pathname === '/api/login' && req.method === 'POST') {
    const { user, password } = await readJson(req);
    const s = auth.login(String(user || ''), String(password || ''));
    if (s) return json(res, 200, s);
    // zle haslo: odpowiedz z opoznieniem (zgadywanie hasel wolniej)
    return setTimeout(() => json(res, 401, { error: 'Złe hasło' }), 500);
  }
  if (pathname === '/api/logout' && req.method === 'POST') {
    auth.logout(bearer(req));
    return json(res, 200, { ok: true });
  }
  if (pathname === '/api/session') {
    const s = auth.session(bearer(req));
    return s ? json(res, 200, s) : json(res, 401, { error: 'Brak sesji' });
  }
  return json(res, 405, { error: 'Metoda niedozwolona' });
}

export function createServer(cfg, source, auth = null, hmiWrites = null, alarmDb = null) {
  const clients = new Set();
  const control = source ? new PlcControl(source, hmiWrites ?? loadHmiWrites(path.join(APP_DIR, 'src', 'server', 'hmiwrites.json'))) : null;
  const send = (obj) => {
    const msg = `data: ${JSON.stringify(obj)}\n\n`;
    for (const res of clients) res.write(msg);
  };
  if (source) {
    // zmiany z subskrypcji OPC UA (tylko zmienione wartosci; strona je laczy)
    source.on('status', send);
    source.on('delta', send);
    // historia alarmow: kazda zmiana tablicy HMI2.aAlarms (subskrypcja w tle) - zapis w SQLite, strony odswiezaja liste
    if (alarmDb) {
      source.on('delta', (d) => {
        if (!d.values || !('alarms' in d.values)) return;
        try {
          if (alarmDb.update(activeFromValues(d.values), Date.now(), cfg.endpoint)) send({ alarmsVersion: alarmDb.version });
        } catch (err) { console.log(`[alarmy] zapis do bazy: ${err.message}`); }
      });
    }
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    } else if (url.pathname === '/api/config') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(clientConfig(cfg, source, auth)));
    } else if (url.pathname === '/api/variables') {
      json(res, 200, { connected: Boolean(source?.connected), status: source ? source.status : 'Bez PLC (--no-plc)',
        variables: source ? source.variablesReport() : [] });
    } else if (url.pathname === '/api/connection') {
      handleConnection(cfg, source, auth, req, res);
    } else if (url.pathname === '/api/plc' || url.pathname.startsWith('/api/plc/')) {
      handlePlc(control, source, auth, req, res, url.pathname);
    } else if (url.pathname === '/api/alarms' || url.pathname === '/api/alarms/ack') {
      handleAlarms(alarmDb, auth, req, res, url);
    } else if (['/api/login', '/api/logout', '/api/session'].includes(url.pathname)) {
      handleAuth(auth, req, res, url.pathname);
    } else if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      // na poczatek pelny stan; cid - identyfikator strony (zamkniecie strony konczy subskrypcje jej ekranow)
      res.write(`data: ${JSON.stringify(source
        ? { status: source.status, connected: source.connected, values: source.values, hmi: source.hmiValues, full: true }
        : { status: 'Bez PLC (--no-plc)', connected: false })}\n\n`);
      const cid = url.searchParams.get('cid');
      res.cid = cid;
      clients.add(res);
      req.on('close', () => {
        clients.delete(res);
        if (source && cid && ![...clients].some((r) => r.cid === cid)) source.unwatch(cid);
      });
    } else {
      serveStatic(url.pathname, res);
    }
  });
  // podtrzymanie strumienia SSE (proxy / przegladarka nie zamkna bezczynnego polaczenia)
  const keepAlive = setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);
  server.on('close', () => { clearInterval(keepAlive); control?.close(); });
  return server;
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      config: { type: 'string' }, users: { type: 'string' }, port: { type: 'string' }, host: { type: 'string' },
      endpoint: { type: 'string' }, 'no-plc': { type: 'boolean' }, 'alarms-db': { type: 'string' },
    },
  });
  const cfg = loadConfig(args.config);
  if (args.endpoint) cfg.endpoint = cfg.defaultEndpoint = args.endpoint;
  if (args.port) cfg.httpPort = Number(args.port);
  if (args.host) cfg.httpHost = args.host;
  const source = args['no-plc'] ? null : new OpcUaSource(cfg);
  const auth = new Auth(loadUsers(args.users || cfg.usersFile), cfg.auth);
  let alarmDb = null;
  if (source) {
    try { alarmDb = new AlarmDb(args['alarms-db'] || cfg.alarmsDbFile); } catch (err) { console.log(`Historia alarmów wyłączona (${cfg.alarmsDbFile}): ${err.message}`); }
  }
  const server = createServer(cfg, source, auth, null, alarmDb);
  server.on('error', (err) => {
    // drugie uruchomienie (vizu.ps1) - serwer juz dziala
    if (err.code === 'EADDRINUSE') { console.log(`Port ${cfg.httpPort} zajety - VizuApp juz dziala`); process.exit(0); }
    throw err;
  });
  server.listen(cfg.httpPort, cfg.httpHost, () => {
    console.log(`VizuApp: ${pageUrls(cfg.httpHost, cfg.httpPort).join('  ')}  (OPC UA: ${source ? cfg.endpoint : 'wylaczone'}, logowanie: ${auth.enabled ? auth.names().join(' / ') : 'wylaczone - brak users.json'})`);
    if (source) source.start();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
