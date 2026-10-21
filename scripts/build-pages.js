// Wersja statyczna na GitHub Pages: strona z public/ + plik api/config (konfiguracja jak z serwera, static: true),
// bez serwera VizuApp - tylko tryb offline (symulacja). Wynik w site/ (workflow .github/workflows/pages.yml).
//
//   node scripts/build-pages.js            potem np.: npx http-server site   albo   python -m http.server -d site

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, clientConfig } from '../src/server/main.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site');

await import('./build-client.js');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
// konfiguracja z config.json repo (bez hasel - clientConfig ich nie podaje), bez PLC
const cfg = { ...clientConfig(loadConfig(path.join(root, 'config.json')), false), static: true };
fs.mkdirSync(path.join(out, 'api'), { recursive: true });
fs.writeFileSync(path.join(out, 'api', 'config'), JSON.stringify(cfg));
// bez Jekylla - pliki jak sa
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('site/ gotowe (GitHub Pages, tylko offline)');
