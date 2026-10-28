// Budowa strony: src/client -> public/ (app.js z three.js w jednym pliku - modul ES, index.html, style.css)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// wersja strony (dolny pasek): package.json + commit + data budowy - strona lokalna i GitHub Pages do porownania
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let commit = 'lokalnie';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* bez git */ }
let dirty = '';
try { dirty = execSync('git status --porcelain -- src', { cwd: root }).toString().trim() ? '+zmiany' : ''; } catch { /* bez git */ }
const BUILD = `v${pkg.version} ${commit}${dirty} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
await build({
  define: { __BUILD__: JSON.stringify(BUILD) },
  entryPoints: [path.join(root, 'src/client/main.js')],
  outfile: path.join(out, 'app.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});
for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, 'src/client', f), path.join(out, f));

console.log(`public/ gotowe (${BUILD})`);
