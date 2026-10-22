import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_PAGES, SERVICE_SCREEN_VARS } from '../src/shared/servicescreens.js';
import { VARIABLES, plcKey } from '../src/shared/config.js';
import { SERVICE_BITS } from '../src/shared/service.js';

test('ekrany serwisowe (#147): 3 strony jak w HMI, zmienne i bity z typami, kazda zmienna czytana z PLC', () => {
  assert.deepEqual(SERVICE_PAGES.map((p) => p.id), ['main', 'area', 'settings']);
  const items = SERVICE_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items));
  assert.ok(items.length >= 110);
  const bits = SERVICE_PAGES.find((p) => p.id === 'settings').groups.flatMap((g) => g.items).filter((it) => it.k === 'bit');
  assert.equal(bits.length, 42);
  for (const it of items) {
    if (!it.v) continue;
    assert.ok(SERVICE_SCREEN_VARS[it.v], `${it.v}: brak typu`);
    assert.ok(plcKey(it.v), `${it.v}: brak w VARIABLES (odczyt OPC UA)`);
    if (it.k === 'bit') assert.equal(it.t, 'BOOL', it.v);
    if (it.k === 'num' && it.min !== undefined && it.max !== undefined) assert.ok(it.min <= it.max, it.v);
  }
  // bity Visu3D (Ustawienia -> Serwis) sa tez na ekranie ustawien serwisowych albo w innych programach HMI
  const onScreens = new Set(items.map((it) => it.v));
  assert.ok(SERVICE_BITS.filter((b) => onScreens.has(`HMI.${b.k}`)).length >= 8);
  // przejscia do stron serwisu i ekranow Visu3D
  const gotos = items.filter((it) => it.k === 'goto');
  assert.ok(gotos.some((g) => g.page === 'area') && gotos.some((g) => g.page === 'settings') && gotos.some((g) => g.tab === 'stone'));
  // predkosci max w HMI w m/min (mm/s * 0,06)
  assert.equal(items.find((it) => it.v === 'HMI.fParameterMaxSawVelocity').unit, 'm/min');
  assert.ok(Object.keys(VARIABLES).filter((k) => k.startsWith('hmi:')).length >= 80);
});
