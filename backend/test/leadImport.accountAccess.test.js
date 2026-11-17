const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const User = require('../models/User');
const EmployeeStatus = require('../models/EmployeeStatus');
const Notification = require('../models/Notification');
const commissionService = require('../services/commission.service');
const router = require('../routes/lead.routes');
const ctrl = require('../controllers/lead.controller');

// No DB is touched: model statics are stubbed per test (t.mock.method restores them).
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

const importGate = () => {
  const layer = router.stack.find((l) => l.route?.path === '/import' && l.route.methods.post);
  return layer.route.stack[0].handle;
};

const runGate = (user) => {
  const res = fakeRes();
  let passed = false;
  importGate()({ user }, res, () => { passed = true; });
  return { passed, res };
};

const xlsxFile = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Leads');
  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
};

const AGENCY_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_AGENCY_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ACCOUNT_USER = { _id: 'cccccccccccccccccccccccc', role: 'employee', employeeType: 'account', agency: AGENCY_ID };

test('import gate: Account Access employee may import', () => {
  assert.equal(runGate(ACCOUNT_USER).passed, true);
});

test('import gate: Coordinator and agency owner still allowed', () => {
  assert.equal(runGate({ role: 'employee', employeeType: 'coordinator', agency: AGENCY_ID }).passed, true);
  assert.equal(runGate({ role: 'agency', _id: AGENCY_ID }).passed, true);
});

test('import gate: CPV/Sales employees and agents still forbidden', () => {
  for (const user of [{ role: 'employee', employeeType: 'cpv' }, { role: 'employee', employeeType: 'sales' }, { role: 'agent' }]) {
    const { passed, res } = runGate(user);
    assert.equal(passed, false, JSON.stringify(user));
    assert.equal(res.statusCode, 403);
  }
});

test('import: Account Access is limited to its own agency leads', async (t) => {
  const lead = (no, agency) => Lead.hydrate({ _id: no === 'LD-OWN-0001' ? '111111111111111111111111' : '222222222222222222222222', leadNumber: no, agency, customerName: 'X', status: 'submitted', commissionStatus: 'none' });
  const leads = { 'LD-OWN-0001': lead('LD-OWN-0001', AGENCY_ID), 'LD-OTHER-0001': lead('LD-OTHER-0001', OTHER_AGENCY_ID) };
  t.mock.method(Lead, 'findOne', async (q) => leads[q.leadNumber] || null);
  const saved = [];
  t.mock.method(Lead.prototype, 'save', async function save() { saved.push(this); return this; });
  t.mock.method(commissionService, 'recalcOnStatusChange', async (l) => l);
  t.mock.method(EmployeeStatus, 'findOne', async () => null);
  t.mock.method(Notification, 'insertMany', async (d) => d);
  // No admins / agencies in the stubbed DB → notifications are no-ops.
  t.mock.method(User, 'find', () => { const c = { select: () => c, lean: async () => [] }; return c; });

  const res = fakeRes();
  await ctrl.importLeads({
    user: ACCOUNT_USER,
    file: xlsxFile([
      { 'Lead No': 'LD-OWN-0001', Phone: '971501234567', Status: 'Approved' },
      { 'Lead No': 'LD-OTHER-0001', Phone: '971501234567', Status: 'Approved' },
    ]),
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updated, 1);
  assert.deepEqual(res.body.failed, [{ row: 3, reason: 'Lead No "LD-OTHER-0001" does not belong to your agency' }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].leadNumber, 'LD-OWN-0001');
  assert.equal(saved[0].status, 'approved');
  assert.equal(String(saved[0].agency), AGENCY_ID);
  assert.equal(leads['LD-OTHER-0001'].status, 'submitted');
});
