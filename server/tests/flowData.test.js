const test = require('node:test');
const assert = require('node:assert');

const {
  getWebhookValue,
  getWebhookMessage,
  normalizeFlowFieldName,
  normalizeFlowData,
  extractSubmissionFields,
  extractContactWaId,
} = require('../src/utils/flowData');

test('getWebhookValue and getWebhookMessage traverse the standard payload shape', () => {
  const message = { type: 'text', text: { body: 'hi' } };
  const payload = { entry: [{ changes: [{ value: { messages: [message] } }] }] };
  assert.deepStrictEqual(getWebhookValue(payload), { messages: [message] });
  assert.strictEqual(getWebhookMessage(payload), message);
  assert.strictEqual(getWebhookMessage({}), undefined);
  assert.strictEqual(getWebhookMessage(null), undefined);
});

test('normalizeFlowFieldName lowercases and collapses separators', () => {
  assert.strictEqual(normalizeFlowFieldName(' Plot-Farm Number '), 'plot_farm_number');
  assert.strictEqual(normalizeFlowFieldName('Plot (Farm) Number'), 'plot_farm_number');
  assert.strictEqual(normalizeFlowFieldName('firstName'), 'firstname');
  assert.strictEqual(normalizeFlowFieldName(null), '');
  assert.strictEqual(normalizeFlowFieldName(undefined), '');
});

test('normalizeFlowData flattens array payloads keyed by name/id/field', () => {
  const data = normalizeFlowData([
    { name: 'plot_number', value: '123' },
    { id: 'first_name', text: 'Jane' },
    { field: 'last_name', value: { text: 'Doe' } },
    null,
    'not-an-object',
  ]);
  assert.deepStrictEqual(data, {
    plot_number: '123',
    first_name: 'Jane',
    last_name: 'Doe',
  });
});

test('normalizeFlowData unwraps nested fields and field_data', () => {
  assert.deepStrictEqual(
    normalizeFlowData({ fields: [{ name: 'province', value: 'Lusaka' }] }),
    { province: 'Lusaka' }
  );
  assert.deepStrictEqual(
    normalizeFlowData({ field_data: [{ name: 'district', value: 'Chongwe' }] }),
    { district: 'Chongwe' }
  );
});

test('normalizeFlowData with normalizeKeys collapses object keys', () => {
  const data = normalizeFlowData(
    { 'Plot Number': '45', firstName: 'Ann' },
    { normalizeKeys: true }
  );
  assert.deepStrictEqual(data, { plot_number: '45', firstname: 'Ann' });
});

test('normalizeFlowData returns empty object for non-object input', () => {
  assert.deepStrictEqual(normalizeFlowData(null), {});
  assert.deepStrictEqual(normalizeFlowData('text'), {});
  assert.deepStrictEqual(normalizeFlowData(42), {});
});

test('extractSubmissionFields resolves snake_case, camelCase, and collapsed aliases', () => {
  const snake = extractSubmissionFields({
    plot_number: 'P1',
    first_name: 'Jane',
    last_name: 'Doe',
    national_id: 'NID1',
    province: 'Lusaka',
    district: 'Chongwe',
    tenure_type: 'Leasehold',
  });
  assert.strictEqual(snake.plot_number, 'P1');
  assert.strictEqual(snake.first_name, 'Jane');
  assert.strictEqual(snake.last_name, 'Doe');
  assert.strictEqual(snake.national_id, 'NID1');
  assert.strictEqual(snake.province, 'Lusaka');
  assert.strictEqual(snake.district, 'Chongwe');

  const camel = extractSubmissionFields({
    plotNumber: 'P2',
    firstName: 'John',
    lastName: 'Smith',
    nationalId: 'NID2',
  });
  assert.strictEqual(camel.plot_number, 'P2');
  assert.strictEqual(camel.first_name, 'John');
  assert.strictEqual(camel.last_name, 'Smith');
  assert.strictEqual(camel.national_id, 'NID2');

  const collapsed = extractSubmissionFields({
    plotnumber: 'P3',
    firstname: 'Amy',
    lastname: 'Lee',
    nationalid: 'NID3',
  });
  assert.strictEqual(collapsed.plot_number, 'P3');
  assert.strictEqual(collapsed.first_name, 'Amy');
  assert.strictEqual(collapsed.last_name, 'Lee');
  assert.strictEqual(collapsed.national_id, 'NID3');
});

test('extractSubmissionFields checks values nested under fields', () => {
  const fields = extractSubmissionFields({
    fields: { plot_number: 'P9', first_name: 'Nested' },
  });
  assert.strictEqual(fields.plot_number, 'P9');
  assert.strictEqual(fields.first_name, 'Nested');
});

test('extractSubmissionFields normalizes tenure type values', () => {
  const fields = extractSubmissionFields({ tenure_type: 'offer letter' });
  assert.strictEqual(fields.tenure_type, 'Offer letter');
});

test('extractSubmissionFields returns nulls for missing fields', () => {
  const fields = extractSubmissionFields({});
  assert.strictEqual(fields.plot_number, null);
  assert.strictEqual(fields.first_name, null);
  assert.strictEqual(fields.tenure_type, null);
});

test('extractContactWaId resolves wa_id and phone aliases', () => {
  assert.strictEqual(extractContactWaId({ wa_id: '26097' }), '26097');
  assert.strictEqual(extractContactWaId({ phone: '26098' }), '26098');
  assert.strictEqual(extractContactWaId({ phone_number: '26099' }), '26099');
  assert.strictEqual(extractContactWaId({ fields: { wa_id: '26095' } }), '26095');
  assert.strictEqual(extractContactWaId({}), null);
});
