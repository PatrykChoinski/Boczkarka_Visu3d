// VizuApp - serwer: czyta zmienne PLC przez OPC UA i podaje je stronie (http://localhost:8128).
//
//   node src/server/main.js [--config plik.json] [--port 8128] [--endpoint opc.tcp://...] [--no-plc]
//
// GET /              strona (public/, budowana przez scripts/build-client.js)
// GET /api/config    konfiguracja dla strony (zmienne, kroki CutStep, wartosci poczatkowe offline)
// GET /api/events    strumien SSE: {status, connected} i {values}
// GET /api/health    "ok" (vizu.ps1 sprawdza, czy serwer juz dziala)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { VARIABLES, CUT_STEPS, DEFAULTS } from '../shared/config.js';
import { OpcUaSource } from './opcua-source.js';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function loadConfig(file) {
  const candidates = file ? [file] : [path.join(process.cwd(), 'config.json'), path.join(APP_DIR, 'config.json')];
  let user = {};
  for (const f of candidates) {
    if (fs.existsSync(f)) { user = JSON.parse(fs.readFileSync(f, 'utf8')); break; }
  }
  const cfg = { ...DEFAULTS, ...user };
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

// Konfiguracja dla strony (/api/config); plc - czy jest zrodlo OPC UA. Bez hasel i adresu logowania.
// scripts/build-pages.js zapisuje ja jako plik api/config wersji statycznej (static: true)
export function clientConfig(cfg, plc) {
  return {
    plc: Boolean(plc), endpoint: cfg.endpoint, variables: cfg.variables, cutSteps: CUT_STEPS,
    autoClearOnStart: cfg.autoClearOnStart, materialMargin: cfg.materialMargin,
    materialMinSize: cfg.materialMinSize, frame: cfg.frame, offline: cfg.offline,
    tableThickness: cfg.tableThickness, laser: cfg.laser, saw: cfg.saw,
  };
}

export function createServer(cfg, source) {
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
      res.end(JSON.stringify(clientConfig(cfg, source)));
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
      config: { type: 'string' }, port: { type: 'string' }, endpoint: { type: 'string' }, 'no-plc': { type: 'boolean' },
    },
  });
  const cfg = loadConfig(args.config);
  if (args.endpoint) cfg.endpoint = args.endpoint;
  if (args.port) cfg.httpPort = Number(args.port);
  const source = args['no-plc'] ? null : new OpcUaSource(cfg);
  const server = createServer(cfg, source);
  server.on('error', (err) => {
    // drugie uruchomienie (vizu.ps1) - serwer juz dziala
    if (err.code === 'EADDRINUSE') { console.log(`Port ${cfg.httpPort} zajety - VizuApp juz dziala`); process.exit(0); }
    throw err;
  });
  server.listen(cfg.httpPort, '127.0.0.1', () => {
    console.log(`VizuApp: http://localhost:${cfg.httpPort}/  (OPC UA: ${source ? cfg.endpoint : 'wylaczone'})`);
    if (source) source.start();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
