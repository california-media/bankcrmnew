const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveVatNote } = require('../services/invoicePdf.service');

const DEFAULT = 'Since Silah is a newly established company, our VAT registration is currently under process.';

test('VAT note: admin cleared the box → no note on the invoice', () => {
  assert.equal(resolveVatNote({ vatNote: '' }), '');
});

test('VAT note: admin typed a note → that note', () => {
  assert.equal(resolveVatNote({ vatNote: 'TRN 100000000000003' }), 'TRN 100000000000003');
});

test('VAT note: never set / no settings → old default sentence', () => {
  assert.equal(resolveVatNote({}), DEFAULT);
  assert.equal(resolveVatNote(undefined), DEFAULT);
});
