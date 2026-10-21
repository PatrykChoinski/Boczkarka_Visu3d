import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_BITS, SERVICE_GROUPS, serviceDefaults } from '../src/shared/service.js';
import { OPS, COMMON_FIELDS } from '../src/shared/ops.js';
import { TOOL_OPS } from '../src/shared/tools.js';
import { MILL_COMMON_FIELDS } from '../src/shared/millops.js';
import { FIGURE_CONTEXT_FIELDS } from '../src/shared/figures/index.js';

test('bity serwisowe: kazde pole z svc ma bit na ekranie Ustawienia, bity HMI.bService..., domyslne jak pola', () => {
  const bits = new Map(SERVICE_BITS.map((b) => [b.k, b]));
  const fields = [...COMMON_FIELDS, ...MILL_COMMON_FIELDS, ...FIGURE_CONTEXT_FIELDS, ...[...OPS, ...TOOL_OPS].flatMap((o) => o.fields)];
  const svc = fields.filter((f) => f.svc);
  assert.ok(svc.length >= 9);
  for (const f of svc) {
    assert.ok(bits.has(f.svc), `${f.k}: brak bitu ${f.svc}`);
    assert.equal(f.t, 'bool');
    assert.equal(Boolean(f.d), bits.get(f.svc).d, `${f.k}: domyslna inna niz ${f.svc}`);
  }
  for (const b of SERVICE_BITS) {
    assert.match(b.k, /^bService[A-Z]/);
    assert.ok(SERVICE_GROUPS[b.group], b.k);
  }
  assert.equal(Object.keys(serviceDefaults()).length, SERVICE_BITS.length);
});
