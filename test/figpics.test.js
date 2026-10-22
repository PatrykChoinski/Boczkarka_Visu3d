// #138 Rysunki pogladowe figur automatu: kazda figura ma rysunek, pliki istnieja, litery jak na ekranach HMI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURES } from '../src/shared/figures/index.js';
import { defaults } from '../src/shared/ops.js';
import { FIGURE_PICS, figurePicture, fieldLetter, labelVar } from '../src/shared/figpics.js';

const CLIENT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client');
const exists = (rel) => fs.existsSync(path.join(CLIENT, rel));

test('kazda figura automatu ma rysunek (obrazek z HMI albo schemat SVG) i pliki obrazkow istnieja', () => {
  for (const fig of FIGURES) {
    const pic = figurePicture(fig.id, defaults(fig.fields));
    assert.ok(pic, `brak rysunku: ${fig.id}`);
    assert.ok(pic.img || pic.svg || pic.roof, fig.id);
    if (pic.img) assert.ok(exists(pic.img), `brak pliku ${pic.img}`);
    if (pic.svg) assert.match(pic.svg, /^<svg[\s\S]*<\/svg>$/);
    if (pic.roof) for (const r of pic.roof) for (const on of [0, 1]) assert.ok(exists(`img/figures/roof_wall${r.wall}_${on}.png`));
  }
  assert.equal(Object.keys(FIGURE_PICS).filter((id) => !FIGURES.some((f) => f.id === id)).length, 0, 'rysunki dla nieistniejacych figur');
});

test('litery: kazda zmienna z ekranu HMI odpowiada polu figury, X / Y przy punkcie startowym', () => {
  for (const fig of FIGURES) {
    const vars = fig.fields.map((f) => labelVar(f.label)).filter(Boolean);
    for (const v of Object.keys(FIGURE_PICS[fig.id].letters)) assert.ok(vars.includes(v), `${fig.id}: brak pola ze zmienna ${v}`);
    const letters = fig.fields.map((f) => fieldLetter(fig.id, f)).filter(Boolean);
    assert.ok(letters.length > 0, `${fig.id}: brak liter`);
  }
  const rect = FIGURES.find((f) => f.id === 'RECTANGLE');
  // ostatnie pole - rodzaj ciecia (iManualInternal), bez litery
  assert.deepEqual(rect.fields.map((f) => fieldLetter('RECTANGLE', f)), ['X', 'Y', 'A', 'B', null, null]);
  const cross = FIGURES.find((f) => f.id === 'CROSS');
  assert.equal(fieldLetter('CROSS', cross.fields.find((f) => f.k === 'width2')), 'W');
});

test('warianty obrazka wg przelacznika jak w HMI: typ trapezu, blatu, ksiazki, cwiercwalka, sciany daszkow', () => {
  const opts = (id, k) => FIGURES.find((f) => f.id === id).fields.find((f) => f.k === k).o.map(([v]) => v);
  for (const [id, k, prefix] of [['TRAPEZOID', 'type', 'trapezoid'], ['WORKTOP', 'type', 'worktop'], ['BOOKS', 'bookType', 'book'], ['QUATER_ROUND', 'quaterType', 'quater_round']]) {
    const seen = new Set();
    for (const v of opts(id, k)) {
      const pic = figurePicture(id, { [k]: v });
      assert.equal(pic.img, `img/figures/${prefix}_${v}.png`);
      assert.ok(exists(pic.img));
      seen.add(pic.img);
    }
    assert.equal(seen.size, opts(id, k).length, `${id}: rozne obrazki dla roznych typow`);
  }
  const roof = figurePicture('ROOFS', { wall1: true, wall2: false, wall3: true, wall4: false });
  assert.deepEqual(roof.roof.map((r) => [r.wall, r.on]), [[1, true], [2, false], [3, true], [4, false]]);
});
