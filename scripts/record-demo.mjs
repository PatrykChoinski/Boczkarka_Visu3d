// Film prezentacyjny VizuApp (#149): ok. 2 min, Full HD 1920x1080, 30 kl./s - nagrany z wersji statycznej (site/, jak
// GitHub Pages, logowanie demo Serwis) w Chrome / Edge bez okna (playwright-core, karta graficzna), klatki z CDP
// (Page.startScreencast), film skladany przez ffmpeg (libx264). Na filmie podpisy czesci i kursor.
// Proporcje jak w zgloszeniu: ~15 % ustawienia / bazowanie / ruchy reczne, ~50 % pila - programy (Manual, Automat),
// ~30 % frez - automat i G-kod z Madonna, ~5 % polerowanie.
//
//   npm run build:pages
//   node scripts/record-demo.mjs [--out E:\VizuApp_film\VizuApp_prezentacja.mp4] [--ffmpeg ffmpeg]
//   (CHROME_PATH - wlasna przegladarka; domyslnie Chrome, potem Edge)

import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const PORT = 18140;
const W = 1920;
const H = 1080;
const FPS = 30;
const SPEEDS = [1, 2, 5, 10, 30, 100, 500, 1000];

const { values: args } = parseArgs({ options: { out: { type: 'string' }, ffmpeg: { type: 'string' } } });
const OUT = path.resolve(args.out || path.join(ROOT, 'test-results', 'VizuApp_prezentacja.mp4'));
const FFMPEG = args.ffmpeg || 'ffmpeg';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[film] ${msg}`);

function staticServer(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.nc': 'text/plain' };
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function launchBrowser() {
  // karta graficzna (D3D11) - plynny widok 3D w Full HD
  const args = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars'];
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args });
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, headless: true, args }); } catch { /* nastepna */ }
  }
  throw new Error('brak Chrome / Edge (ustaw CHROME_PATH)');
}

// Nakladka filmu: podpis czesci (gora widoku 3D) i kursor (headless nie rysuje kursora)
const OVERLAY_CSS = `
#demoCap { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 99; pointer-events: none;
  background: rgba(16, 32, 52, .88); color: #fff; padding: 10px 26px 12px; border-radius: 12px; text-align: center;
  font: 600 28px "Segoe UI", sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.25); transition: opacity .4s; }
#demoCap small { display: block; font-size: 17px; font-weight: 400; color: #b8d4f0; margin-top: 2px; }
#demoCur { position: fixed; z-index: 100; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; pointer-events: none;
  background: rgba(255, 196, 0, .45); border: 2px solid #f5a300; left: 960px; top: 540px; }
#demoCur.down { background: rgba(255, 120, 0, .75); transform: scale(.8); }`;

async function main() {
  if (!fs.existsSync(path.join(SITE, 'index.html'))) throw new Error('brak site/ - najpierw npm run build:pages');
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'vizu-film-'));
  const server = await staticServer(SITE, PORT);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* jw. */ } });
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.vizu?.state?.cfg);
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(() => {
    for (const id of ['demoCap', 'demoCur']) { const d = document.createElement('div'); d.id = id; document.body.append(d); }
    document.getElementById('demoCap').style.opacity = 0;
    // bez opisow punktow (X / Y) na widoku - przy wielu punktach nachodza na siebie
    const marks = document.getElementById('showMarks');
    if (marks?.checked) { marks.checked = false; marks.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  // --- pomocnicze -------------------------------------------------------------------------------------------
  let cur = { x: W / 2, y: H / 2 };
  const moveTo = async (x, y, ms = 380) => {
    await page.evaluate(([x, y, ms]) => {
      const c = document.getElementById('demoCur');
      c.style.transition = `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out, transform .12s`;
      c.style.left = `${x}px`; c.style.top = `${y}px`;
    }, [x, y, ms]);
    await page.mouse.move(x, y, { steps: 6 });
    cur = { x, y };
    await sleep(ms);
  };
  const box = async (sel) => {
    const el = page.locator(sel).first();
    // bez czekania na "stabilnosc" (strona zajeta liczeniem G-kodu)
    await el.evaluate((e) => e.scrollIntoView({ block: 'nearest' }));
    const b = await el.boundingBox();
    if (!b) throw new Error(`nie widac: ${sel}`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const press = (on) => page.evaluate((on) => document.getElementById('demoCur').classList.toggle('down', on), on);
  const click = async (sel, pause = 250) => {
    const p = await box(sel);
    await moveTo(p.x, p.y);
    await press(true);
    await page.mouse.click(p.x, p.y);
    await sleep(120);
    await press(false);
    await sleep(pause);
  };
  const hold = async (sel, ms) => {
    const p = await box(sel);
    await moveTo(p.x, p.y);
    await press(true);
    await page.mouse.down();
    await sleep(ms);
    await page.mouse.up();
    await press(false);
  };
  const choose = async (sel, value, pause = 300) => {
    const p = await box(sel);
    await moveTo(p.x, p.y);
    await page.selectOption(sel, value);
    await sleep(pause);
  };
  const caption = (title, sub = '') => page.evaluate(([t, s]) => {
    const c = document.getElementById('demoCap');
    c.innerHTML = t ? `${t}${s ? `<small>${s}</small>` : ''}` : '';
    c.style.opacity = t ? 1 : 0;
  }, [title, sub]);
  const tab = (name) => click(`#screens button[data-tab="${name}"]`, 450);
  const running = () => page.evaluate(() => window.vizu.state.sim.running);
  const setSpeed = (v) => page.evaluate((v) => { const s = document.querySelector('#speed'); s.value = String(v); s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  // program trwa najwyzej ~seconds: tempo symulacji dobrane do czasu programu; czekanie do konca programu
  const play = async (startSel, seconds, { maxSpeed = 1000, finish = true, speed: fixed = 0 } = {}) => {
    // tempo z poprzedniego programu - krotki program skonczylby sie przed odczytem czasu
    await setSpeed(1);
    await click(startSel, 150);
    const dur = await page.evaluate(() => window.vizu.state.sim.program?.duration ?? 0);
    const speed = fixed || (SPEEDS.find((s) => dur / s <= seconds * 1.25 && s <= maxSpeed) ?? maxSpeed);
    await setSpeed(speed);
    const t0 = Date.now();
    const limit = finish ? seconds * 1000 + 15000 : seconds * 1000;
    while (await running() && Date.now() - t0 < limit) await sleep(100);
    log(`  ${startSel}: program ${dur.toFixed(0)} s, tempo ${speed}x, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  };
  const home = async (index, seconds = 2.5) => {
    await tab('home');
    await click(`#homeModes button:nth-child(${index + 1})`, 200);
    await play('#homeStart', seconds, { maxSpeed: 30 });
  };

  // --- nagrywanie -----------------------------------------------------------------------------------------------
  const cdp = await page.context().newCDPSession(page);
  const shots = [];
  // ciecie montazowe: klatki z czasu cut = true pomijane, czas filmu bez przerwy
  let cut = false;
  let gap = false;
  let offset = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    if (cut) { gap = true; try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* koniec */ } return; }
    const name = `${String(shots.length).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(frames, name), Buffer.from(f.data, 'base64'));
    if (gap && shots.length) offset += f.metadata.timestamp - offset - shots.at(-1).t - 1 / FPS;
    gap = false;
    shots.push({ name, t: f.metadata.timestamp - offset });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* koniec */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const T0 = Date.now();
  const mark = (name) => log(`${name}: ${((Date.now() - T0) / 1000).toFixed(1)} s`);

  // 1. ustawienia, bazowanie, ruchy reczne (~15 %)
  mark('1. ustawienia');
  await caption('VizuApp – wizualizacja 3D piły mostowej Promasz', 'Symulacja i podgląd maszyny online z PLC (OPC UA)');
  await sleep(1000);
  await click('#loginBtn', 200);
  await choose('#loginUser', 'Serwis', 200);
  await click('#loginForm button[type="submit"]', 300);
  await caption('Ustawienia, bazowanie, ruchy ręczne', 'Logowanie Operator / Serwis / Admin – funkcje jak na maszynie');
  await home(0, 2.5);
  await tab('stone');
  await sleep(1000);
  await click('#manOpen', 400);
  await setSpeed(1);
  await hold('#manWin [data-hmi="jog:x:1"]', 1000);
  await hold('#manWin [data-hmi="jog:y:1"]', 800);
  await hold('#manWin [data-hmi="diag:ld"]', 800);
  await click('#manClose', 200);
  await tab('par');
  await sleep(900);

  // 2. pila - programy automatyczne (~50 %)
  mark('2. pila');
  await caption('Piła – programy', 'Manual: cięcie proste, pasy, łuk, elipsa');
  await tab('cut');
  for (const [op, sec] of [['cut', 4], ['stripes', 8], ['arc', 4.5], ['ellipse', 4]]) {
    await choose('#op', op, 250);
    await click('#clear', 150);
    await play('#cutStart', sec);
  }
  await caption('Piła – Automat', 'Tabela kroków jak ProgramAutoCutST, figury z PLC');
  await tab('auto');
  await choose('#autoKind', 'cut');
  await click('#autoDemo', 300);
  await click('#clear', 150);
  await play('#autoStart', 12);
  await choose('#fig', 'WORKTOP', 300);
  await click('#figFill', 400);
  await click('#clear', 150);
  await play('#autoStart', 10);

  // 3. frez - automat i G-kod z Madonna (~30 %)
  mark('3. frez');
  await caption('Frez – Automat i G-kod', 'Bazowanie w trybie frezu, figury frezu, płaskorzeźba Madonny (G-kod)');
  await home(1, 2.5);
  await tab('auto');
  await choose('#fig', 'SINK_DRAINER', 300);
  await click('#figFill', 300);
  await click('#clear', 150);
  await play('#autoStart', 7, { finish: false, speed: 100 });
  await click('#autoRun .stopBtn', 300);
  await caption('Frez – G-kod CNC', 'Madonna, frez Ø25 – symulacja zdejmowania materiału');
  await tab('cnc');
  await click('#cncExample', 200);
  await page.waitForFunction(() => /madonna/i.test(document.querySelector('#cncName').textContent), null, { timeout: 30000 });
  await sleep(600);
  await play('#cncStart', 8, { finish: false });
  // reszta frezowania poza filmem - film wraca na gotowej plaskorzezbie
  cut = true;
  await page.waitForFunction(() => !window.vizu.state.sim.running, null, { timeout: 600000, polling: 500 });
  await sleep(1500);
  cut = false;
  // gotowa plaskorzezba - podglad z gory w panelu
  await page.evaluate(() => document.querySelector('#cncPreview').scrollIntoView({ block: 'center' }));
  const pv = await box('#cncPreview');
  await moveTo(pv.x, pv.y, 600);
  await sleep(2600);

  // 4. polerowanie (~5 %)
  mark('4. polerowanie');
  await caption('Polerowanie', 'Tryb polerowania – Manual');
  await home(3, 1);
  await tab('cut');
  await play('#cutStart', 2.2, { finish: false });
  await caption('VizuApp', 'Promasz – piła mostowa jednosuportowa');
  await sleep(1000);
  mark('koniec');

  await cdp.send('Page.stopScreencast');
  await sleep(300);
  await browser.close();
  server.close();
  if (errors.length) log(`bledy na stronie: ${errors.join(' | ')}`);

  // klatki o roznych odstepach -> film 30 kl./s (concat z czasami klatek)
  const list = shots.map((s, i) => `file '${s.name}'\nduration ${Math.max(0.001, ((shots[i + 1]?.t ?? s.t + 1 / FPS) - s.t)).toFixed(4)}`);
  fs.writeFileSync(path.join(frames, 'list.txt'), `${list.join('\n')}\nfile '${shots.at(-1).name}'\n`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  log(`klatki: ${shots.length}, ${(shots.at(-1).t - shots[0].t).toFixed(1)} s -> ${OUT}`);
  // -vcodec (nie -c:v) - dziala tez ze starym ffmpeg
  const r = spawnSync(FFMPEG, ['-y', '-f', 'concat', '-i', 'list.txt', '-vf', `fps=${FPS},scale=${W}:${H},format=yuv420p`,
    '-vcodec', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', OUT], { cwd: frames, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg: kod ${r.status} (klatki zostaja w ${frames})`);
  fs.rmSync(frames, { recursive: true, force: true });
  log('gotowe');
}

main().catch((e) => { console.error(e); process.exit(1); });
