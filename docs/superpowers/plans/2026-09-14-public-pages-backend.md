# Public Pages Backend Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend pieces 7 static public marketing pages need to stop using hardcoded data and fake apply forms: two new public Account Products endpoints, a `loanType`-recording addition to the existing loan-apply endpoint, and a handful of new optional catalog fields (with matching admin-panel inputs) so pages can show real bank-specific data instead of blanks.

**Architecture:** Every addition mirrors an existing, working sibling exactly — the new Account Products public endpoints mirror `getPublicLoanProducts`/`submitWebLoanApply` line-for-line; the new model fields follow the exact style of the fields already on `LoanProduct`/`AccountProduct`; the new admin form inputs follow the exact `Form.Item`/`Row`/`Col` pattern already used in `LoanProducts.jsx`/`AccountProducts.jsx`.

**Tech Stack:** Node/Express/Mongoose (backend), React/Ant Design (admin frontend). No automated test framework in this repo — verify via `node -e` sanity checks and curl round-trips, same as every prior piece of this project.

**Spec:** `docs/superpowers/specs/2026-09-14-public-pages-live-data-design.md` (Part 1)

## Global Constraints

- Additive only: no existing route, field, or function behavior changes. `getPublicLoanProducts`, `submitWebLoanApply`'s current behavior for callers that don't send the new field, and every existing `LoanProduct`/`AccountProduct` field stay exactly as they are.
- Every new model field is optional (no `required`) so existing documents and the existing admin create/update flows keep working unchanged if a field is omitted.

---

### Task 1: New public Account Products endpoints + `loanType` on loan-apply

**Files:**
- Modify: `backend/controllers/public.controller.js` (add 2 new exports at the end of the file, after `getPublicLoanProducts`; modify `submitWebLoanApply`'s destructure + `leadData`)
- Modify: `backend/routes/public.routes.js` (add 2 new route lines)

**Interfaces:**
- Consumes: `AccountProduct` model (existing).
- Produces: `GET /api/public/account-products` (public, no auth) returning the same shape/style as `GET /api/public/loan-products`; `POST /api/public/account-apply` (public) creating a `Lead` with `productType:'account'`; `POST /api/public/loan-apply` now also accepts an optional `loanType` in the body.

- [ ] **Step 1: Add the two new controller exports**

In `backend/controllers/public.controller.js`, add `const AccountProduct = require('../models/AccountProduct');` to the requires at the top (line 6, next to `FeaturedProduct`):
```js
const FeaturedProduct   = require('../models/FeaturedProduct');
const AccountProduct    = require('../models/AccountProduct');
```

At the end of the file (after `getPublicLoanProducts`'s closing `};` at line 346), add:
```js

exports.getPublicAccountProducts = async (req, res) => {
  try {
    const accounts = await AccountProduct.find({ isActive: true, websiteVisible: { $ne: false } })
      .populate({ path: 'bank', select: 'name code logo isActive' })
      .select('name accountCategory commissionBrackets bank benefits feesEligibility minBalance monthlyFee interestRate keyNotes tags redirectUrl redirectActive')
      .lean();
    res.json(accounts.filter(a => a.bank?.isActive !== false));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitWebAccountApply = async (req, res) => {
  try {
    const { customerName, phone, email, salary, accountType, accountProductId } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const leadData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: salary ? Number(salary) : undefined,
      productType: 'account',
      isReferral: false,
      source: 'web_apply',
      status: 'submitted',
      commissionStatus: 'none',
      grossCommission: 0,
      commission: 0,
    };
    if (accountType) leadData.accountType = accountType;

    const agencyDoc = await User.findOneAndUpdate(
      { role: 'agency', isDefaultAgency: true, isActive: true },
      { $inc: { leadCount: 1 } },
      { new: true, select: '_id leadCount' }
    );
    if (agencyDoc) {
      leadData.agency = agencyDoc._id;
      const shortId = String(agencyDoc._id).slice(-6).toUpperCase();
      const seq = String(agencyDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${shortId}-${seq}`;
    }

    let accountRedirectUrl = null;
    if (accountProductId) {
      leadData.accountProduct = accountProductId;
      const account = await AccountProduct.findById(accountProductId).select('bank redirectUrl redirectActive').lean();
      if (account?.bank) leadData.bank = account.bank;
      if (account?.redirectActive && account?.redirectUrl) accountRedirectUrl = account.redirectUrl;
    }

    if (accountRedirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!accountRedirectUrl) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Application submitted successfully', redirectUrl: accountRedirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Add `loanType` to `submitWebLoanApply`**

In `backend/controllers/public.controller.js`, change line 274:
```js
    const { customerName, phone, email, salary, loanAmount, employmentStatus, loanProductId } = req.body;
```
to:
```js
    const { customerName, phone, email, salary, loanAmount, employmentStatus, loanProductId, loanType } = req.body;
```
And add one line inside the `if (loanProductId) { ... }` block (currently lines 307-312), right after `leadData.loanProduct = loanProductId;`:
```js
    let loanRedirectUrl = null;
    if (loanProductId) {
      leadData.loanProduct = loanProductId;
      if (loanType) leadData.loanType = loanType;
      const loan = await LoanProduct.findById(loanProductId).select('bank redirectUrl redirectActive').lean();
```

- [ ] **Step 3: Add the two new routes**

In `backend/routes/public.routes.js`, add directly after line 11 (`router.post('/loan-apply', ctrl.submitWebLoanApply);`):
```js
router.post('/account-apply', ctrl.submitWebAccountApply);
```
And directly after line 14 (`router.get('/loan-products', ctrl.getPublicLoanProducts);`):
```js
router.get('/account-products', ctrl.getPublicAccountProducts);
```

- [ ] **Step 4: Verify — model/route load cleanly**

Run: `cd backend && node -e "require('./controllers/public.controller'); require('./routes/public.routes'); console.log('OK')"`
Expected: prints `OK`, no errors.

- [ ] **Step 5: Verify — curl round-trip on both new endpoints + the loanType addition**

The backend dev server (nodemon, :8000) is already running and auto-reloads on save. After it restarts:

```bash
curl -s http://localhost:8000/api/public/account-products | head -c 300
```
Expected: a JSON array (possibly containing the 3 `AccountProduct` test entries seeded earlier in this project — `Mashreq Business Elite Account` etc. — or an empty `[]` if those were since deleted; either is fine, the point is a 200 JSON array, not an error).

For the apply endpoints, write a throwaway script (same pattern used throughout this project — connect via mongoose, create what's needed, clean up after):
```bash
cd backend && node -e "
require('dotenv').config();
(async () => {
  const http = require('http');
  function post(path, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({ hostname: 'localhost', port: 8000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
        let raw = '';
        res.on('data', (c) => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
  const acc = await post('/api/public/account-apply', { customerName: 'TEST public account apply', phone: '971501110099', email: 'test@example.com', salary: 8000, accountType: 'savings_account' });
  console.log('account-apply:', acc.status, acc.body);
  const loan = await post('/api/public/loan-apply', { customerName: 'TEST public loan apply', phone: '971501110098', email: 'test@example.com', salary: 9000, loanAmount: 50000, loanType: 'auto_loan' });
  console.log('loan-apply with loanType:', loan.status, loan.body);
})();
"
```
Expected: both print `201` with a success message. Then verify the `loanType` actually persisted and clean up both test leads:
```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const leads = await Lead.find({ customerName: { \$in: ['TEST public account apply', 'TEST public loan apply'] } });
  leads.forEach(l => console.log(l.customerName, '-> productType:', l.productType, 'accountType:', l.accountType, 'loanType:', l.loanType));
  await Lead.deleteMany({ customerName: { \$in: ['TEST public account apply', 'TEST public loan apply'] } });
  console.log('cleaned up');
  process.exit(0);
});
"
```
Expected: the loan lead shows `loanType: auto_loan`, the account lead shows `accountType: savings_account`, then `cleaned up`.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/public.controller.js backend/routes/public.routes.js
git commit -m "Add public Account Products endpoints and loanType support on loan-apply

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: New optional catalog fields on `LoanProduct` and `AccountProduct` (backend)

**Files:**
- Modify: `backend/models/LoanProduct.js`
- Modify: `backend/models/AccountProduct.js`
- Modify: `backend/controllers/loanProduct.controller.js` (create/update field lists)
- Modify: `backend/controllers/accountProduct.controller.js` (create/update field lists)
- Modify: `backend/controllers/public.controller.js` (both public `.select()` strings, from Task 1)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LoanProduct.minTurnover` (Number), `LoanProduct.collateralRequired` (Boolean), `LoanProduct.minPosHistoryMonths` (Number); `AccountProduct.type` (String enum Islamic/Conventional), `.digitalOnboarding`/`.multiCurrency` (Boolean), `.salaryTransferRequired` (Boolean, tri-state), `.freeTransactions`/`.fallBelowFee`/`.payoutFrequency` (String) — consumed by Task 3 (admin UI) and by Plan 2 (the 7 public pages' mapping functions).

- [ ] **Step 1: Add the 3 new `LoanProduct` fields**

In `backend/models/LoanProduct.js`, add directly after line 46 (`loanType: { type: String, enum: ['Islamic', 'Conventional'], trim: true },`) and before the closing `},`:
```js
    loanType: { type: String, enum: ['Islamic', 'Conventional'], trim: true },
    minTurnover: { type: Number },
    collateralRequired: { type: Boolean, default: false },
    minPosHistoryMonths: { type: Number },
```

- [ ] **Step 2: Add the 7 new `AccountProduct` fields**

In `backend/models/AccountProduct.js`, add directly after line 28 (`interestRate: { type: String, trim: true },`):
```js
    interestRate: { type: String, trim: true },
    type: { type: String, enum: ['Islamic', 'Conventional'], trim: true },
    digitalOnboarding: { type: Boolean, default: false },
    multiCurrency: { type: Boolean, default: false },
    salaryTransferRequired: { type: Boolean, default: null },
    freeTransactions: { type: String, trim: true },
    fallBelowFee: { type: String, trim: true },
    payoutFrequency: { type: String, trim: true },
```

- [ ] **Step 3: Wire the new fields through `loanProduct.controller.js`**

In `backend/controllers/loanProduct.controller.js`, `exports.create` (line 18): add the 3 new names to the destructure (line 20) and to the `LoanProduct.create({...})` call (line 30):
```js
    const { name, loanCategory, bank, agency, commissionBrackets, isActive, agentVisible, websiteVisible, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths } = req.body;
```
```js
    const loan = await LoanProduct.create({ name, loanCategory, bank, agency: agency || undefined, commissionBrackets: commissionBrackets || [], benefits: benefits || '', feesEligibility: feesEligibility || '', isActive, agentVisible, websiteVisible, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths, redirectUrl: redirectUrl || '', redirectActive: !!redirectActive });
```
`exports.update` (line 38): add the 3 new names to the destructure (line 40) and 3 new `if (x !== undefined) update.x = x;` lines next to the existing `keyNotes` one (line 59):
```js
    const { name, loanCategory, bank, agency, commissionBrackets, isActive, agentVisible, websiteVisible, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths } = req.body;
```
```js
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
    if (minTurnover !== undefined) update.minTurnover = minTurnover;
    if (collateralRequired !== undefined) update.collateralRequired = collateralRequired;
    if (minPosHistoryMonths !== undefined) update.minPosHistoryMonths = minPosHistoryMonths;
```
(Note: this file destructures fields in several small groups across the function rather than one block — match whichever exact grouping the current file uses at the relevant spot; the important thing is every one of the 3 new names is destructured before use and forwarded into `LoanProduct.create`/`update`, not the exact line position within the function.)

- [ ] **Step 4: Wire the new fields through `accountProduct.controller.js`**

In `backend/controllers/accountProduct.controller.js`, `exports.create` (line 18): add the 7 new names to the destructure (line 23) and to `AccountProduct.create({...})` (line 33):
```js
      minBalance, monthlyFee, interestRate, keyNotes, tags,
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
```
```js
      minBalance, monthlyFee, interestRate, keyNotes, tags: tags || [],
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
```
`exports.update` (line 48): add the 7 new names to the destructure (line 53) and 7 new `if (x !== undefined) update.x = x;` lines next to the existing `interestRate`/`keyNotes` ones (lines 71-72):
```js
      minBalance, monthlyFee, interestRate, keyNotes, tags,
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
```
```js
    if (interestRate !== undefined) update.interestRate = interestRate;
    if (type !== undefined) update.type = type;
    if (digitalOnboarding !== undefined) update.digitalOnboarding = digitalOnboarding;
    if (multiCurrency !== undefined) update.multiCurrency = multiCurrency;
    if (salaryTransferRequired !== undefined) update.salaryTransferRequired = salaryTransferRequired;
    if (freeTransactions !== undefined) update.freeTransactions = freeTransactions;
    if (fallBelowFee !== undefined) update.fallBelowFee = fallBelowFee;
    if (payoutFrequency !== undefined) update.payoutFrequency = payoutFrequency;
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
```

- [ ] **Step 5: Add the new fields to both public `.select()` strings**

In `backend/controllers/public.controller.js`, `getPublicLoanProducts`'s `.select(...)` string, append ` minTurnover collateralRequired minPosHistoryMonths` before the closing quote (so it reads `...tenureMaxMonths loanType minTurnover collateralRequired minPosHistoryMonths redirectUrl redirectActive`).

`getPublicAccountProducts`'s `.select(...)` string (added in Task 1), append ` type digitalOnboarding multiCurrency salaryTransferRequired freeTransactions fallBelowFee payoutFrequency` before the closing quote.

- [ ] **Step 6: Verify — models load, existing documents unaffected**

```bash
cd backend && node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const LoanProduct = require('./models/LoanProduct');
const AccountProduct = require('./models/AccountProduct');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('LoanProduct count:', await LoanProduct.countDocuments());
  console.log('AccountProduct count:', await AccountProduct.countDocuments());
  process.exit(0);
});
"
```
Expected: both counts print with no validation errors (proves the new optional fields don't break loading pre-existing documents that don't have them set).

- [ ] **Step 7: Verify — curl round-trip creating a product with the new fields**

```bash
cd backend && node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const LoanProduct = require('./models/LoanProduct');
const AccountProduct = require('./models/AccountProduct');
const Bank = require('./models/Bank');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const bank = await Bank.findOne({ isActive: true });
  const loan = await LoanProduct.create({ name: 'TEST new fields loan', loanCategory: 'business', bank: bank._id, minTurnover: 750000, collateralRequired: true, minPosHistoryMonths: 6 });
  console.log('LoanProduct:', loan.minTurnover, loan.collateralRequired, loan.minPosHistoryMonths);
  const account = await AccountProduct.create({ name: 'TEST new fields account', accountCategory: 'business', bank: bank._id, type: 'Islamic', digitalOnboarding: true, multiCurrency: true, salaryTransferRequired: false, freeTransactions: '5 free/month', fallBelowFee: 'AED 25', payoutFrequency: 'Monthly' });
  console.log('AccountProduct:', account.type, account.digitalOnboarding, account.multiCurrency, account.salaryTransferRequired, account.freeTransactions, account.fallBelowFee, account.payoutFrequency);
  await LoanProduct.findByIdAndDelete(loan._id);
  await AccountProduct.findByIdAndDelete(account._id);
  console.log('cleaned up');
  process.exit(0);
});
"
```
Expected: both log lines print the values you just set, then `cleaned up`.

Then confirm the public endpoints actually return the new fields for an active/visible product (create one more throwaway with `isActive:true` — the two above didn't set `isActive` explicitly but it defaults to `true` per the schema — query `curl http://localhost:8000/api/public/loan-products` / `/account-products` before deleting the test docs above and grep the response for `minTurnover`/`digitalOnboarding` to confirm they're present, not stripped by `.select()`).

- [ ] **Step 8: Commit**

```bash
git add backend/models/LoanProduct.js backend/models/AccountProduct.js backend/controllers/loanProduct.controller.js backend/controllers/accountProduct.controller.js backend/controllers/public.controller.js
git commit -m "Add optional business/POS loan and account display fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Admin UI for the new fields

**Files:**
- Modify: `frontend/src/pages/admin/LoanProducts.jsx`
- Modify: `frontend/src/pages/admin/AccountProducts.jsx`

**Interfaces:**
- Consumes: the 3 new `LoanProduct` fields and 7 new `AccountProduct` fields from Task 2.
- Produces: admin can actually set these fields per product; no new interfaces for other code to consume.

- [ ] **Step 1: `LoanProducts.jsx` — add 3 new optional inputs**

In `openEdit` (around line 77-109), add the 3 new fields to the `form.setFieldsValue({...})` call, next to the existing `tenureMaxMonths`/`minSalary`/`maxAmountNum` lines:
```js
      minTurnover: l.minTurnover ?? null,
      collateralRequired: l.collateralRequired || false,
      minPosHistoryMonths: l.minPosHistoryMonths ?? null,
```

In the form JSX, directly after the existing `Row` containing `tenureMaxMonths`/`minSalary`/`maxAmountNum` (around line 366-382) and before the `maxAmountNote` Form.Item, add a new row:
```jsx
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="minTurnover" label="Min Business Turnover (AED)">
                <InputNumber min={0} step={50000} style={{ width: '100%' }} placeholder="500000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minPosHistoryMonths" label="Min POS History (months)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="6" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="collateralRequired" label="Collateral Required" valuePropName="checked" style={{ marginTop: 4 }}>
                <Switch checkedChildren="Required" unCheckedChildren="Not Required" />
              </Form.Item>
            </Col>
          </Row>
```
(These 3 fields are only meaningful for Business/POS Loan categories, but per this codebase's existing convention — every field in this form is always rendered regardless of the selected category — don't add conditional show/hide logic; that would be a new UI pattern this form doesn't otherwise use.)

- [ ] **Step 2: `AccountProducts.jsx` — add 7 new optional inputs**

In `openEdit` (lines 63-85), add the 7 new fields to the `form.setFieldsValue({...})` call, next to the existing `interestRate`/`keyNotes` lines:
```js
      interestRate: a.interestRate || '',
      type: a.type || undefined,
      digitalOnboarding: a.digitalOnboarding || false,
      multiCurrency: a.multiCurrency || false,
      salaryTransferRequired: a.salaryTransferRequired === true ? 'yes' : a.salaryTransferRequired === false ? 'no' : 'varies',
      freeTransactions: a.freeTransactions || '',
      fallBelowFee: a.fallBelowFee || '',
      payoutFrequency: a.payoutFrequency || '',
```
(`salaryTransferRequired` uses the same 3-way yes/no/varies mapping `LoanProducts.jsx` already uses for its own `salaryTransferRequired` field — for consistency. `onSubmit`, Step 3 below, converts it back.)

In the form JSX, directly after the existing `Row` containing `minBalance`/`monthlyFee`/`interestRate` (lines 289-305) and before the `keyNotes` Form.Item, add two new rows:
```jsx
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="type" label="Type">
                <Select allowClear options={[{ value: 'Conventional', label: 'Conventional' }, { value: 'Islamic', label: 'Islamic' }]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="digitalOnboarding" label="Digital Onboarding" valuePropName="checked" style={{ marginTop: 4 }}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="multiCurrency" label="Multi-Currency" valuePropName="checked" style={{ marginTop: 4 }}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="salaryTransferRequired" label="Salary Transfer">
                <Select options={[{ value: 'yes', label: 'Required' }, { value: 'no', label: 'Not Required' }, { value: 'varies', label: 'Varies' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="freeTransactions" label="Free Transactions">
                <Input placeholder="e.g. 2 free withdrawals/month" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="fallBelowFee" label="Fee If Below Minimum">
                <Input placeholder="e.g. AED 25/month" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payoutFrequency" label="Payout Frequency">
                <Input placeholder="e.g. Monthly" />
              </Form.Item>
            </Col>
          </Row>
```

- [ ] **Step 3: `AccountProducts.jsx` — convert `salaryTransferRequired` back to tri-state on submit**

In `onSubmit` (lines 87-103), before building `payload`, add the same conversion `LoanProducts.jsx`'s `onSubmit` already does for its own `salaryTransferRequired` field:
```js
  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const strVal = values.salaryTransferRequired;
      values.salaryTransferRequired = strVal === 'yes' ? true : strVal === 'no' ? false : strVal === 'varies' ? null : undefined;
      const payload = { ...values, benefits: benefitsHtml, feesEligibility: feesHtml };
```

- [ ] **Step 4: Verify — lint**

Run: `cd frontend && npx eslint src/pages/admin/LoanProducts.jsx src/pages/admin/AccountProducts.jsx`
Expected: no new errors (existing pre-existing warnings on these files, if any, are not yours to fix).

- [ ] **Step 5: Verify — curl-based CRUD check exercising the new fields through the real admin API**

```bash
TOKEN=$(node -e "
require('dotenv').config();
const http = require('http');
const data = JSON.stringify({ email: 'admin@bankcrm.local', password: 'admin123' });
const req = http.request({ hostname: 'localhost', port: 8000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
  let raw = ''; res.on('data', c => raw += c); res.on('end', () => console.log(JSON.parse(raw).token));
});
req.write(data); req.end();
")
BANK_ID=$(curl -s http://localhost:8000/api/banks -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0]._id))")
curl -s -X POST http://localhost:8000/api/loan-products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"TEST admin new fields\",\"loanCategory\":\"business\",\"bank\":\"$BANK_ID\",\"minTurnover\":600000,\"collateralRequired\":true,\"minPosHistoryMonths\":9}"
```
Expected: `201` response including `minTurnover: 600000`, `collateralRequired: true`, `minPosHistoryMonths: 9`. Repeat similarly for `POST /api/account-products` with `type`/`digitalOnboarding`/etc. Delete both test records afterward via `DELETE /api/loan-products/<id>` / `DELETE /api/account-products/<id>`.

- [ ] **Step 6: Verify — manual walkthrough (disclose as needed)**

No browser tool available — state clearly in the report that visual confirmation (do the new fields render correctly in the modal, in the right place, without layout issues) is a disclosed gap for a human to check, consistent with every other frontend task in this project.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/admin/LoanProducts.jsx frontend/src/pages/admin/AccountProducts.jsx
git commit -m "Add admin form inputs for new business/POS loan and account fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
