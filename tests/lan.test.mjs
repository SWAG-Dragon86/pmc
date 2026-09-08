import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { uid } from '../src/model.mjs';
test('LAN HTTP creates unique UUID v4 identifiers without crypto.randomUUID', () => {
  const create = runInNewContext(`(${uid.toString()})`, { crypto: {getRandomValues:webcrypto.getRandomValues.bind(webcrypto)} });
  const values = Array.from({length:1000}, create);
  assert.equal(new Set(values).size,1000);
  for (const value of values) assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
