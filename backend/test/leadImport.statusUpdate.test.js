const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const EmployeeStatus = require('../models/EmployeeStatus');
const Notification = require('../models/Notification');
const commissionService = require('../services/commission.service');
const ctrl = require('../controllers/lead.controller');

// Bulk import used to update lead statuses (export → edit → import).
// No DB is touched: model statics/methods are stubbed per test.

const AGENCY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const AGENT = 'dddddddddddddddddddddddd';
const ACCOUNT_USER = { _id: 'cccccccccccccccccccccccc', role: 'employee', employeeType: 'account', agency: AGENCY, name: 'Murali' };
const ADMIN = { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', role: 'admin', name: 'Admin' };
const APPROVED_LABEL = '0123456789abcdef01234567';

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const xlsxFile = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Leads');
  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
};
const leadDoc = (leadNumber, extra = {}) => Lead.hydrate({
  _id: `5${leadNumber.replace(/\D/g, '').padStart(23, '0')}`,
  leadNumber,
  customerName: 'Claire Aceberos',
  phone: '971523986818',
  agency: AGENCY,
  agent: AGENT,
  status: 'submitted',
  commissionStatus: 'none',
  statusHistory: [],
  ...extra,
});

function stubDb(t, leads) {
  const byNo = Object.fromEntries(leads.map((l) => [l.leadNumber, l]));
  const seen = { saved: [], recalc: [], notifications: [] };
  t.mock.method(Lead, 'findOne', async (q) => byNo[q.leadNumber] || null);
  t.mock.method(Lead, 'findByIdAndUpdate', async () => { throw new Error('import must save through the document'); });
  t.mock.method(Lead.prototype, 'save', async function save() { seen.saved.push(this); return this; });
  t.mock.method(User, 'find', () => { const c = { select: () => c, lean: async () => [] }; return c; });
  t.mock.method(Notification, 'insertMany', async (docs) => { seen.notifications.push(...docs); return docs; });
  t.mock.method(EmployeeStatus, 'findOne', async (q) => (String(q.label) === 'Approved' || String(q.label) === '/^Approved$/i' ? { _id: APPROVED_LABEL } : null));
  // Same effect as the real recalc for the fields these tests check.
  t.mock.method(commissionService, 'recalcOnStatusChange', async (lead) => {
    seen.recalc.push(lead.status);
    if (lead.status === 'approved' && lead.commissionStatus === 'none') lead.commissionStatus = 'pending';
    if (lead.status === 'rejected') { lead.commission = 0; lead.grossCommission = 0; lead.commissionStatus = 'none'; }
    return lead;
  });
  return seen;
}

const runImport = async (user, rows) => {
  const res = fakeRes();
  await ctrl.importLeads({ user, file: xlsxFile(rows) }, res);
  return res;
};

test('status-only sheet (Lead No + Lead Status): no phone needed, name not overwritten', async (t) => {
  const lead = leadDoc('LD-1');
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-1', 'Lead Status': 'Approved' }]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.failed, []);
  assert.equal(res.body.updated, 1);
  assert.equal(seen.saved.length, 1);
  assert.equal(lead.customerName, 'Claire Aceberos');
  assert.equal(lead.phone, '971523986818');
});

test('approve via import = same as Approve button: history, commission locked, label, agent notified', async (t) => {
  const lead = leadDoc('LD-2');
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-2', 'Lead Status': 'approved' }]);
  assert.deepEqual(res.body.failed, []);
  assert.equal(lead.status, 'approved');
  assert.deepEqual(seen.recalc, ['approved']);
  assert.equal(lead.commissionStatus, 'pending');
  assert.equal(lead.statusHistory.length, 1);
  assert.equal(lead.statusHistory[0].status, 'approved');
  assert.equal(String(lead.statusHistory[0].changedBy), ACCOUNT_USER._id);
  assert.equal(String(lead.employeeStatus), APPROVED_LABEL);
  assert.ok(seen.notifications.some((n) => String(n.recipient) === AGENT && n.title === 'Application Approved'));
  assert.equal(lead.$locals.skipAutoRoute, true);
});

test('same status as now → nothing re-recorded, nobody notified', async (t) => {
  const lead = leadDoc('LD-3', { status: 'approved', commissionStatus: 'pending' });
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-3', 'Lead Status': 'approved', 'Disbursed': 'No', 'Rejected': 'No' }]);
  assert.deepEqual(res.body.failed, []);
  assert.deepEqual(seen.recalc, []);
  assert.equal(lead.statusHistory.length, 0);
  assert.equal(seen.notifications.filter((n) => n.lead).length, 0);
});

test('old export cannot pull an approved lead back to new (agency side)', async (t) => {
  const lead = leadDoc('LD-4', { status: 'approved', commissionStatus: 'pending' });
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-4', 'Lead Status': 'submitted' }]);
  assert.equal(res.body.updated, 0);
  assert.equal(res.body.failed.length, 1);
  assert.match(res.body.failed[0].reason, /LD-4.*approved.*submitted/);
  assert.equal(seen.saved.length, 0);
  assert.equal(lead.status, 'approved');
});

test('disbursed lead cannot be moved back to approved', async (t) => {
  const lead = leadDoc('LD-5', { status: 'disbursed', commissionStatus: 'pending' });
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-5', 'Lead Status': 'approved' }]);
  assert.equal(res.body.failed.length, 1);
  assert.match(res.body.failed[0].reason, /from "disbursed" to "approved"/);
  assert.equal(seen.saved.length, 0);
});

test('new lead marked Disbursed: goes through Approved first so commission is not skipped', async (t) => {
  const lead = leadDoc('LD-6');
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-6', 'Disbursed': 'Yes' }]);
  assert.deepEqual(res.body.failed, []);
  assert.equal(lead.status, 'disbursed');
  assert.deepEqual(seen.recalc, ['approved', 'disbursed']);
  assert.equal(lead.commissionStatus, 'pending');
  assert.deepEqual(lead.statusHistory.map((h) => h.status), ['approved', 'disbursed']);
});

test('Rejected: Yes → rejected with commission cleared', async (t) => {
  const lead = leadDoc('LD-7', { status: 'approved', commission: 500, grossCommission: 800, commissionStatus: 'pending' });
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-7', 'Rejected': 'Yes' }]);
  assert.deepEqual(res.body.failed, []);
  assert.equal(lead.status, 'rejected');
  assert.deepEqual(seen.recalc, ['rejected']);
  assert.equal(lead.commission, 0);
});

test('draft is never a valid import target, even for admin', async (t) => {
  const lead = leadDoc('LD-8');
  stubDb(t, [lead]);
  const res = await runImport(ADMIN, [{ 'Lead No': 'LD-8', 'Lead Status': 'draft' }]);
  assert.equal(res.body.failed.length, 1);
  assert.match(res.body.failed[0].reason, /draft/);
  assert.equal(lead.status, 'submitted');
});

test('phone given on update in local format is saved in 9715… format', async (t) => {
  const lead = leadDoc('LD-9');
  stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-9', Phone: '050 123 4567' }]);
  assert.deepEqual(res.body.failed, []);
  assert.equal(lead.phone, '971501234567');
});

test('wrong phone on update still fails that row', async (t) => {
  const lead = leadDoc('LD-10');
  const seen = stubDb(t, [lead]);
  const res = await runImport(ACCOUNT_USER, [{ 'Lead No': 'LD-10', Phone: '12345' }]);
  assert.equal(res.body.failed.length, 1);
  assert.match(res.body.failed[0].reason, /Invalid UAE mobile number "12345"/);
  assert.equal(seen.saved.length, 0);
});

test('bank / product names with + or ( ) are matched as plain text, and a stray ( does not crash the import', async (t) => {
  const lead = leadDoc('LD-11');
  const seen = stubDb(t, [lead]);
  const bankQueries = [];
  const productQueries = [];
  t.mock.method(Bank, 'findOne', async (q) => { bankQueries.push(q.name); return q.name.test('ADCB') ? { _id: 'b1' } : null; });
  t.mock.method(CardProduct, 'findOne', async (q) => {
    productQueries.push(q.name);
    return q.name.test('Lulu Platinum+ (Islamic)') ? { _id: 'p1' } : null;
  });
  t.mock.method(commissionService, 'resolveCommissions', async () => ({ receivable: 0, payable: 0 }));
  const res = await runImport(ADMIN, [
    { 'Lead No': 'LD-11', 'Product Type': 'credit_card', Bank: 'ADCB', 'Product Name': 'Lulu Platinum+ (Islamic)' },
    { 'Lead No': 'LD-11', 'Product Type': 'credit_card', Bank: 'ADCB (', 'Product Name': 'x' },
  ]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updated, 1);
  assert.equal(res.body.failed.length, 1);
  assert.match(res.body.failed[0].reason, /No bank found named "ADCB \("/);
  assert.equal(seen.saved.length, 1);
  assert.equal(productQueries[0].test('Lulu Platinum (Islamic)'), false, '+ must not act as a wildcard');
});
