// Rodzaj ciecia na ekranach figur jak w HMI (ComboBox -> HMI.iManualInternal: Zewnetrzne / Wewnetrzne)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURES, FIGURE_INTERNAL, figureContext } from '../src/shared/figures/index.js';
import { defaults } from '../src/shared/ops.js';
import { machine } from '../src/shared/geometry.js';
import { DEFAULTS } from '../src/shared/config.js';

// ekrany figur z lista iManualInternal w projekcie HMI (dpa.py find iManualInternal)
const HMI_FIGURES = ['RECTANGLE', 'TRIANGLE_RECT', 'TRIANGLE_EQUAL', 'TRIANGLE_ISOS', 'RECTANGLE_CUTTED', 'RECTANGLE_CORNERS', 'ROOFS',
  'ELIPSE_ONE_POINT', 'ELIPSE_120_POINT', 'TRAPEZOID', 'L_CORNERS', 'CROSS', 'TRAPEZOID45', 'HEART', 'POLYGON'];

test('figury z wyborem rodzaju ciecia jak w HMI (pila i frez), pozostale bez', () => {
  assert.deepEqual(FIGURE_INTERNAL, [[0, 'Zewnętrzne'], [1, 'Wewnętrzne']]);
  for (const f of FIGURES) {
    const field = f.fields.find((x) => x.k === 'internal');
    assert.equal(Boolean(field), HMI_FIGURES.includes(f.id), f.id);
    if (field) assert.equal(field.d, 0);
  }
  assert.ok(FIGURES.some((f) => f.kind === 'mill' && f.fields.some((x) => x.k === 'internal')), 'frez');
  assert.ok(FIGURES.some((f) => f.kind === 'cut' && f.fields.some((x) => x.k === 'internal')), 'pila');
});

test('rodzaj ciecia z formularza figury zmienia bufor (iInner bloku figury)', () => {
  for (const [id, mode] of [['RECTANGLE', 'saw'], ['TRIANGLE_RECT', 'saw'], ['RECTANGLE_CUTTED', 'mill'], ['HEART', 'mill']]) {
    const f = FIGURES.find((x) => x.id === id);
    const m = machine({ ...DEFAULTS.offline.machine, mode });
    const ctx = figureContext({ internal: 0 }, m, {});
    const v = defaults(f.fields);
    const outer = f.build({ ...v, internal: 0 }, ctx);
    const inner = f.build({ ...v, internal: 1 }, ctx);
    assert.notDeepEqual(inner.rows, outer.rows, `${id}: wewnetrzne inne niz zewnetrzne`);
    // pole formularza ma pierwszenstwo przed kontekstem (Parametry figury)
    assert.deepEqual(f.build({ ...v, internal: 1 }, { ...ctx, internal: 0 }).rows, inner.rows);
  }
});
