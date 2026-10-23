// Formularze Manual w trybie PLC (plcforms.js): kazde pole operacji ma zmienna PLC (albo jawnie null), wszystkie zmienne
// i bity START sa na liscie zapisu HMI (hmiwrites.json), przeliczenia zapis / odczyt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLC_OPS, PLC_COMMON, fieldWrites, fieldRead, mapVars, pulseCount } from '../src/shared/plcforms.js';
import { OPS } from '../src/shared/ops.js';
import { toolOpsFor } from '../src/shared/tools.js';
import { COMMON_FIELDS } from '../src/shared/common.js';
import { MILL_COMMON_FIELDS } from '../src/shared/millops.js';

const WRITE = JSON.parse(fs.readFileSync(new URL('../src/server/hmiwrites.json', import.meta.url), 'utf8')).write;
const ALL_OPS = [...OPS, ...['mill', 'drill', 'polishing'].flatMap((m) => toolOpsFor(m))];
const sample = (m) => (m.arr ? [1, 2] : m.flag ? 5 : m.cmd ? Object.keys(m.cmd)[0] : 1);

test('kazda operacja Manual: wszystkie pola (poza bitami serwisowymi) zmapowane, zmienne i START na liscie zapisu HMI', () => {
  for (const op of ALL_OPS) {
    assert.ok(op.id in PLC_OPS, `brak mapy: ${op.id}`);
    const spec = PLC_OPS[op.id];
    if (!spec) continue;
    assert.ok(WRITE[spec.start], `${op.id}: START ${spec.start}`);
    for (const f of op.fields) if (!f.svc) assert.ok(f.k in spec.fields, `${op.id}.${f.k} bez mapy`);
    for (const [k, m] of Object.entries(spec.fields)) {
      assert.ok(op.fields.some((f) => f.k === k), `${op.id}: nieznane pole ${k}`);
      if (!m) continue;
      for (const w of fieldWrites(m, sample(m))) assert.ok(WRITE[w.v], `${op.id}.${k}: ${w.v}`);
      if (m.pulse) assert.ok(WRITE[m.pulse], m.pulse);
    }
    for (const [v] of spec.pre || []) assert.ok(WRITE[v], `${op.id} pre ${v}`);
  }
  for (const [mode, fields] of [['saw', COMMON_FIELDS], ['mill', MILL_COMMON_FIELDS]]) {
    for (const f of fields) if (!f.svc) assert.ok(f.k in PLC_COMMON[mode], `${mode}.${f.k} bez mapy`);
    for (const m of Object.values(PLC_COMMON[mode])) for (const w of fieldWrites(m, sample(m))) assert.ok(WRITE[w.v], w.v);
  }
});

test('przeliczenia: predkosc m/min -> mm/s, lista -> tablica (od 1, "{i}" w sciezce), bit + liczba, polecenie tablicy glebokosci', () => {
  const zVel = PLC_OPS.drill.fields.zVel;
  assert.equal(fieldWrites(zVel, 0.6)[0].value, 10);
  assert.equal(fieldRead(zVel, { 'HMI.fVelocityAxisZDrill': 10 }), 0.6);

  const widths = PLC_OPS.blocks.fields.widths;
  const w = fieldWrites(widths, [400, 300]);
  assert.equal(w.length, 10);
  assert.deepEqual(w.slice(0, 3), [{ v: 'HMI.aManualBlocksWidths[0]', value: 400 }, { v: 'HMI.aManualBlocksWidths[1]', value: 300 }, { v: 'HMI.aManualBlocksWidths[2]', value: 0 }]);
  const vals = Object.fromEntries(w.map((x) => [x.v, x.value]));
  assert.deepEqual(fieldRead(widths, vals), [400, 300], 'odczyt do pierwszego 0 jak GetNumber w PLC');

  const qXY = PLC_OPS.polishing.fields.qXY;
  assert.equal(fieldWrites(qXY, [2])[0].v, 'PolishingGVL.aQueueTools[1].Actions[0]');
  assert.ok(mapVars({ qXY }).includes('PolishingGVL.aQueueTools[10].Actions[0]'));
  assert.equal(fieldWrites(PLC_OPS.polishing.fields.reps, [3])[0].v, 'PolishingGVL.aToolRepetitions[1]');

  const add = PLC_OPS.edges.fields.additional;
  assert.deepEqual(fieldWrites(add, 0), [{ v: 'HMI.bManualAdditionalDistance', value: false }]);
  assert.deepEqual(fieldWrites(add, 25), [{ v: 'HMI.bManualAdditionalDistance', value: true }, { v: 'HMI.fManualAdditionalDistance', value: 25 }]);
  assert.equal(fieldRead(add, { 'HMI.bManualAdditionalDistance': true, 'HMI.fManualAdditionalDistance': 25 }), 25);
  assert.equal(fieldRead(add, { 'HMI.bManualAdditionalDistance': false, 'HMI.fManualAdditionalDistance': 25 }), 0);

  const depth = PLC_COMMON.saw.depthMode;
  assert.deepEqual(fieldWrites(depth, 'step'), [{ v: 'HMI.bCutDepthConstantJumpDist', value: true }]);
  assert.equal(fieldRead(depth, {}), undefined, 'trybu tablicy nie da sie odczytac - zostaje wartosc formularza');
});

test('rodzaj polerowania: impulsy +1 (modulo 4) od wartosci w PLC, pola liczone przez PLC tylko do odczytu', () => {
  const type = PLC_OPS.polishing.fields.type;
  assert.equal(pulseCount(type, 3, { 'PolishingGVL.PolishingType': 1 }), 2);
  assert.equal(pulseCount(type, 0, { 'PolishingGVL.PolishingType': 3 }), 1);
  assert.equal(pulseCount(type, 2, {}), null);
  assert.deepEqual(fieldWrites(type, 2), []);
  assert.deepEqual(fieldWrites(PLC_OPS.millBlocks.fields.xLast, 100), []);
  assert.equal(fieldRead(PLC_OPS.millBlocks.fields.xLast, { 'HMI.fManualBlocksXLastPosition': 812 }), 812);
  assert.equal(PLC_OPS.profile, null, 'profil - w PLC tylko krok programu');
  assert.match(PLC_OPS.millStripes.noStart({ table: true }), /bMillTableStart/);
});
