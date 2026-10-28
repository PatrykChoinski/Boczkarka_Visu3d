// Test uruchomienia strony w przegladarce (CI na Windows, lokalnie tez): buduje strone, odpala ja i sprawdza w Chrome / Edge
// (headless, przegladarka z systemu przez playwright-core):
//   1. serwer VizuApp bez PLC (--no-plc): strona, widok 3D, symulacja cyklu boczkarki offline,
//   2. serwer VizuApp z testowym PLC (test/fake-plc-server.js --auto, OPC UA): tryb online - polaczenie, pozycje, zmienne,
//      panel obslugi: reczny (jog), serwis (zapis parametru), logowanie Operatora (users.json testowy),
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
const PORT_AUTH = 18131;
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

// Statyczny serwer plikow site/ pod /Boczkarka_Visu3d/ (jak GitHub Pages)
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
async function openPage(browser, url, langCode = null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (langCode) await context.addInitScript((l) => { localStorage.setItem('vizu.lang', l); }, langCode);
  const page = await context.newPage();
  page.setDefaultTimeout(90000);  // runner CI bez GPU
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // bledy konsoli poza "Failed to load resource" - te z adresem z odpowiedzi ponizej (favicon.ico przegladarki pomijany)
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!r.url().endsWith('/favicon.ico')) errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'lite', { waitUntil: 'load' });  // bez cieni: runner CI renderuje programowo
  await page.waitForFunction(() => window.vizu?.app && window.vizu.view, null, { timeout: 20000 });
  return { page, context, errors, requests };
}

async function checkView(page) {
  const box = await page.evaluate(() => {
    const c = document.querySelector('#view canvas');
    return c ? { w: c.width, h: c.height, gl: Boolean(c.getContext('webgl2') || c.getContext('webgl')) } : null;
  });
  if (!box || box.w < 100 || box.h < 100) throw new Error(`brak widoku 3D: ${JSON.stringify(box)}`);
}

// Symulacja offline (tempo 30x): receptura 1 (bok prosty) na krotkim polu - cykl do konca, krawedz obrobiona
async function checkOfflineCycle(page) {
  // akcje przez DOM (bez czekania playwrighta na klikalnosc - na runnerze bez GPU rendering cieni zajmuje watek strony)
  log('offline: receptura 1, pole 200-500, tempo 30x, START');
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change')); };
    document.querySelector('#mode [data-mode="offline"]').click();
    set('recipe', '0');
    set('xStart', '200');
    set('xEnd', '500');
    set('feed', '6');
    document.getElementById('speed').value = '30';
    document.getElementById('simStart').click();
  });
  await page.waitForFunction(() => window.vizu.sim.cycles > 0, null, { timeout: 120000, polling: 500 });
  const c = await page.evaluate(() => { const x = window.vizu.current(); return { done: x.cut.done, passes: x.passes.length, count: document.getElementById('sCount').textContent }; });
  if (c.done !== 1 || c.passes !== 1) throw new Error(`cykl offline: ${JSON.stringify(c)}`);
  return `cykl offline: ${c.done}/${c.passes} przejść, ${c.count}`;
}

// Reczny i serwis offline: jog X+ trzymany 1 s rusza os symulatora, parametr z karty Serwis zmienia symulator
async function checkOfflinePanel(page) {
  await page.waitForFunction(() => window.vizu.sim.step === 0);
  const x0 = await page.evaluate(() => window.vizu.sim.x.pos);
  await page.evaluate(() => document.querySelector('[data-jog="x:1"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })));
  await sleep(1000);
  await page.evaluate(() => document.querySelector('[data-jog="x:1"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })));
  const x1 = await page.evaluate(() => window.vizu.sim.x.pos);
  if (!(x1 > x0 + 1)) throw new Error(`jog offline: X ${x0} -> ${x1}`);
  const jf = await page.evaluate(() => {
    const e = document.querySelector('[data-param="AxesConfig.JogFastX"]');
    e.value = '120';
    e.dispatchEvent(new Event('change'));
    return window.vizu.sim.o.jogFastX;
  });
  if (jf !== 120) throw new Error(`parametr offline: jogFastX ${jf}`);
  return `jog X ${x0.toFixed(0)} -> ${x1.toFixed(0)} mm, Jog szybko X = ${jf}`;
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
      const hud = await checkOfflineCycle(page);
      const panel = await checkOfflinePanel(page);
      await page.screenshot({ path: path.join(OUT, 'offline.png') });
      assertNoErrors('serwer offline', errors);
      log(`OK serwer offline: ${hud}; ${panel}`);
      await context.close();
    }

    // 2. serwer z testowym PLC (OPC UA)
    run(['test/fake-plc-server.js', '--port', String(PORT_PLC), '--auto'], 'fake-plc');
    // osobna baza historii alarmow (nie alarms.db maszyny obok config.json)
    run(['src/server/main.js', '--users', 'brak-users.json', '--port', String(PORT_ONLINE), '--endpoint', `opc.tcp://localhost:${PORT_PLC}`,
      '--alarms-db', path.join(os.tmpdir(), `vizu-smoke-alarms-${process.pid}.db`)], 'serwer-online');
    await waitHttp(`http://127.0.0.1:${PORT_ONLINE}/api/health`);
    {
      const { page, context, errors } = await openPage(browser, `http://127.0.0.1:${PORT_ONLINE}/`);
      await page.waitForFunction(() => window.vizu.app.mode === 'online' && window.vizu.app.connected
        && Number.isFinite(window.vizu.app.values.x) && window.vizu.app.values.step > 0, null, { timeout: 120000, polling: 500 });
      await checkView(page);
      const conn = await page.textContent('#connChip');
      await page.screenshot({ path: path.join(OUT, 'online.png') });
      assertNoErrors('serwer online', errors);
      log(`OK serwer online: ${conn}, X ${await page.textContent('#sX')}, krok ${await page.textContent('#sStep')}`);
      // podpiecie zmiennych: kazda zmienna z konfiguracji znaleziona w OPC UA; typ i wartosc - z subskrypcji w tle
      const api = `http://127.0.0.1:${PORT_ONLINE}/api`;
      const all = (await (await fetch(`${api}/variables`)).json()).variables;
      const noNode = all.filter((v) => !v.found).map((v) => v.name);
      if (noNode.length) throw new Error(`zmienne PLC bez wezla OPC UA: ${noNode.join(', ')}`);
      let missing = [];
      for (let i = 0; i < 40; i++) {
        const vars = (await (await fetch(`${api}/variables`)).json()).variables;
        missing = vars.filter((v) => !v.dataType || v.value === null).map((v) => v.name);
        if (!missing.length) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (missing.length) throw new Error(`zmienne PLC bez typu / wartosci z subskrypcji: ${missing.join(', ')}`);
      log(`OK zmienne PLC: ${all.length}/${all.length} z typem i wartością (subskrypcje)`);
      // bez users.json: logowanie Admin bez hasla na komputerze z VizuApp; reczny i serwis widoczne, parametry z PLC,
      // zapis parametru (TIME s -> ms)
      await page.evaluate(() => {
        document.getElementById('loginBtn').click();
        document.getElementById('loginUser').value = 'Admin';
        document.getElementById('loginUser').dispatchEvent(new Event('change'));
        document.getElementById('loginForm').requestSubmit();
      });
      await page.waitForFunction(() => window.vizu.app.level === 3, null, { timeout: 20000, polling: 250 });
      await page.waitForFunction(() => !document.getElementById('manOpen').hidden
        && !document.querySelector('#screens [data-tab="service"]').hidden
        && document.querySelector('[data-param="EdgeProfileConfig.ClampDelay"]').value === '1', null, { timeout: 30000, polling: 250 });
      await page.evaluate(() => {
        const e = document.querySelector('[data-param="EdgeProfileConfig.ClampDelay"]');
        e.value = '1.5';
        e.dispatchEvent(new Event('change'));
      });
      await page.waitForFunction(() => window.vizu.app.hmi['EdgeProfileConfig.ClampDelay'] === 1500, null, { timeout: 30000, polling: 250 });
      assertNoErrors('serwer online - serwis', errors);
      log(`OK serwis online: ${await page.textContent('#userChip')}, ustalenie docisku 1 s -> 1.5 s w PLC`);
      const hist = await (await fetch(`${api}/alarms?limit=5`)).json();
      if (!Array.isArray(hist.entries)) throw new Error(`historia alarmow: ${JSON.stringify(hist)}`);
      log(`OK historia alarmów w bazie: ${hist.total} wpisów`);
      await context.close();
    }

    // 2b. logowanie (users.json z haslami testowymi w katalogu tymczasowym)
    {
      const { hashPassword } = await import('../src/server/auth.js');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-smoke-users-'));
      const usersFile = path.join(dir, 'users.json');
      const pass = `op-${process.pid}`;
      fs.writeFileSync(usersFile, JSON.stringify({ users: { Operator: { level: 1, ...hashPassword(pass) } } }));
      run(['src/server/main.js', '--users', usersFile, '--port', String(PORT_AUTH), '--endpoint', `opc.tcp://localhost:${PORT_PLC}`,
        '--alarms-db', path.join(dir, 'alarms.db')], 'serwer-logowanie');
      await waitHttp(`http://127.0.0.1:${PORT_AUTH}/api/health`);
      const { page, context, errors } = await openPage(browser, `http://127.0.0.1:${PORT_AUTH}/`);
      await page.waitForFunction(() => window.vizu.app.mode === 'online' && window.vizu.app.connected, null, { timeout: 60000, polling: 250 });
      const before = await page.evaluate(() => ({
        login: !document.getElementById('loginBtn').hidden, manual: !document.getElementById('manOpen').hidden,
        controls: !document.getElementById('plcControls').hidden,
      }));
      if (!before.login || before.manual || before.controls) throw new Error(`przed logowaniem: ${JSON.stringify(before)}`);
      await page.evaluate((p) => {
        document.getElementById('loginBtn').click();
        document.getElementById('loginPass').value = p;
        document.getElementById('loginForm').requestSubmit();
      }, pass);
      await page.waitForFunction(() => window.vizu.app.level === 1, null, { timeout: 20000, polling: 250 });
      const after = await page.evaluate(() => ({
        manual: !document.getElementById('manOpen').hidden, service: !document.querySelector('#screens [data-tab="service"]').hidden,
        controls: !document.getElementById('plcControls').hidden, chip: document.getElementById('userChip').textContent,
      }));
      if (!after.manual || after.service || !after.controls) throw new Error(`po logowaniu Operatora: ${JSON.stringify(after)}`);
      await page.screenshot({ path: path.join(OUT, 'login.png') });
      await page.evaluate(() => document.getElementById('loginBtn').click());
      await page.waitForFunction(() => window.vizu.app.level === 0, null, { timeout: 20000, polling: 250 });
      assertNoErrors('logowanie', errors);
      log(`OK logowanie: ${after.chip} (ręczny i sterowanie widoczne, serwis ukryty), wylogowanie`);
      await context.close();
    }

    // 3. wersja statyczna (GitHub Pages)
    const st = await staticServer(path.join(ROOT, 'site'), '/Boczkarka_Visu3d/', PORT_STATIC);
    try {
      const { page, context, errors, requests } = await openPage(browser, `http://127.0.0.1:${PORT_STATIC}/Boczkarka_Visu3d/`);
      const info = await page.evaluate(() => ({
        isStatic: Boolean(window.vizu.app && document.querySelector('#mode [data-mode="online"]').disabled), mode: window.vizu.app.mode,
      }));
      if (!info.isStatic || info.mode !== 'offline') throw new Error(`wersja statyczna: ${JSON.stringify(info)}`);
      if (requests.some((u) => u.includes('api/events'))) throw new Error('wersja statyczna laczy sie z api/events');
      await checkView(page);
      const hud = await checkOfflineCycle(page);
      await page.screenshot({ path: path.join(OUT, 'pages.png') });
      assertNoErrors('wersja statyczna', errors);
      log(`OK wersja statyczna (GitHub Pages): ${hud}`);
      await context.close();
      // wersja angielska: zadnego polskiego tekstu (wezly, podpowiedzi, opcje list) po wybraniu EN, takze w Serwisie
      const en = await openPage(browser, `http://127.0.0.1:${PORT_STATIC}/Boczkarka_Visu3d/`, 'en');
      await en.page.evaluate(() => {
        document.getElementById('loginBtn').click();
        document.getElementById('loginUser').value = 'Admin';
        document.getElementById('loginForm').requestSubmit();
        document.querySelector('[data-tab="service"]').click();
        document.getElementById('manOpen').click();
        document.getElementById('alarmOpen').click();
      });
      const polish = await en.page.evaluate(() => {
        const out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('script,style')) out.push(n.nodeValue);
        for (const el of document.querySelectorAll('[title],[placeholder]')) out.push(el.getAttribute('title') || el.getAttribute('placeholder'));
        return out.filter((x) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(x) && !x.includes('Język / Language'));
      });
      if (polish.length) throw new Error(`wersja EN - polskie teksty: ${polish.slice(0, 10).join(' | ')}`);
      assertNoErrors('wersja angielska', en.errors);
      log(`OK wersja angielska: ${await en.page.textContent('#panelTitle')}, ${await en.page.textContent('#sStep')}`);
      await en.context.close();
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
