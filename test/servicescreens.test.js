import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_PAGES, SERVICE_SCREEN_VARS } from '../src/shared/servicescreens.js';
import { VARIABLES, plcKey } from '../src/shared/config.js';
import { SERVICE_BITS } from '../src/shared/service.js';

test('ekrany serwisowe: serwis HMI i wszystkie ekrany z niego otwierane, zmienne z typami, kazda czytana z PLC', () => {
  assert.deepEqual(SERVICE_PAGES.slice(0, 3).map((p) => p.id), ['main', 'area', 'settings']);
  // brakujace ekrany: frez CD, polerowanie, servo, receptury, falowniki, predkosci, wejscia / wyjscia, skalowanie, pomiar, stol frezu
  for (const id of ['cd', 'polishing', 'servo', 'files', 'drives', 'speeds', 'io', 'ioPolish', 'scaling', 'toolMeasure', 'millTable']) {
    assert.ok(SERVICE_PAGES.some((p) => p.id === id), id);
  }
  assert.ok(new Set(SERVICE_PAGES.map((p) => p.id)).size === SERVICE_PAGES.length);
  const items = SERVICE_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items));
  assert.ok(items.length >= 400);
  const bits = SERVICE_PAGES.find((p) => p.id === 'settings').groups.flatMap((g) => g.items).filter((it) => it.k === 'bit');
  assert.equal(bits.length, 42);
  for (const it of items) {
    if (!it.v) continue;
    const base = it.v.replace(/\[\d+\]$/, '');
    assert.ok(SERVICE_SCREEN_VARS[base], `${it.v}: brak typu`);
    assert.ok(plcKey(base), `${it.v}: brak w VARIABLES (odczyt OPC UA)`);
    if (it.k === 'bit') assert.equal(it.t, 'BOOL', it.v);
    if (it.k === 'num' && it.min !== undefined && it.max !== undefined) assert.ok(it.min <= it.max, it.v);
  }
  // bity Visu3D (Ustawienia -> Serwis) sa tez na ekranie ustawien serwisowych albo w innych programach HMI
  const onScreens = new Set(items.map((it) => it.v));
  assert.ok(SERVICE_BITS.filter((b) => onScreens.has(`HMI.${b.k}`)).length >= 8);
  // przejscia do stron serwisu i ekranow Visu3D - kazde przejscie ze strony serwisu na istniejaca strone
  const gotos = items.filter((it) => it.k === 'goto');
  for (const g of gotos) if (g.page) assert.ok(SERVICE_PAGES.some((p) => p.id === g.page), g.page);
  assert.ok(gotos.some((g) => g.page === 'area') && gotos.some((g) => g.page === 'settings') && gotos.some((g) => g.tab === 'stone'));
  // predkosci max w HMI w m/min (mm/s * 0,06)
  assert.equal(items.find((it) => it.v === 'HMI.fParameterMaxSawVelocity').unit, 'm/min');
  assert.ok(Object.keys(VARIABLES).filter((k) => k.startsWith('hmi:')).length >= 300);
  // tablica stolu frezu czytana w calosci
  assert.equal(SERVICE_SCREEN_VARS['HMI.aMillingBoardX'], 'ARRAY');
});
