// Budowa strony: src/client -> public/ (app.js z three.js w jednym pliku, index.html, style.css, img/)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src/client/main.js')],
  outfile: path.join(out, 'app.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});
for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, 'src/client', f), path.join(out, f));
// obrazki (rysunki figur z HMI - #138)
fs.cpSync(path.join(root, 'src/client/img'), path.join(out, 'img'), { recursive: true });
console.log('public/ gotowe');
