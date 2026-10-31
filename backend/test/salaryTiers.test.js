const test = require('node:test'); const assert = require('node:assert/strict');
const { salaryBelowCardMinimum } = require('../services/commission.service');

const tiers = [
  { minimumSalary: 15000, receivable: 1200, payable: 700 },
  { minimumSalary: 8000, receivable: 900, payable: 500 },
];

test('salary-based card: salary under the lowest tier returns that tier minimum', () => {
  assert.equal(salaryBelowCardMinimum(tiers, 6000), 8000);
  assert.equal(salaryBelowCardMinimum(tiers, '7999'), 8000);
});
test('salary-based card: salary at or above the lowest tier passes', () => {
  assert.equal(salaryBelowCardMinimum(tiers, 8000), null);
  assert.equal(salaryBelowCardMinimum(tiers, 20000), null);
});
test('missing salary is not blocked here', () => {
  assert.equal(salaryBelowCardMinimum(tiers, undefined), null);
  assert.equal(salaryBelowCardMinimum(tiers, null), null);
});
test('fixed card (0 or 1 bracket) is never blocked', () => {
  assert.equal(salaryBelowCardMinimum([{ minimumSalary: 15000 }], 5000), null);
  assert.equal(salaryBelowCardMinimum([], 5000), null);
  assert.equal(salaryBelowCardMinimum(undefined, 5000), null);
});
