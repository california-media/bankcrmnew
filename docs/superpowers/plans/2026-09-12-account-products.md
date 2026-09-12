# Account Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a brand-new "Account Products" catalog (Business/Current/Saving Account) to the admin panel, and let leads be created and processed against it end-to-end.

**Architecture:** Mirror the existing `LoanProduct` stack (model → controller → routes → admin page) with a new, parallel `AccountProduct` stack. Extend `Lead` with a `productType='account'` branch and an `accountType` discriminator (same role `loanType` plays for loans). Extend `SubmitLead.jsx` with a 4th product tab.

**Tech Stack:** Node/Express/Mongoose (backend), React/Ant Design (frontend), no automated test framework in this repo (verify via `node -e` sanity checks, unauthenticated curl route-presence checks, and manual UI walkthrough against the already-running local dev servers — backend on `:8000`, frontend/vite on `:5175`).

**Spec:** `docs/superpowers/specs/2026-09-12-new-product-categories-design.md` (Sub-project 1)

## Global Constraints

- Additive only: no existing enum value, field, route, or component may be renamed, removed, or restructured — every change is a new file, a new enum value, a new optional field, a new route, or a single-line insertion.
- `AccountProduct.commissionBrackets` are **flat AED amounts** (like `CardProduct`), not a percentage of an amount — accounts have no loan-amount field to take a % of.
- Follow existing code style exactly (no prettier/eslint re-formatting of surrounding lines you don't touch).

---

### Task 1: Backend — `AccountProduct` model, controller, routes, mount

**Files:**
- Create: `backend/models/AccountProduct.js`
- Create: `backend/controllers/accountProduct.controller.js`
- Create: `backend/routes/accountProduct.routes.js`
- Modify: `backend/server.js:74` (insert one line after the `loan-products` mount)

**Interfaces:**
- Produces: `AccountProduct` mongoose model (fields: `name`, `accountCategory` enum `['business','current','savings']`, `bank` ref, `agency` ref, `commissionBrackets: [{minimumSalary, receivable, payable}]`, `benefits`, `feesEligibility`, `isActive`/`agentVisible`/`websiteVisible`, `redirectUrl`/`redirectActive`, `minBalance`, `monthlyFee`, `interestRate`, `keyNotes`, `tags`). Routes mounted at `/api/account-products` with `GET /` (admin/agent/agency), `POST /` `PUT /:id` `DELETE /:id` (admin only) — used by Task 4 (admin page) and Task 5 (`SubmitLead.jsx`).

- [ ] **Step 1: Create the model**

Create `backend/models/AccountProduct.js`:

```js
const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const accountProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    accountCategory: { type: String, enum: ['business', 'current', 'savings'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commissionBrackets: { type: [bracketSchema], default: [] },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    isActive:       { type: Boolean, default: true },
    agentVisible:   { type: Boolean, default: true },
    websiteVisible: { type: Boolean, default: true },
    redirectUrl:    { type: String, trim: true },
    redirectActive: { type: Boolean, default: false },
    minBalance: { type: Number },
    monthlyFee: { type: String, trim: true },
    interestRate: { type: String, trim: true },
    keyNotes: { type: String, trim: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountProduct', accountProductSchema);
```

- [ ] **Step 2: Create the controller**

Create `backend/controllers/accountProduct.controller.js` (copied shape from `loanProduct.controller.js`):

```js
const AccountProduct = require('../models/AccountProduct');
const User = require('../models/User');

const POPULATE = [
  { path: 'bank', select: 'name code isActive logo' },
  { path: 'agency', select: 'name email' },
];

exports.list = async (req, res) => {
  try {
    const accounts = await AccountProduct.find().populate(POPULATE).sort({ name: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name, accountCategory, bank, agency, commissionBrackets,
      isActive, agentVisible, websiteVisible,
      minBalance, monthlyFee, interestRate, keyNotes, tags,
      benefits, feesEligibility, redirectUrl, redirectActive,
    } = req.body;
    if (!name || !accountCategory || !bank) {
      return res.status(400).json({ message: 'name, accountCategory, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
    }
    const account = await AccountProduct.create({
      name, accountCategory, bank, agency: agency || undefined,
      commissionBrackets: commissionBrackets || [],
      benefits: benefits || '', feesEligibility: feesEligibility || '',
      isActive, agentVisible, websiteVisible,
      minBalance, monthlyFee, interestRate, keyNotes, tags: tags || [],
      redirectUrl: redirectUrl || '', redirectActive: !!redirectActive,
    });
    const populated = await account.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const {
      name, accountCategory, bank, agency, commissionBrackets,
      isActive, agentVisible, websiteVisible,
      minBalance, monthlyFee, interestRate, keyNotes, tags,
      benefits, feesEligibility, redirectUrl, redirectActive,
    } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (accountCategory !== undefined) update.accountCategory = accountCategory;
    if (bank !== undefined) update.bank = bank;
    if (agency !== undefined) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
      update.agency = agency;
    }
    if (commissionBrackets !== undefined) update.commissionBrackets = commissionBrackets;
    if (isActive !== undefined) update.isActive = isActive;
    if (agentVisible !== undefined) update.agentVisible = agentVisible;
    if (websiteVisible !== undefined) update.websiteVisible = websiteVisible;
    if (minBalance !== undefined) update.minBalance = minBalance;
    if (monthlyFee !== undefined) update.monthlyFee = monthlyFee;
    if (interestRate !== undefined) update.interestRate = interestRate;
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
    if (tags !== undefined) update.tags = tags;
    if (benefits !== undefined) update.benefits = benefits;
    if (feesEligibility !== undefined) update.feesEligibility = feesEligibility;
    if (redirectUrl !== undefined) update.redirectUrl = redirectUrl || '';
    if (redirectActive !== undefined) update.redirectActive = !!redirectActive;

    const account = await AccountProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!account) return res.status(404).json({ message: 'Account product not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const account = await AccountProduct.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account product not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 3: Create the routes**

Create `backend/routes/accountProduct.routes.js`:

```js
const router = require('express').Router();
const ctrl = require('../controllers/accountProduct.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// All authenticated users can read (agents need it for lead creation)
router.get('/', requireRole('admin', 'agent', 'agency'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
```

- [ ] **Step 4: Mount the route**

In `backend/server.js`, find line 74:
```js
app.use('/api/loan-products',     require('./routes/loanProduct.routes'));
```
Add directly after it:
```js
app.use('/api/account-products',  require('./routes/accountProduct.routes'));
```

- [ ] **Step 5: Verify — model loads cleanly**

Run: `cd backend && node -e "require('./models/AccountProduct'); console.log('AccountProduct model OK')"`
Expected: prints `AccountProduct model OK` with no errors.

- [ ] **Step 6: Verify — route is mounted and guarded**

The backend dev server (nodemon) is already running on port 8000 and auto-reloads on save. After it restarts, run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/account-products
```
Expected: `401` (route exists, `protect` middleware rejects the unauthenticated request — a `404` here would mean the route isn't wired).

- [ ] **Step 7: Commit**

```bash
git add backend/models/AccountProduct.js backend/controllers/accountProduct.controller.js backend/routes/accountProduct.routes.js backend/server.js
git commit -m "Add AccountProduct model, controller, and routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — `Lead` model support for account leads

**Files:**
- Modify: `backend/models/Lead.js:37,41` (productType enum, new fields)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Lead.productType` enum now includes `'account'`; new fields `Lead.accountProduct` (ObjectId ref `AccountProduct`) and `Lead.accountType` (enum `['business_account','current_account','savings_account', null]`, default `null`) — consumed by Task 3 (lead creation) and by Plan B's `getLoanActions` extension.

- [ ] **Step 1: Extend the schema**

In `backend/models/Lead.js`, change line 37:
```js
    productType: { type: String, enum: ['credit_card', 'loan'] },
```
to:
```js
    productType: { type: String, enum: ['credit_card', 'loan', 'account'] },
```

Directly after line 41 (`loanProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanProduct' },`), add:
```js
    accountProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountProduct' },
    accountType: { type: String, enum: ['business_account', 'current_account', 'savings_account', null], default: null },
```

- [ ] **Step 2: Verify — model loads cleanly and existing docs still validate**

Run:
```bash
cd backend && node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const count = await Lead.countDocuments();
  console.log('Lead model OK, existing lead count:', count);
  process.exit(0);
});
"
```
Expected: prints `Lead model OK, existing lead count: <N>` with no validation errors — confirms the new enum/fields don't break loading pre-existing lead documents.

- [ ] **Step 3: Commit**

```bash
git add backend/models/Lead.js
git commit -m "Add productType 'account' and account fields to Lead model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — lead creation + commission resolution for account leads

**Files:**
- Modify: `backend/controllers/lead.controller.js:20,25,62-77,98-99`
- Modify: `backend/services/commission.service.js:32-50`

**Interfaces:**
- Consumes: `AccountProduct` model (Task 1), `Lead.accountProduct`/`accountType` fields (Task 2).
- Produces: `POST /api/leads` accepts `productType: 'account'` with `accountProduct`/`accountType` in the body; `commissionService.resolveCommissions(lead)` returns correct `{receivable, payable}` for account leads.

- [ ] **Step 1: Add the account branch to lead creation**

In `backend/controllers/lead.controller.js`, add `AccountProduct` to the requires at the top (line 5, next to `LoanProduct`):
```js
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');
```

In `POPULATE_FIELDS` (line 20-31), add one entry next to the `loanProduct` populate (line 25):
```js
  { path: 'loanProduct', select: 'name loanCategory commissionBrackets benefits feesEligibility minSalary maxLoanAmount maxTenure interestRateRange' },
  { path: 'accountProduct', select: 'name accountCategory commissionBrackets benefits feesEligibility' },
```

In `exports.create` (starts at line 38), add `accountProduct` and `accountType` to the destructured body (line 40):
```js
    const { customerName, phone, productType, cardProduct, loanProduct, loanAmount, loanType, accountProduct, accountType, customerSalary, notes, email, visaType, nationality, city, companyName, jobTitle, yearsOfExperience, referenceNo } = req.body;
```

Add a new `else if` branch right before the final rejecting `else` (currently lines 75-77):
```js
    } else if (productType === 'account') {
      if (!accountProduct) return res.status(400).json({ message: 'accountProduct is required for account leads' });
      const account = await AccountProduct.findById(accountProduct).populate('agency', 'isActive role');
      if (!account) return res.status(400).json({ message: 'Invalid account product' });
      if (!account.isActive) return res.status(400).json({ message: 'This account product is not active' });
      bankId = account.bank;
      if (account.agency && account.agency.role === 'agency' && account.agency.isActive) {
        agencyId = account.agency._id;
      } else {
        agencyId = req.user.agency;
      }
      if (!agencyId) return res.status(400).json({ message: 'This account product has no agency assigned. Ask an admin to edit the product and select an agency.' });
    } else {
      return res.status(400).json({ message: 'productType must be credit_card, loan, or account' });
    }
```
(This replaces just the final `else` body's message — the `if (productType === 'credit_card')` / `else if (productType === 'loan')` blocks above it are untouched.)

Add the matching payload assignment next to line 98-99:
```js
    if (productType === 'credit_card') leadData.cardProduct = cardProduct;
    if (productType === 'loan') { leadData.loanProduct = loanProduct; leadData.loanAmount = loanAmount; if (loanType) leadData.loanType = loanType; }
    if (productType === 'account') { leadData.accountProduct = accountProduct; if (accountType) leadData.accountType = accountType; }
```

Also update the `commissionService.resolveCommissions` call a few lines below (currently passes `{ productType, cardProduct, loanProduct, loanAmount, customerSalary }`) to also pass `accountProduct`:
```js
    const { receivable, payable } = await commissionService.resolveCommissions({
      productType,
      cardProduct,
      loanProduct,
      loanAmount,
      accountProduct,
      customerSalary,
    });
```

- [ ] **Step 2: Add the account branch to commission resolution**

In `backend/services/commission.service.js`, add the require at the top (line 5, next to `LoanProduct`):
```js
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');
```

In `resolveCommissions(lead)` (starts at line 32), add a new branch right after the `credit_card` branch (after line 40, before the `if (lead.productType === 'loan' ...)` branch):
```js
  if (lead.productType === 'account' && lead.accountProduct) {
    const account = await AccountProduct.findById(lead.accountProduct);
    if (!account) return { receivable: 0, payable: 0 };
    const bracket = findBracket(account.commissionBrackets, lead.customerSalary);
    return bracket
      ? { receivable: bracket.receivable, payable: bracket.payable }
      : { receivable: 0, payable: 0 };
  }
```

- [ ] **Step 3: Verify — direct-script functional test**

There's no auth-token-free way to hit `POST /api/leads` over HTTP from this sandbox, so verify by exercising the same code path directly against the (already-connected) dev database with a throwaway script — then delete it, don't commit it.

Create a temporary file `backend/verify-account-flow.js`:
```js
require('dotenv').config();
const mongoose = require('mongoose');
const Bank = require('./models/Bank');
const AccountProduct = require('./models/AccountProduct');
const commissionService = require('./services/commission.service');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const bank = await Bank.findOne({ isActive: true });
  if (!bank) throw new Error('No active bank found to test with');

  const account = await AccountProduct.create({
    name: 'TEST Business Account',
    accountCategory: 'business',
    bank: bank._id,
    isActive: true,
    commissionBrackets: [{ minimumSalary: 0, receivable: 500, payable: 300 }],
  });

  const result = await commissionService.resolveCommissions({
    productType: 'account',
    accountProduct: account._id,
    customerSalary: 5000,
  });
  console.log('resolveCommissions result:', result);
  if (result.receivable !== 500 || result.payable !== 300) {
    throw new Error('FAIL: expected {receivable:500, payable:300}, got ' + JSON.stringify(result));
  }
  console.log('PASS: account commission resolution works');

  await AccountProduct.findByIdAndDelete(account._id);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `cd backend && node verify-account-flow.js`
Expected: prints `resolveCommissions result: { receivable: 500, payable: 300 }` then `PASS: account commission resolution works`.

Then delete the scratch file: `rm backend/verify-account-flow.js` (it's a one-off check, not part of the codebase).

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/lead.controller.js backend/services/commission.service.js
git commit -m "Support productType 'account' in lead creation and commission resolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — Account Products admin page + nav entry

**Files:**
- Create: `frontend/src/pages/admin/AccountProducts.jsx`
- Modify: `frontend/src/components/AppLayout.jsx:51` (insert nav entry after Loan Products)
- Modify: `frontend/src/App.jsx:19,113` (import + route)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/account-products` (Task 1).
- Produces: `/admin/account-products` admin page, reachable from the sidebar directly below "Loan Products".

- [ ] **Step 1: Create the admin page**

Create `frontend/src/pages/admin/AccountProducts.jsx` (copied shape from `LoanProducts.jsx`, swapping loan-only fields for account ones):

```jsx
import { useEffect, useState } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, Tag, message, Divider, Tabs, Switch, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, SearchOutlined } from '@ant-design/icons';
import QuillEditor from '../../components/QuillEditor';
import api from '../../api/client';

const ACCOUNT_CATEGORIES = [
  { value: 'business', label: 'Business Account' },
  { value: 'current',  label: 'Current Account' },
  { value: 'savings',  label: 'Saving Account' },
];

const CATEGORY_COLOR = {
  business: 'blue',
  current:  'cyan',
  savings:  'green',
};

function AccountProducts() {
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState(null);
  const [agencyFilter, setAgencyFilter] = useState(null);
  const [benefitsHtml, setBenefitsHtml] = useState('');
  const [feesHtml, setFeesHtml] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [accountsRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/account-products'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setAccounts(accountsRes.data);
      setBanks(banksRes.data);
      setAgencies(agenciesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, agentVisible: true, websiteVisible: true });
    setBenefitsHtml('');
    setFeesHtml('');
    setOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    form.setFieldsValue({
      name: a.name,
      accountCategory: a.accountCategory,
      bank: a.bank?._id,
      agency: a.agency?._id,
      isActive: a.isActive,
      agentVisible: a.agentVisible !== false,
      websiteVisible: a.websiteVisible !== false,
      commissionBrackets: a.commissionBrackets || [],
      minBalance: a.minBalance ?? null,
      monthlyFee: a.monthlyFee || '',
      interestRate: a.interestRate || '',
      keyNotes: a.keyNotes,
      tags: a.tags || [],
      redirectUrl: a.redirectUrl || '',
      redirectActive: a.redirectActive || false,
    });
    setBenefitsHtml(a.benefits || '');
    setFeesHtml(a.feesEligibility || '');
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const payload = { ...values, benefits: benefitsHtml, feesEligibility: feesHtml };
      if (editing) {
        await api.put(`/account-products/${editing._id}`, payload);
        message.success('Account product updated');
      } else {
        await api.post('/account-products', payload);
        message.success('Account product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/account-products/${id}`);
      message.success('Account product deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { isActive: !row.isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleAgentVisible = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { agentVisible: row.agentVisible === false });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleWebsiteVisible = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { websiteVisible: row.websiteVisible === false });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const columns = [
    { title: 'Account Name', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Category',
      dataIndex: 'accountCategory',
      render: (v) => {
        const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v);
        return <Tag color={CATEGORY_COLOR[v] || 'default'}>{cat?.label || v}</Tag>;
      },
    },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    {
      title: 'Brackets',
      render: (_, row) => {
        const b = row.commissionBrackets || [];
        if (!b.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space direction="vertical" size={2}>
            {b.map((br, i) => (
              <Typography.Text key={i} style={{ fontSize: 12 }}>
                ≥ AED {Number(br.minimumSalary).toLocaleString()} → R: AED {br.receivable} / P: AED {br.payable}
              </Typography.Text>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v, row) => (
        <Switch checked={v} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(row)} />
      ),
    },
    {
      title: 'Agent Visible',
      dataIndex: 'agentVisible',
      render: (v, row) => (
        <Switch checked={v !== false} checkedChildren="Visible" unCheckedChildren="Hidden" onChange={() => toggleAgentVisible(row)} />
      ),
    },
    {
      title: 'Website Visible',
      dataIndex: 'websiteVisible',
      render: (v, row) => (
        <Switch checked={v !== false} checkedChildren="Visible" unCheckedChildren="Hidden" onChange={() => toggleWebsiteVisible(row)} />
      ),
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this account product?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Account Products</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Account</Button>
        </div>
      </div>

      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search account name..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Banks"
          value={bankFilter}
          onChange={setBankFilter}
          options={banks.map((b) => ({ value: b._id, label: b.name }))}
          style={{ width: 180, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Agencies"
          value={agencyFilter}
          onChange={setAgencyFilter}
          options={agencies.map((a) => ({ value: a._id, label: a.name }))}
          style={{ width: 180, flexShrink: 0 }}
        />
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={accounts.filter((a) => {
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            if (!a.name.toLowerCase().includes(q) && !(a.bank?.name || '').toLowerCase().includes(q)) return false;
          }
          if (bankFilter && a.bank?._id !== bankFilter) return false;
          if (agencyFilter && a.agency?._id !== agencyFilter) return false;
          return true;
        })} columns={columns} />
      </div>

      <Modal
        title={editing ? 'Edit Account Product' : 'Add Account Product'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={780}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Account Name" rules={[{ required: true, message: 'Account name is required' }]}>
            <Input placeholder="e.g. Emirates NBD Business Account" />
          </Form.Item>
          <Form.Item name="accountCategory" label="Account Category" rules={[{ required: true, message: 'Account category is required' }]}>
            <Select options={ACCOUNT_CATEGORIES} placeholder="Select category" />
          </Form.Item>
          <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Bank is required' }]}>
            <Select
              showSearch
              options={bankOptions}
              placeholder="Select bank"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Agency is required' }]}>
            <Select
              showSearch
              options={agencyOptions}
              placeholder="Select agency"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Bank Product Info</Divider>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="minBalance" label="Min Balance (AED)">
                <InputNumber min={0} step={500} style={{ width: '100%' }} placeholder="3000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthlyFee" label="Monthly Fee">
                <Input placeholder="e.g. AED 0 with min balance" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="interestRate" label="Interest Rate">
                <Input placeholder="e.g. up to 3.5% p.a. (savings)" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="keyNotes" label="Key Notes">
            <Input.TextArea rows={2} placeholder="Key product notes..." />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="multiple" options={[{ value: 'fast', label: 'Fast Approval' }, { value: 'national', label: 'UAE Nationals' }]} placeholder="Select tags" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Commission Brackets</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Receivable = flat AED amount agency receives from bank. Payable = flat AED amount paid to agent. Highest eligible bracket applies.
          </Typography.Text>

          <Form.List name="commissionBrackets">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }} wrap>
                    <Form.Item
                      {...restField}
                      name={[name, 'minimumSalary']}
                      label="Min Salary (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={500} placeholder="5000" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'receivable']}
                      label="Receivable (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={50} placeholder="500" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'payable']}
                      label="Payable (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={50} placeholder="300" style={{ width: 120 }} />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      style={{ color: '#ff4d4f', marginTop: 28, cursor: 'pointer' }}
                    />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                  Add Bracket
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" style={{ fontSize: 13 }}>Redirect Link</Divider>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="redirectUrl" label="Redirect URL after submission">
                <Input placeholder="https://app.mysilah.ae/apply/..." />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="redirectActive" label="Redirect Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="isActive" label="Product Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="agentVisible" label="Visible in Agent Panel" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="websiteVisible" label="Visible in Website" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Product Content</Divider>
          <Tabs
            items={[
              {
                key: 'benefits',
                label: 'Product Benefits',
                children: (
                  <QuillEditor value={benefitsHtml} onChange={setBenefitsHtml} style={{ height: 260, marginBottom: 42 }} />
                ),
              },
              {
                key: 'fees',
                label: 'Fees & Eligibility',
                children: (
                  <QuillEditor value={feesHtml} onChange={setFeesHtml} style={{ height: 260, marginBottom: 42 }} />
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  );
}

export default AccountProducts;
```

- [ ] **Step 2: Add the nav entry**

In `frontend/src/components/AppLayout.jsx`, find (currently line 51):
```js
    { key: '/admin/loan-products',     icon: <FundOutlined />,         label: <Link to="/admin/loan-products">Loan Products</Link> },
```
Add directly after it:
```js
    { key: '/admin/account-products',  icon: <BankOutlined />,         label: <Link to="/admin/account-products">Account Products</Link> },
```
(`BankOutlined` is already imported at the top of this file — used by the "Banks" nav entry.)

- [ ] **Step 3: Wire the route**

In `frontend/src/App.jsx`, add the import next to line 19:
```js
import LoanProducts from './pages/admin/LoanProducts';
import AccountProducts from './pages/admin/AccountProducts';
```
Add the route next to line 113:
```js
          <Route path="loan-products" element={<LoanProducts />} />
          <Route path="account-products" element={<AccountProducts />} />
```

- [ ] **Step 4: Verify — lint**

Run: `cd frontend && npx eslint src/pages/admin/AccountProducts.jsx src/components/AppLayout.jsx src/App.jsx`
Expected: no errors (warnings about pre-existing unrelated lines in the modified files are fine — only new lines must be clean).

- [ ] **Step 5: Verify — manual walkthrough**

The frontend vite dev server is already running on `:5175` with an active logged-in admin session (per the screenshot in this conversation). In the browser:
1. Refresh; confirm the sidebar now shows "Account Products" directly below "Loan Products".
2. Click it; confirm the page loads with an empty table and an "Add Account" button.
3. Click "Add Account", fill in Name/Category/Bank/Agency, add one commission bracket, save.
4. Confirm the new row appears in the table with the right category tag and bracket text.
5. Toggle Status/Agent Visible/Website Visible switches; confirm they persist after a page refresh.
6. Edit the row, delete it; confirm both work.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/AccountProducts.jsx frontend/src/components/AppLayout.jsx frontend/src/App.jsx
git commit -m "Add Account Products admin page and nav entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — `SubmitLead.jsx` Account tab

**Files:**
- Modify: `frontend/src/pages/agent/SubmitLead.jsx`

**Interfaces:**
- Consumes: `GET /api/account-products` (Task 1).
- Produces: agents can create leads with `productType: 'account'`.

- [ ] **Step 1: Fetch account products alongside cards/loans**

Near line 128-130 (state declarations), add:
```js
  const [accountProducts, setAccountProducts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedAccountType, setSelectedAccountType] = useState(null);
```

In the `useEffect` at line 142-150, change:
```js
    Promise.all([api.get('/card-products'), api.get('/loan-products')])
      .then(([cardsRes, loansRes]) => {
        setCardProducts(cardsRes.data.filter((c) => c.isActive && c.agentVisible !== false && c.bank?.isActive !== false));
        setLoanProducts(loansRes.data.filter((l) => l.isActive && l.agentVisible !== false && l.bank?.isActive !== false));
      })
      .finally(() => setLoading(false));
```
to:
```js
    Promise.all([api.get('/card-products'), api.get('/loan-products'), api.get('/account-products')])
      .then(([cardsRes, loansRes, accountsRes]) => {
        setCardProducts(cardsRes.data.filter((c) => c.isActive && c.agentVisible !== false && c.bank?.isActive !== false));
        setLoanProducts(loansRes.data.filter((l) => l.isActive && l.agentVisible !== false && l.bank?.isActive !== false));
        setAccountProducts(accountsRes.data.filter((a) => a.isActive && a.agentVisible !== false && a.bank?.isActive !== false));
      })
      .finally(() => setLoading(false));
```

- [ ] **Step 2: Extend `resetProduct` and add an account-tab handler**

Change `resetProduct` (line 152-159) to also clear the account selection:
```js
  const resetProduct = () => {
    setSelectedCard(null);
    setSelectedLoan(null);
    setSelectedAccount(null);
    setSelectedAccountType(null);
    setSelectedBracket(null);
    setSelectedBankId(null);
    setSelectedLoanGroup(null);
    form.resetFields(['bank', 'cardProduct', 'loanProduct', 'loanAmount', 'loanType', 'loanGroup', 'salaryBracket', 'accountProduct', 'accountType']);
  };
```

Change `selectProductTab` (line 164-173) to handle the new `'account'` tab:
```js
  const selectProductTab = (tab) => {
    if (tab === 'credit_card') {
      setProductType('credit_card');
      resetProduct();
      return;
    }
    if (tab === 'account') {
      setProductType('account');
      resetProduct();
      return;
    }
    setProductType('loan');
    resetProduct();
    setSelectedLoanGroup(tab === 'loan_business' ? 'business' : 'personal');
  };
```

Change `activeTab` (line 175-179) to recognize it:
```js
  const activeTab = productType === 'credit_card'
    ? 'credit_card'
    : productType === 'account'
    ? 'account'
    : selectedLoanGroup === 'business' ? 'loan_business'
    : selectedLoanGroup === 'personal' ? 'loan_personal'
    : null;
```

- [ ] **Step 3: Add an `onAccountSelect` handler and account-type filtering**

Next to `onLoanSelect` (line 220-224), add:
```js
  const onAccountSelect = (id) => {
    const account = accountProducts.find((a) => a._id === id) || null;
    setSelectedAccount(account);
    autoSelectMinBracket(account?.commissionBrackets);
  };
```

- [ ] **Step 4: Add the 4th segmented button**

In the segmented-control options array (line 392-395), add a 4th entry:
```js
                  {[
                    { value: 'credit_card',   label: 'Credit Card',   icon: <CreditCardOutlined />, activeColor: '#7C3AED', activeBg: '#f3e8ff', activeBorder: '#7C3AED' },
                    { value: 'loan_personal', label: 'Personal Loan', icon: <BankOutlined />,       activeColor: '#15803d', activeBg: '#f0fdf4', activeBorder: '#22c55e' },
                    { value: 'loan_business', label: 'Business Loan', icon: <BankOutlined />,       activeColor: '#b45309', activeBg: '#fffbeb', activeBorder: '#f59e0b' },
                    { value: 'account',       label: 'Account',       icon: <BankOutlined />,       activeColor: '#0e7490', activeBg: '#ecfeff', activeBorder: '#06b6d4' },
                  ].map((opt) => {
```
(The rest of that `.map()` block — the button rendering — is unchanged; it already works generically off this array.)

- [ ] **Step 5: Add the account-category selector + product dropdown**

Find the loan-only block that starts `{productType === 'loan' && (` (line 476) and ends at line 522. Directly after its closing `)}` (line 522), add a new sibling block:
```jsx
              {productType === 'account' && (
                <>
                  <Form.Item name="accountType" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Account Type <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select account type' }]} style={{ marginBottom: 10 }}>
                    <Select
                      size="middle"
                      placeholder="Select account type"
                      options={[
                        { value: 'business_account', label: 'Business Account' },
                        { value: 'current_account',   label: 'Current Account' },
                        { value: 'savings_account',   label: 'Saving Account' },
                      ]}
                      onChange={(v) => { setSelectedAccountType(v); setSelectedAccount(null); setSelectedBracket(null); form.resetFields(['accountProduct', 'salaryBracket']); }}
                    />
                  </Form.Item>
                  {selectedAccountType && (
                    <Form.Item name="accountProduct" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Account Product <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select an account product' }]} style={{ marginBottom: 10 }}>
                      <Select
                        size="middle"
                        placeholder="Select account product"
                        showSearch
                        filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                        options={accountProducts
                          .filter((a) => `${selectedAccountType}` === `${a.accountCategory}_account`)
                          .map((a) => ({ value: a._id, label: `${a.name} — ${a.bank?.name || ''}` }))}
                        onChange={onAccountSelect}
                      />
                    </Form.Item>
                  )}
                  {selectedBracket && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Estimated Payout</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>AED {selectedBracket.payable}</span>
                    </div>
                  )}
                </>
              )}
```

- [ ] **Step 6: Add the submit payload branch**

Find the submit handler's payload assembly (around line 264-268):
```js
      if (productType === 'credit_card') payload.cardProduct = values.cardProduct;
      if (productType === 'loan') {
        payload.loanProduct = values.loanProduct;
        ...
        if (values.loanType) payload.loanType = values.loanType;
      }
```
Add directly after that block:
```js
      if (productType === 'account') {
        payload.accountProduct = values.accountProduct;
        if (values.accountType) payload.accountType = values.accountType;
      }
```

- [ ] **Step 7: Verify — lint**

Run: `cd frontend && npx eslint src/pages/agent/SubmitLead.jsx`
Expected: no new errors.

- [ ] **Step 8: Verify — manual walkthrough**

In the browser (agent-role login required — switch users if the current session is admin):
1. Go to Submit Lead; confirm a 4th "Account" tab button appears.
2. Click it; confirm the Credit Card / Loan fields disappear and an "Account Type" dropdown appears.
3. Pick "Business Account"; confirm the Account Product dropdown populates with only the business-category `AccountProduct` created in Task 4's walkthrough (create one of each category first if needed to test all three).
4. Pick a product; confirm the estimated payout box appears with the flat AED amount from its lowest bracket.
5. Fill in the remaining required fields (customer name, phone) and submit; confirm the lead is created without error.
6. As admin, open All Leads, find the new lead, confirm `productType: account` and the right `accountType`/`accountProduct` show in its detail view (raw JSON via network tab is fine if the detail UI doesn't render account fields yet — that's expected, out of scope here).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/agent/SubmitLead.jsx
git commit -m "Add Account tab to agent lead submission form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
