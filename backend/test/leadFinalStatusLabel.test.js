const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const User = require('../models/User');
const EmployeeStatus = require('../models/EmployeeStatus');
const Notification = require('../models/Notification');
const commissionService = require('../services/commission.service');
const ctrl = require('../controllers/lead.controller');

// When a lead is approved / rejected / disbursed its stage label must follow,
// even if that label is switched off in Lead Status settings. Otherwise the
// lead keeps its old "In Process" / "New Lead" label and shows up under that
// stage filter in the Lead Queue, Pipeline and Reports.
// No DB is touched: model statics/methods are stubbed per test.

const AGENCY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const AGENT = 'dddddddddddddddddddddddd';
const ADMIN = { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', role: 'admin', name: 'Admin' };
const IN_PROCESS = '1111111111111111111111aa';
const NEW_LEAD = '1111111111111111111111bb';
// Live state: these three exist but are switched off.
const SWITCHED_OFF = {
  Approved: '2222222222222222222222aa',
  Rejected: '2222222222222222222222bb',
  Disbursed: '2222222222222222222222cc',
};

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const leadDoc = (extra = {}) => Lead.hydrate({
  _id: '555555555555555555555555',
  leadNumber: 'LD-X-0001',
  customerName: 'Test Customer',
  phone: '971500000000',
  agency: AGENCY,
  agent: AGENT,
  status: 'submitted',
  commissionStatus: 'none',
  employeeStatus: IN_PROCESS,
  statusHistory: [],
  ...extra,
});

// labels: label text -> { _id, isActive }. findOne honours an isActive filter
// the way Mongo would, so a lookup that insists on active labels finds nothing.
function stubDb(t, lead, labels) {
  t.mock.method(Lead, 'findById', async () => lead);
  t.mock.method(Lead, 'findOne', async () => lead);
  t.mock.method(Lead.prototype, 'save', async function save() { return this; });
  t.mock.method(Lead.prototype, 'populate', async function populate() { return this; });
  t.mock.method(User, 'find', () => { const c = { select: () => c, lean: async () => [] }; return c; });
  t.mock.method(Notification, 'insertMany', async (docs) => docs);
  t.mock.method(commissionService, 'recalcOnStatusChange', async (l) => l);
  t.mock.method(commissionService, 'resolveCommissions', async () => ({ receivable: 0, payable: 0 }));
  t.mock.method(EmployeeStatus, 'findById', (id) => {
    const hit = Object.entries(labels).find(([, v]) => v._id === String(id));
    const doc = hit ? { _id: hit[1]._id, label: hit[0] } : null;
    return { select: async () => doc };
  });
  t.mock.method(EmployeeStatus, 'findOne', async (q) => {
    const want = q.label instanceof RegExp ? q.label : new RegExp(`^${q.label}$`);
    const hit = Object.entries(labels).find(([text, v]) => want.test(text) && (q.isActive === undefined || q.isActive === v.isActive));
    return hit ? { _id: hit[1]._id } : null;
  });
}

const withLiveLabels = (overrides = {}) => ({
  'In Process': { _id: IN_PROCESS, isActive: true },
  'New Lead': { _id: NEW_LEAD, isActive: true },
  Approved: { _id: SWITCHED_OFF.Approved, isActive: false },
  Rejected: { _id: SWITCHED_OFF.Rejected, isActive: false },
  Disbursed: { _id: SWITCHED_OFF.Disbursed, isActive: false },
  ...overrides,
});

const setStatus = async (lead, status) => {
  const res = fakeRes();
  await ctrl.updateStatus({ params: { id: String(lead._id) }, body: { status }, user: ADMIN }, res);
  return res;
};

for (const [status, label, from] of [
  ['rejected', 'Rejected', 'submitted'],
  ['approved', 'Approved', 'submitted'],
  ['disbursed', 'Disbursed', 'approved'],
]) {
  test(`${status}: label moves off "In Process" even though "${label}" is switched off`, async (t) => {
    const lead = leadDoc({ status: from });
    stubDb(t, lead, withLiveLabels());
    const res = await setStatus(lead, status);
    assert.equal(res.statusCode, 200);
    assert.equal(lead.status, status);
    assert.equal(String(lead.employeeStatus), SWITCHED_OFF[label]);
  });
}

test('rejected with no "Rejected" label at all: old stage label is cleared, not kept', async (t) => {
  const labels = withLiveLabels();
  delete labels.Rejected;
  const lead = leadDoc();
  stubDb(t, lead, labels);
  await setStatus(lead, 'rejected');
  assert.equal(lead.status, 'rejected');
  assert.equal(lead.employeeStatus, undefined);
});

test('moving to a non-final stage leaves the label alone', async (t) => {
  const lead = leadDoc();
  stubDb(t, lead, withLiveLabels());
  await setStatus(lead, 'under_review');
  assert.equal(lead.status, 'under_review');
  assert.equal(String(lead.employeeStatus), IN_PROCESS);
});

test('bulk import reject: same label rule as the Reject button', async (t) => {
  const lead = leadDoc();
  stubDb(t, lead, withLiveLabels());
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ 'Lead No': 'LD-X-0001', 'Rejected': 'Yes' }]), 'Leads');
  const res = fakeRes();
  await ctrl.importLeads({ user: ADMIN, file: { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) } }, res);
  assert.deepEqual(res.body.failed, []);
  assert.equal(lead.status, 'rejected');
  assert.equal(String(lead.employeeStatus), SWITCHED_OFF.Rejected);
});

test('undo approval with no label left on the lead: goes back to "New Lead"', async (t) => {
  const lead = leadDoc({ status: 'approved', employeeStatus: undefined, statusHistory: [{ status: 'approved' }] });
  stubDb(t, lead, withLiveLabels());
  const res = fakeRes();
  await ctrl.undoApproval({ params: { id: String(lead._id) }, body: {}, user: ADMIN }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(lead.status, 'submitted');
  assert.equal(String(lead.employeeStatus), NEW_LEAD);
});
