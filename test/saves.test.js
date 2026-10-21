import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPS, savedPosition } from '../src/shared/ops.js';
import { TOOL_OPS } from '../src/shared/tools.js';

test('Zapisz (#139): kazda operacja ma przyciski punktow na istniejacych polach X / Y', () => {
  for (const op of [...OPS, ...TOOL_OPS]) {
    if (op.here) continue;                // DrillSimpleST - w aktualnej pozycji, bez punktow
    assert.ok(op.saves?.length, `${op.id}: brak przyciskow Zapisz`);
    const keys = new Set(op.fields.map((f) => f.k));
    for (const sv of op.saves) {
      if (sv.z) { assert.ok(keys.has(sv.z), `${op.id}: ${sv.z}`); continue; }   // sam Z (bSaveZ)
      assert.ok(keys.has(sv.x) && keys.has(sv.y), `${op.id}: ${sv.x} / ${sv.y}`);
      assert.ok(sv.name);
      // pole Y zapisywanego punktu jest za polem X (przycisk renderowany za polem Y)
      assert.ok(op.fields.findIndex((f) => f.k === sv.y) > op.fields.findIndex((f) => f.k === sv.x), `${op.id}: kolejnosc ${sv.x} / ${sv.y}`);
    }
  }
  // poczatek i koniec ciecia prostego jak w PLC
  assert.deepEqual(OPS.find((o) => o.id === 'cut').saves.map((s) => [s.x, s.y]), [['x0', 'y0'], ['x1', 'y1']]);
});

test('Zapisz: pozycja osi zaokraglona do 0,01 mm jak TO_REAL(TO_DINT(fXActualPosition*100))/100.0', () => {
  assert.equal(savedPosition(1234.5678), 1234.57);
  assert.equal(savedPosition(-10.004), -10);
  assert.equal(savedPosition(0.125), 0.13);
});
