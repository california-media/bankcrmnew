const test = require('node:test'); const assert = require('node:assert/strict');
const { withLeadNumber } = require('../utils/leadRedirectUrl');

const lead = { _id: 'abc123', leadNumber: 'LD-944913-0005' };
const base = 'https://www.adcb.com/en/personal/promotions/talabat-card-journey?utm_source=CreditMarket&utm_medium=CPA';

test('{LEAD_NUMBER} is replaced with the lead number', () => {
  assert.equal(withLeadNumber(`${base}&utm_term={LEAD_NUMBER}`, lead), `${base}&utm_term=LD-944913-0005`);
});
test('placeholder is case-insensitive and also matched URL-encoded', () => {
  assert.equal(withLeadNumber(`${base}&utm_term={lead_number}`, lead), `${base}&utm_term=LD-944913-0005`);
  assert.equal(withLeadNumber(`${base}&utm_term=%7BLEAD_NUMBER%7D`, lead), `${base}&utm_term=LD-944913-0005`);
});
test('links without the placeholder are returned unchanged', () => {
  assert.equal(withLeadNumber(`${base}&utm_term=CBG`, lead), `${base}&utm_term=CBG`);
});
test('falls back to the lead id when there is no lead number', () => {
  assert.equal(withLeadNumber(`${base}&utm_term={LEAD_NUMBER}`, { _id: 'abc123' }), `${base}&utm_term=abc123`);
});
test('no redirect url stays empty', () => {
  assert.equal(withLeadNumber(null, lead), null);
  assert.equal(withLeadNumber('', lead), '');
});
