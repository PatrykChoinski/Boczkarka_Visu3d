// VizuApp - serwer: czyta zmienne PLC przez OPC UA i podaje je stronie (http://localhost:8128).
//
//   node src/server/main.js [--config plik.json] [--users users.json] [--port 8128] [--endpoint opc.tcp://...] [--no-plc]
//
// GET /              strona (public/, budowana przez scripts/build-client.js)
// GET /api/config    konfiguracja dla strony (zmienne, kroki CutStep, wartosci poczatkowe offline)
// GET /api/events    strumien SSE: {status, connected} i {values}
// GET /api/health    "ok" (vizu.ps1 sprawdza, czy serwer juz dziala)
// POST /api/login, POST /api/logout, GET /api/session - logowanie (#145, auth.js; uzytkownicy z users.json)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { VARIABLES, CUT_STEPS, DEFAULTS } from '../shared/config.js';
import { OpcUaSource } from './opcua-source.js';
import { Auth, USERS_FILE, loadUsers, bearer } from './auth.js';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
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

const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(obj));

// Tresc zadania JSON (najwyzej 4 kB)
function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
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

export function createServer(cfg, source, auth = null) {
  const clients = new Set();
  const send = (obj) => {
    const msg = `data: ${JSON.stringify(obj)}\n\n`;
    for (const res of clients) res.write(msg);
  };
  if (source) {
    source.active = false;
    source.on('status', send);
    source.on('values', (values) => send({ values }));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    } else if (url.pathname === '/api/config') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(clientConfig(cfg, source, auth)));
    } else if (['/api/login', '/api/logout', '/api/session'].includes(url.pathname)) {
      handleAuth(auth, req, res, url.pathname);
    } else if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(source
        ? { status: source.status, connected: source.connected, values: source.values }
        : { status: 'Bez PLC (--no-plc)', connected: false })}\n\n`);
      clients.add(res);
      if (source) source.active = true;
      req.on('close', () => {
        clients.delete(res);
        if (source) source.active = clients.size > 0;
      });
    } else {
      serveStatic(url.pathname, res);
    }
  });
  // podtrzymanie strumienia SSE (proxy / przegladarka nie zamkna bezczynnego polaczenia)
  const keepAlive = setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);
  server.on('close', () => clearInterval(keepAlive));
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
      config: { type: 'string' }, users: { type: 'string' }, port: { type: 'string' }, endpoint: { type: 'string' }, 'no-plc': { type: 'boolean' },
    },
  });
  const cfg = loadConfig(args.config);
  if (args.endpoint) cfg.endpoint = args.endpoint;
  if (args.port) cfg.httpPort = Number(args.port);
  const source = args['no-plc'] ? null : new OpcUaSource(cfg);
  const auth = new Auth(loadUsers(args.users || cfg.usersFile), cfg.auth);
  const server = createServer(cfg, source, auth);
  server.on('error', (err) => {
    // drugie uruchomienie (vizu.ps1) - serwer juz dziala
    if (err.code === 'EADDRINUSE') { console.log(`Port ${cfg.httpPort} zajety - VizuApp juz dziala`); process.exit(0); }
    throw err;
  });
  server.listen(cfg.httpPort, '127.0.0.1', () => {
    console.log(`VizuApp: http://localhost:${cfg.httpPort}/  (OPC UA: ${source ? cfg.endpoint : 'wylaczone'}, logowanie: ${auth.enabled ? auth.names().join(' / ') : 'wylaczone - brak users.json'})`);
    if (source) source.start();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
