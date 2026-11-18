const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const EmployeeStatus = require('../models/EmployeeStatus');

// Every lead that comes in as a New Lead gets the "New Lead" stage label,
// whichever way it was created (website apply form, referral form, a draft
// being submitted, bulk import...). Without it the lead never shows under the
// "New Lead" stage filter in the Lead Queue, Pipeline or Reports.
// No DB is touched: the collection write and the label lookup are stubbed.

const NEW_LEAD = '1111111111111111111111bb';
const IN_PROCESS = '1111111111111111111111aa';

function stubDb(t, { newLeadLabel = { _id: NEW_LEAD } } = {}) {
  const seen = { lookups: [] };
  t.mock.method(EmployeeStatus, 'findOne', async (q, _proj, opts) => {
    seen.lookups.push({ q, opts });
    return q.statusType === 'lead_label' && String(q.label) === '/^new lead$/i' ? newLeadLabel : null;
  });
  t.mock.method(Lead.collection, 'insertOne', async () => ({ acknowledged: true }));
  t.mock.method(Lead.collection, 'updateOne', async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
  return seen;
}

const newLead = (extra = {}) => new Lead({
  customerName: 'Web Apply Customer',
  phone: '971500000000',
  productType: 'loan',
  source: 'web_apply',
  status: 'submitted',
  ...extra,
});

test('new lead from the website form gets the "New Lead" label', async (t) => {
  const seen = stubDb(t);
  const lead = newLead();
  await lead.save();
  assert.equal(String(lead.employeeStatus), NEW_LEAD);
  // Found even if the label is switched off in settings (active one preferred)
  assert.equal(seen.lookups[0].q.isActive, undefined);
  assert.deepEqual(seen.lookups[0].opts, { sort: { isActive: -1 } });
});

test('a label already chosen is kept', async (t) => {
  stubDb(t);
  const lead = newLead({ employeeStatus: IN_PROCESS });
  await lead.save();
  assert.equal(String(lead.employeeStatus), IN_PROCESS);
});

test('a draft gets no label until it is submitted', async (t) => {
  stubDb(t);
  const lead = newLead({ status: 'draft', isReferral: true, source: 'manual' });
  await lead.save();
  assert.equal(lead.employeeStatus, undefined);

  lead.status = 'submitted';
  await lead.save();
  assert.equal(String(lead.employeeStatus), NEW_LEAD);
});

test('label cleared by hand on an existing new lead is not put back on the next save', async (t) => {
  stubDb(t);
  const lead = Lead.hydrate({ _id: '555555555555555555555555', customerName: 'X', phone: '971500000000', status: 'submitted' });
  lead.customerName = 'Y';
  await lead.save();
  assert.equal(lead.employeeStatus, undefined);
});

test('no "New Lead" label exists at all: lead still saves, just without a label', async (t) => {
  stubDb(t, { newLeadLabel: null });
  const lead = newLead();
  await lead.save();
  assert.equal(lead.employeeStatus, undefined);
});
