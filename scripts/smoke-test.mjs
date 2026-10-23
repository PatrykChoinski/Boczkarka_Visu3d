// Test uruchomienia strony w przegladarce (CI na Windows, lokalnie tez): buduje strone, odpala ja i sprawdza w Chrome / Edge
// (headless, przegladarka z systemu przez playwright-core):
//   1. serwer VizuApp bez PLC (--no-plc): strona, widok 3D, symulacja ciecia offline,
//   2. serwer VizuApp z testowym PLC (test/fake-plc-server.js, OPC UA): tryb online - polaczenie i pozycje osi,
//   3. wersja statyczna GitHub Pages (scripts/build-pages.js -> site/) pod podkatalogiem jak na github.io.
// Kazdy blad JS / konsoli na stronie = blad testu. Zrzuty ekranu w test-results/.
//
//   node scripts/smoke-test.mjs            (CHROME_PATH - wlasna przegladarka; domyslnie Chrome, potem Edge)

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test-results');
const PORT_OFFLINE = 18128;
const PORT_ONLINE = 18129;
const PORT_PLC = 14840;
const PORT_STATIC = 18130;
const procs = [];

const log = (msg) => console.log(`[smoke] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(args, name) {
  const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  procs.push(p);
  return p;
}

async function waitHttp(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* jeszcze nie */ }
    await sleep(200);
  }
  throw new Error(`brak odpowiedzi: ${url}`);
}

// Statyczny serwer plikow site/ pod /Promasz-Visu3D/ (jak GitHub Pages)
function staticServer(dir, prefix, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function launchBrowser() {
  const args = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args });
  for (const channel of ['chrome', 'msedge']) {
    try {
      const b = await chromium.launch({ channel, headless: true, args });
      log(`przegladarka: ${channel} ${b.version()}`);
      return b;
    } catch (e) { log(`${channel} niedostepny: ${e.message.split('\n')[0]}`); }
  }
  throw new Error('brak Chrome / Edge (ustaw CHROME_PATH)');
}

// Strona w nowym kontekscie (czysty localStorage); bledy JS i konsoli zbierane do errors
async function openPage(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // bledy konsoli poza "Failed to load resource" - te z adresem z odpowiedzi ponizej (favicon.ico przegladarki pomijany)
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!r.url().endsWith('/favicon.ico')) errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.vizu?.state?.cfg && window.vizu.state.forms, null, { timeout: 20000 });
  return { page, context, errors, requests };
}

async function checkView(page) {
  const box = await page.evaluate(() => {
    const c = document.querySelector('#view canvas');
    return c ? { w: c.width, h: c.height, gl: Boolean(c.getContext('webgl2') || c.getContext('webgl')) } : null;
  });
  if (!box || box.w < 100 || box.h < 100) throw new Error(`brak widoku 3D: ${JSON.stringify(box)}`);
}

// Symulacja ciecia prostego offline (tempo 100x): ciecie zapisane, napis "Cięcie: ..."
async function checkOfflineCut(page) {
  await page.click('#mode [data-mode="offline"]');
  await page.selectOption('#speed', '100');
  await page.click('.tabs [data-tab="cut"]');
  await page.selectOption('#op', 'cut');
  await page.click('#cutStart');
  await page.waitForFunction(() => window.vizu.state.recorder.cuts.length > 0 && !window.vizu.state.sim.running, null, { timeout: 60000 });
  const hud = await page.textContent('#hudCut');
  if (!/^Cięcie: długość \d+/.test(hud)) throw new Error(`napis ciecia: ${hud}`);
  return hud;
}

function assertNoErrors(name, errors) {
  if (errors.length) throw new Error(`${name}: bledy na stronie:\n  ${errors.join('\n  ')}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  log('budowa strony i wersji statycznej');
  await import('./build-pages.js');            // public/ (build-client) i site/

  const browser = await launchBrowser();
  try {
    // 1. serwer bez PLC
    // bez users.json (logowanie wylaczone - pelny dostep), tez gdy lokalnie jest plik uzytkownikow
    run(['src/server/main.js', '--no-plc', '--users', 'brak-users.json', '--port', String(PORT_OFFLINE)], 'serwer-offline');
    await waitHttp(`http://127.0.0.1:${PORT_OFFLINE}/api/health`);
    {
      const { page, context, errors } = await openPage(browser, `http://127.0.0.1:${PORT_OFFLINE}/`);
      await checkView(page);
      const hud = await checkOfflineCut(page);
      await page.screenshot({ path: path.join(OUT, 'offline.png') });
      assertNoErrors('serwer offline', errors);
      log(`OK serwer offline: ${hud}`);
      await context.close();
    }

    // 2. serwer z testowym PLC (OPC UA)
    run(['test/fake-plc-server.js', '--port', String(PORT_PLC)], 'fake-plc');
    // osobna baza historii alarmow (nie alarms.db maszyny obok config.json)
    run(['src/server/main.js', '--users', 'brak-users.json', '--port', String(PORT_ONLINE), '--endpoint', `opc.tcp://localhost:${PORT_PLC}`,
      '--alarms-db', path.join(os.tmpdir(), `vizu-smoke-alarms-${process.pid}.db`)], 'serwer-online');
    await waitHttp(`http://127.0.0.1:${PORT_ONLINE}/api/health`);
    {
      const { page, context, errors } = await openPage(browser, `http://127.0.0.1:${PORT_ONLINE}/`);
      await page.waitForFunction(() => window.vizu.state.mode === 'online' && window.vizu.state.online.connected
        && Number.isFinite(window.vizu.state.pose?.x), null, { timeout: 60000 });
      await checkView(page);
      const conn = await page.textContent('#conn');
      await page.screenshot({ path: path.join(OUT, 'online.png') });
      assertNoErrors('serwer online', errors);
      log(`OK serwer online: ${conn}, pozycja ${await page.textContent('#pos')}`);
      // podpiecie zmiennych: kazda zmienna z konfiguracji znaleziona w OPC UA; typ i wartosc - z subskrypcji: zmienne
      // w tle od razu, pozostale po zgloszeniu jako ekran (POST /api/plc/watch) - tu wszystkie naraz
      const api = `http://127.0.0.1:${PORT_ONLINE}/api`;
      const all = (await (await fetch(`${api}/variables`)).json()).variables;
      const noNode = all.filter((v) => !v.found).map((v) => v.name);
      if (noNode.length) throw new Error(`zmienne PLC bez wezla OPC UA: ${noNode.join(', ')}`);
      // jeden ekran - najwyzej 400 zmiennych: wszystkie jako kilka stron (cid)
      for (let i = 0; i < all.length; i += 200) {
        await fetch(`${api}/plc/watch`, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cid: `smoke${i}`, keys: all.slice(i, i + 200).map((v) => v.key) }) });
      }
      let missing = [];
      for (let i = 0; i < 40; i++) {
        const vars = (await (await fetch(`${api}/variables`)).json()).variables;
        missing = vars.filter((v) => !v.dataType || v.value === null).map((v) => v.name);
        if (!missing.length) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (missing.length) throw new Error(`zmienne PLC bez typu / wartosci z subskrypcji: ${missing.join(', ')}`);
      log(`OK zmienne PLC: ${all.length}/${all.length} z typem i wartością (subskrypcje)`);
      await context.close();
    }

    // 3. wersja statyczna (GitHub Pages)
    const st = await staticServer(path.join(ROOT, 'site'), '/Promasz-Visu3D/', PORT_STATIC);
    try {
      const { page, context, errors, requests } = await openPage(browser, `http://127.0.0.1:${PORT_STATIC}/Promasz-Visu3D/`);
      const info = await page.evaluate(() => ({
        isStatic: window.vizu.state.cfg.static, mode: window.vizu.state.mode,
        onlineHidden: document.querySelector('#mode [data-mode="online"]').hidden,
      }));
      if (!info.isStatic || info.mode !== 'offline' || !info.onlineHidden) throw new Error(`wersja statyczna: ${JSON.stringify(info)}`);
      if (requests.some((u) => u.includes('api/events'))) throw new Error('wersja statyczna laczy sie z api/events');
      await checkView(page);
      // logowanie demonstracyjne (bez hasla): niezalogowany - bez ekranu Manual, Operator - Manual widoczny
      const hiddenBefore = await page.evaluate(() => document.querySelector('.tabs [data-tab="cut"]').hidden);
      if (!hiddenBefore) throw new Error('wersja statyczna: Manual widoczny bez logowania');
      await page.click('#loginBtn');
      await page.selectOption('#loginUser', 'Operator');
      await page.click('#loginForm button[type="submit"]');
      await page.waitForFunction(() => window.vizu.state.auth.user === 'Operator' && !document.querySelector('.tabs [data-tab="cut"]').hidden);
      const hud = await checkOfflineCut(page);
      await page.screenshot({ path: path.join(OUT, 'pages.png') });
      assertNoErrors('wersja statyczna', errors);
      log(`OK wersja statyczna (GitHub Pages): logowanie demo (Operator), ${hud}`);
      await context.close();
    } finally {
      st.close();
    }
  } finally {
    await browser.close();
  }
  log('wszystko OK');
}

try {
  await main();
} catch (e) {
  console.error(`[smoke] BLAD: ${e.message}`);
  process.exitCode = 1;
} finally {
  for (const p of procs) p.kill();
}
