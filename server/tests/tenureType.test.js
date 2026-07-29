const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTenureType, TENURE_TYPE_OPTIONS } = require('../src/utils/tenureType');

test('normalizes supported tenure options to the requested canonical values', () => {
  assert.equal(normalizeTenureType('A1 temporal permit'), 'A1 temporal permit');
  assert.equal(normalizeTenureType('offer letter'), 'Offer letter');
  assert.equal(normalizeTenureType('Old Resettlement Permit'), 'Old resettlement permit');
  assert.equal(normalizeTenureType('a1 villagized'), 'A1 villagized');
  assert.equal(normalizeTenureType('A2 VILLAGIZED'), 'A2 villagized');
});

test('returns the provided option list', () => {
  assert.deepEqual(TENURE_TYPE_OPTIONS, [
    'A1 temporal permit',
    'Offer letter',
    'Old resettlement permit',
    'A1 villagized',
    'A2 villagized',
  ]);
});
