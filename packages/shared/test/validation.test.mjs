import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/cjs/index.js');

test('ESM and CJS builds expose identical ErrorCodes and validators', () => {
  assert.equal(esm.ErrorCodes.SIM_DUPLICATE_ICCID, cjs.ErrorCodes.SIM_DUPLICATE_ICCID);
  assert.equal(
    esm.ERROR_CODE_I18N_MAP[esm.ErrorCodes.SIM_DUPLICATE_ICCID],
    'errors.codes.SIM_DUPLICATE_ICCID',
  );
});

test('normalizeEmail trims and lowercases input', () => {
  assert.equal(esm.normalizeEmail('  Admin.User@Example.COM '), 'admin.user@example.com');
  assert.equal(cjs.normalizeEmail('  Admin.User@Example.COM '), 'admin.user@example.com');
});

test('normalizeIccid strips all whitespace and validates 10-30 digits', () => {
  assert.equal(esm.normalizeIccid('8938 7000 0000 0000 001'), '8938700000000000001');
  assert.equal(esm.isValidIccid('8938 7000 0000 0000 001'), true);
  assert.equal(esm.isValidIccid('12345'), false);
  assert.equal(esm.isValidIccid('893870000000000000A'), false);
});

test('normalizePhoneNumber strips separators', () => {
  assert.equal(esm.normalizePhoneNumber('+387 (61) 123-456/7'), '+387611234567');
});

test('isValidIpv4 validates dotted quads strictly', () => {
  assert.equal(esm.isValidIpv4('10.10.0.1'), true);
  assert.equal(esm.isValidIpv4('256.0.0.1'), false);
  assert.equal(esm.isValidIpv4('10.10.0'), false);
});

test('validateMeterSerialLength checks optional expectedLength strictly', () => {
  assert.deepEqual(esm.validateMeterSerialLength('12345678', null), {
    valid: true,
    actualLength: 8,
    expectedLength: null,
  });
  assert.deepEqual(esm.validateMeterSerialLength(' 12345678 ', 8), {
    valid: true,
    actualLength: 8,
    expectedLength: 8,
  });
  assert.deepEqual(cjs.validateMeterSerialLength('1234567', 8), {
    valid: false,
    actualLength: 7,
    expectedLength: 8,
  });
});
