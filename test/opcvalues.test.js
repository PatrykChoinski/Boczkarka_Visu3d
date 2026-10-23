// Wartosci z OPC UA (CODESYS): LINT / ULINT jako liczba, tablice LREAL jako zwykle tablice; odczyt w porcjach
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataType, VariantArrayType } from 'node-opcua-client';
import { plainValue, readChunked } from '../src/server/opcua-source.js';

test('LINT / ULINT (para [starsze, mlodsze 32 bity] w node-opcua) jako liczba, np. HMI.iOverallMinutes', () => {
  assert.equal(plainValue({ dataType: DataType.Int64, arrayType: VariantArrayType.Scalar, value: [0, 5] }), 5);
  assert.equal(plainValue({ dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value: [1, 2] }), 4294967298);
  assert.deepEqual(plainValue({ dataType: DataType.Int64, arrayType: VariantArrayType.Array, value: [[0, 1], [0, 2]] }), [1, 2]);
  assert.deepEqual(plainValue({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array([1.5, 2]) }), [1.5, 2]);
  assert.equal(plainValue({ dataType: DataType.Boolean, arrayType: VariantArrayType.Scalar, value: true }), true);
});

test('odczyt w porcjach po MaxNodesPerRead (CODESYS: 100), wyniki w kolejnosci', async () => {
  const calls = [];
  const session = { read: async (nodes) => { calls.push(nodes.length); if (nodes.length > 100) throw new Error('BadTooManyOperations'); return nodes.map((n) => n * 2); } };
  const nodes = Array.from({ length: 438 }, (_, i) => i);
  const out = await readChunked(session, nodes, 100);
  assert.deepEqual(calls, [100, 100, 100, 100, 38]);
  assert.deepEqual(out, nodes.map((n) => n * 2));
});
