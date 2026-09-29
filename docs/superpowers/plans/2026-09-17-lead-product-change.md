# Lead Product Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Super Admin, Sub Admin, Leads Admin, an Agency owner, and Agency Coordinator/Sales employees change the product (card/loan/account) on an already-submitted lead, with the payout automatically recalculated and a history entry logged.

**Architecture:** New `PATCH /api/leads/:id/product` endpoint on the existing `lead.controller.js`, modeled directly on the existing `updateLoanAmount` handler (same lock-point, same recompute-via-`commissionService` pattern), plus a new `productHistory` array on `Lead` and a new `product_changed` notification type. Frontend adds a "Change Product" button + modal to the existing `LeadDetail.jsx` three-block Actions UI (Agency/Admin/Employee), reusing the bank→product cascading-select pattern already used in `SubmitLead.jsx`.

**Tech Stack:** Node/Express/Mongoose (backend), React/Ant Design (frontend). No automated test framework in this repo — verify backend logic via `node -e` sanity checks and a direct-script functional walk that calls the controller function directly against real DB records (mirrors `docs/superpowers/plans/2026-09-12-loan-subtype-milestones.md`'s verification style), and verify frontend via lint + manual browser walkthrough against the already-running dev servers.

**Spec:** `docs/superpowers/specs/2026-09-17-lead-product-change-design.md`

## Global Constraints

- Same category only: a card lead can only move to another card product, a loan lead to another loan product, an account lead to another account product. `lead.productType` itself never changes.
- Bank can change: picking a new bank + a same-category product replaces `lead.bank` and the product ref together.
- Lock point: allowed while `lead.status` is `submitted`, `under_review`, `assigned`, or `approved`. Blocked once `disbursed`.
- Permission matrix (exact, from the spec):
  - `role === 'admin'` with `adminScope` in `[null, 'coordinator', 'leads']` — allowed (Product/Finance-scoped admins excluded).
  - `role === 'agency'` — allowed on the agency's own leads (`lead.agency === req.user._id`).
  - `role === 'employee'`, `employeeType === 'coordinator'` — allowed, agency-wide.
  - `role === 'employee'`, `employeeType === 'sales'` — allowed only if `lead.assignedSalesEmployee === req.user._id`.
  - Everything else (Product/Finance admin, Account-Access employee, CPV employee, agent, any Sales employee not assigned to that lead) — 403.
- Every product change appends a `productHistory` entry (who/when/from/to, as name snapshots, not refs) and notifies the lead's agent.

---

### Task 1: Backend — `productHistory` field on `Lead` + `product_changed` notification type

**Files:**
- Modify: `backend/models/Lead.js` (after the `statusHistory` array, lines 179-187)
- Modify: `backend/models/Notification.js` (the `type` enum, lines 6-19)

**Interfaces:**
- Produces: `Lead.productHistory` — array of `{ changedBy, changedAt, fromBankName, fromProductName, toBankName, toProductName }`. Consumed by Task 2 (controller pushes entries) and Task 4 (frontend renders them). `Notification` now accepts `type: 'product_changed'` — consumed by Task 2.

- [ ] **Step 1: Add `productHistory` to the Lead schema**

In `backend/models/Lead.js`, directly after the closing of `statusHistory` (lines 179-187):
```js
    statusHistory: [
      {
        status: { type: String },
        note: { type: String, trim: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
```
add:
```js
    productHistory: [
      {
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        fromBankName: { type: String },
        fromProductName: { type: String },
        toBankName: { type: String },
        toProductName: { type: String },
        _id: false,
      },
    ],
```

- [ ] **Step 2: Add `product_changed` to the Notification type enum**

In `backend/models/Notification.js`, the `type` enum currently reads:
```js
      enum: [
        'lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable', 'cpv_done', 'activate_done', 'agency_payout_submitted', 'commission_paid',
```
Change to:
```js
      enum: [
        'lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable', 'cpv_done', 'activate_done', 'agency_payout_submitted', 'commission_paid', 'product_changed',
```

- [ ] **Step 3: Verify — models load cleanly**

Run:
```bash
cd backend && node -e "const Lead = require('./models/Lead'); const Notification = require('./models/Notification'); console.log('productHistory path:', !!Lead.schema.path('productHistory')); console.log('product_changed in enum:', Notification.schema.path('type').enumValues.includes('product_changed'));"
```
Expected:
```
productHistory path: true
product_changed in enum: true
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/Lead.js backend/models/Notification.js
git commit -m "Add productHistory field to Lead and product_changed notification type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — `updateProduct` controller + route + `getOne` populate

**Files:**
- Modify: `backend/controllers/lead.controller.js` (add `exports.updateProduct` after `exports.updateLoanAmount`, which ends at line 563; add one `.populate(...)` line inside `exports.getOne`, around line 2223)
- Modify: `backend/routes/lead.routes.js` (add one route line after line 39)

**Interfaces:**
- Consumes: `Lead.productHistory` and `Notification`'s `product_changed` type (Task 1); `commissionService.resolveCommissions(lead)` (`backend/services/commission.service.js:33`, returns `{ receivable, payable }`); `createAndEmit(recipientIds, { type, title, body, lead }, actorId)` (`backend/utils/notify.js:14`); `resolveAgencyId(user)` (`backend/middleware/auth.middleware.js:42`).
- Produces: `PATCH /api/leads/:id/product` with body `{ bank, productId }` — consumed by Task 4 (frontend modal).

- [ ] **Step 1: Add `exports.updateProduct`**

In `backend/controllers/lead.controller.js`, directly after `exports.updateLoanAmount`'s closing `};` (line 563), add:

```js

/**
 * PATCH /api/leads/:id/product  (agency/employee/admin)
 * Change the product (and/or bank) on an already-submitted lead, within
 * the same category (card/loan/account), and recompute payout.
 * Body: { bank, productId }
 */
exports.updateProduct = async (req, res) => {
  try {
    const { bank, productId } = req.body;
    if (!bank || !productId) {
      return res.status(400).json({ message: 'bank and productId are required' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    let allowed = false;
    if (req.user.role === 'admin') {
      allowed = [null, 'coordinator', 'leads'].includes(req.user.adminScope);
    } else if (req.user.role === 'agency') {
      allowed = String(lead.agency) === String(req.user._id);
    } else if (req.user.role === 'employee' && req.user.employeeType === 'coordinator') {
      allowed = String(lead.agency) === String(resolveAgencyId(req.user));
    } else if (req.user.role === 'employee' && req.user.employeeType === 'sales') {
      allowed = String(lead.assignedSalesEmployee) === String(req.user._id);
    }
    if (!allowed) return res.status(403).json({ message: 'Forbidden' });

    const preLockStatuses = ['submitted', 'under_review', 'assigned', 'approved'];
    if (!preLockStatuses.includes(lead.status)) {
      return res.status(400).json({ message: 'Product can only be changed before disbursement' });
    }

    const productField = { credit_card: 'cardProduct', loan: 'loanProduct', account: 'accountProduct' }[lead.productType];
    const ProductModel = { credit_card: CardProduct, loan: LoanProduct, account: AccountProduct }[lead.productType];
    if (!productField || !ProductModel) {
      return res.status(400).json({ message: 'This lead has no product category to change' });
    }

    const newProduct = await ProductModel.findById(productId);
    if (!newProduct) return res.status(404).json({ message: 'Product not found' });
    if (newProduct.assignedAgencies?.length && !newProduct.assignedAgencies.some((a) => String(a) === String(lead.agency))) {
      return res.status(400).json({ message: 'This product is not available to your agency' });
    }

    const newBank = await Bank.findById(bank);
    if (!newBank) return res.status(404).json({ message: 'Bank not found' });

    const oldBank = await Bank.findById(lead.bank).select('name');
    const oldProduct = await ProductModel.findById(lead[productField]).select('name');

    lead.productHistory.push({
      changedBy: req.user._id,
      fromBankName: oldBank?.name || '',
      fromProductName: oldProduct?.name || '',
      toBankName: newBank.name,
      toProductName: newProduct.name,
    });

    lead.bank = newBank._id;
    lead[productField] = newProduct._id;

    const { receivable, payable } = await commissionService.resolveCommissions(lead);
    lead.grossCommission = receivable;
    lead.commission = payable;

    await lead.save();

    const populated = await lead.populate([...POPULATE_FIELDS, { path: 'productHistory.changedBy', select: 'name email' }]);

    try {
      await createAndEmit(
        [String(populated.agent?._id || populated.agent)],
        {
          type: 'product_changed',
          title: 'Product Changed',
          body: `${lead.customerName} — ${oldProduct?.name || 'product'} → ${newProduct.name}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

Note: passing `productId` only into `ProductModel.findById` (which is already scoped to the lead's own `productType`) means there is no way to submit a cross-category product through this endpoint — the category check is structural, not a separate runtime guard.

- [ ] **Step 2: Add the route**

In `backend/routes/lead.routes.js`, directly after line 39:
```js
router.patch('/:id/loan-amount', requireRole('agency', 'employee', 'admin'), ctrl.updateLoanAmount);
```
add:
```js
router.patch('/:id/product', requireRole('agency', 'employee', 'admin'), ctrl.updateProduct);
```

- [ ] **Step 3: Populate `productHistory.changedBy` in `getOne`**

In `backend/controllers/lead.controller.js`, inside `exports.getOne` (around line 2223), the populate chain currently ends:
```js
      .populate('statusHistory.changedBy', 'name email')
      .populate('leadNotes.author', 'name email employeeId')
```
Change to:
```js
      .populate('statusHistory.changedBy', 'name email')
      .populate('productHistory.changedBy', 'name email')
      .populate('leadNotes.author', 'name email employeeId')
```

- [ ] **Step 4: Verify — syntax**

Run:
```bash
cd backend && node -c controllers/lead.controller.js && node -c routes/lead.routes.js && echo OK
```
Expected: `OK` with no errors.

- [ ] **Step 5: Verify — functional walk via direct controller call**

Write `backend/verify-product-change.js`:
```js
require('dotenv').config();
const mongoose = require('mongoose');
const Bank = require('./models/Bank');
const User = require('./models/User');
const CardProduct = require('./models/CardProduct');
const Lead = require('./models/Lead');
const ctrl = require('./controllers/lead.controller');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const bank = await Bank.findOne({ isActive: true });
  const agency = await User.findOne({ role: 'agency' });
  const agent = await User.findOne({ role: 'agent' });
  if (!bank || !agency || !agent) {
    throw new Error('Need at least one active bank, one agency, and one agent to test with');
  }
  const cards = await CardProduct.find({ bank: bank._id, isActive: true }).limit(2);
  if (cards.length < 2) {
    throw new Error('Need at least 2 active card products on the same bank to test a product change');
  }
  const [cardA, cardB] = cards;

  const lead = await Lead.create({
    customerName: 'TEST Product Change',
    phone: '971500000001',
    productType: 'credit_card',
    bank: bank._id,
    cardProduct: cardA._id,
    customerSalary: 10000,
    status: 'submitted',
    agent: agent._id,
    agency: agency._id,
  });

  // Happy path: agency owner changes the product.
  const okRes = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.updateProduct(
    { params: { id: String(lead._id) }, body: { bank: String(bank._id), productId: String(cardB._id) }, user: agency },
    okRes,
  );
  if (okRes._code) throw new Error(`FAIL: expected 200, got ${okRes._code}: ${JSON.stringify(okRes._body)}`);

  const reloaded = await Lead.findById(lead._id);
  const productChanged = String(reloaded.cardProduct) === String(cardB._id);
  const historyLogged = reloaded.productHistory.length === 1
    && reloaded.productHistory[0].fromProductName === cardA.name
    && reloaded.productHistory[0].toProductName === cardB.name;
  console.log('Product changed:', productChanged);
  console.log('History logged:', historyLogged);
  console.log('Commission recomputed (gross/payable):', reloaded.grossCommission, reloaded.commission);
  if (!productChanged || !historyLogged) throw new Error('FAIL: product change or history log did not persist correctly');
  console.log('PASS: updateProduct works end to end for an agency owner');

  // Permission check: a plain agent must be rejected with 403.
  const forbiddenRes = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.updateProduct(
    { params: { id: String(lead._id) }, body: { bank: String(bank._id), productId: String(cardA._id) }, user: agent },
    forbiddenRes,
  );
  console.log('Agent role rejected with status:', forbiddenRes._code);
  if (forbiddenRes._code !== 403) throw new Error('FAIL: agent role should be forbidden (403)');
  console.log('PASS: unauthorized role correctly rejected');

  await Lead.findByIdAndDelete(lead._id);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `cd backend && node verify-product-change.js`
Expected:
```
Product changed: true
History logged: true
Commission recomputed (gross/payable): <numbers>
PASS: updateProduct works end to end for an agency owner
Agent role rejected with status: 403
PASS: unauthorized role correctly rejected
```
If it throws "Need at least..." instead, seed the missing data (an active bank with 2+ active card products, at least one agency and one agent user) in the dev database first, then re-run.

Then delete the scratch file: `rm backend/verify-product-change.js`.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/lead.controller.js backend/routes/lead.routes.js
git commit -m "Add PATCH /leads/:id/product endpoint to change a lead's product and recompute payout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — let Coordinator/Sales employees read the product catalogues

**Files:**
- Modify: `backend/routes/cardProduct.routes.js:9`
- Modify: `backend/routes/loanProduct.routes.js:8`
- Modify: `backend/routes/accountProduct.routes.js:8`

**Interfaces:**
- Produces: `GET /card-products`, `GET /loan-products`, `GET /account-products` now also accessible to `role === 'employee'` — consumed by Task 4 (the Change Product modal's catalogue fetch, needed so Coordinator/Sales employees can populate the picker). Each controller's `list` handler is already employee-aware (uses `resolveAgencyId(req.user)` for agency-scoped visibility) — only the route guard is being widened here.

- [ ] **Step 1: Widen the three route guards**

In `backend/routes/cardProduct.routes.js`, line 9:
```js
router.get('/', requireRole('admin', 'agent', 'agency'), ctrl.list);
```
change to:
```js
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);
```

In `backend/routes/loanProduct.routes.js`, line 8, same change:
```js
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);
```

In `backend/routes/accountProduct.routes.js`, line 8, same change:
```js
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);
```

- [ ] **Step 2: Verify — routes load cleanly**

Run:
```bash
cd backend && node -e "require('./routes/cardProduct.routes.js'); require('./routes/loanProduct.routes.js'); require('./routes/accountProduct.routes.js'); console.log('Routes OK')"
```
Expected: `Routes OK` with no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/cardProduct.routes.js backend/routes/loanProduct.routes.js backend/routes/accountProduct.routes.js
git commit -m "Let agency employees read the card/loan/account product catalogues

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — "Change Product" button, modal, and Product History section

**Files:**
- Modify: `frontend/src/pages/leads/LeadDetail.jsx`

**Interfaces:**
- Consumes: `PATCH /leads/:id/product` (Task 2), `GET /card-products` / `/loan-products` / `/account-products` (Task 3, now employee-accessible), `lead.productHistory` (Task 1).
- Produces: nothing consumed elsewhere — this is the final UI surface for the feature.

- [ ] **Step 1: Add the `SwapOutlined` icon import**

Change the icon import block (lines 8-11):
```js
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileOutlined, DollarOutlined, ThunderboltOutlined,
  PaperClipOutlined, UploadOutlined, SendOutlined,
} from '@ant-design/icons';
```
to:
```js
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileOutlined, DollarOutlined, ThunderboltOutlined,
  PaperClipOutlined, UploadOutlined, SendOutlined, SwapOutlined,
} from '@ant-design/icons';
```

- [ ] **Step 2: Add state hooks for the Change Product modal**

Directly after the loan-amount state hooks (line 179-180):
```js
  const [loanOpen, setLoanOpen]       = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, status: null, label: '' });
  const [loanForm]                    = Form.useForm();
```
add, right after `const [loanForm] = Form.useForm();`:
```js
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm]                 = Form.useForm();
  const [productSaving, setProductSaving] = useState(false);
  const [productCatalogue, setProductCatalogue] = useState([]);
  const [productCatalogueLoading, setProductCatalogueLoading] = useState(false);
  const [selectedProductBankId, setSelectedProductBankId] = useState(null);
```

- [ ] **Step 3: Add the open/save handlers**

Directly after `saveLoanAmount` (lines 269-279):
```js
  const saveLoanAmount = async () => {
    const { loanAmount } = await loanForm.validateFields();
    try {
      await api.patch(`/leads/${id}/loan-amount`, { loanAmount });
      message.success('Loan amount updated');
      setLoanOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };
```
add:
```js

  const openProductModal = () => {
    productForm.resetFields();
    setSelectedProductBankId(null);
    setProductModalOpen(true);
    setProductCatalogueLoading(true);
    const endpoint = lead.productType === 'credit_card' ? '/card-products'
      : lead.productType === 'loan' ? '/loan-products'
      : '/account-products';
    api.get(endpoint)
      .then((res) => setProductCatalogue(res.data.filter((p) => p.isActive)))
      .catch(() => setProductCatalogue([]))
      .finally(() => setProductCatalogueLoading(false));
  };

  const onProductBankChange = (bankId) => {
    setSelectedProductBankId(bankId);
    productForm.resetFields(['productId']);
  };

  const saveProductChange = async () => {
    const { bank, productId } = await productForm.validateFields();
    setProductSaving(true);
    try {
      await api.patch(`/leads/${id}/product`, { bank, productId });
      message.success('Product updated');
      setProductModalOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    } finally {
      setProductSaving(false);
    }
  };
```

- [ ] **Step 4: Add the permission/lock gate and derived select options**

Directly after the `product` derived variable (line 475):
```js
  const isLoan = lead.productType === 'loan';
  const product = isLoan ? lead.loanProduct : lead.cardProduct;
```
add:
```js
  const canChangeProduct = (() => {
    if (!LOAN_EDITABLE_FROM.includes(lead.status)) return false;
    if (role === 'admin') return [null, 'coordinator', 'leads'].includes(user.adminScope);
    if (role === 'agency') return true;
    if (role === 'employee' && user.employeeType === 'coordinator') return true;
    if (role === 'employee' && user.employeeType === 'sales') {
      return String(lead.assignedSalesEmployee?._id || lead.assignedSalesEmployee || '') === String(user.id);
    }
    return false;
  })();

  const productBankOptions = (() => {
    const seen = new Set();
    return productCatalogue
      .filter((p) => p.bank?._id)
      .reduce((acc, p) => {
        if (!seen.has(p.bank._id)) { seen.add(p.bank._id); acc.push({ value: p.bank._id, label: p.bank.name }); }
        return acc;
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  const productOptions = productCatalogue
    .filter((p) => !selectedProductBankId || p.bank?._id === selectedProductBankId)
    .map((p) => ({ value: p._id, label: p.name }));
```

Note: `LOAN_EDITABLE_FROM` (line 67, `['submitted', 'under_review', 'assigned', 'approved']`) is reused as-is for the lock point — the spec confirms the same lock list applies to product changes, so this avoids a duplicate constant. `canChangeProduct` is computed once and used in all three Actions blocks below (simpler than repeating the role/scope logic three times, and it already re-derives `role` internally so it's still correct when read from within each role-gated block).

- [ ] **Step 5: Add the "Change Product" button to all three Actions blocks**

In the **Agency Actions** block, directly after the Edit Loan Amount button (lines 905-907):
```js
                {isLoan && LOAN_EDITABLE_FROM.includes(lead.status) && (
                  <Button block size="small" icon={<EditOutlined />} onClick={() => { loanForm.setFieldsValue({ loanAmount: lead.loanAmount }); setLoanOpen(true); }}>Edit Loan Amount</Button>
                )}
```
add:
```js
                {canChangeProduct && (
                  <Button block size="small" icon={<SwapOutlined />} onClick={openProductModal}>Change Product</Button>
                )}
```

In the **Admin Actions** block, directly after its own Edit Loan Amount button (lines 937-939):
```js
                {isLoan && LOAN_EDITABLE_FROM.includes(lead.status) && (
                  <Button block size="small" icon={<EditOutlined />} onClick={() => { loanForm.setFieldsValue({ loanAmount: lead.loanAmount }); setLoanOpen(true); }}>Edit Loan Amount</Button>
                )}
```
add the same block:
```js
                {canChangeProduct && (
                  <Button block size="small" icon={<SwapOutlined />} onClick={openProductModal}>Change Product</Button>
                )}
```

In the **Employee Actions** block, directly after its own Edit Loan Amount button (lines 990-992):
```js
                  {hasFullAccess && isLoan && LOAN_EDITABLE_FROM.includes(lead.status) && (
                    <Button block size="small" icon={<EditOutlined />} onClick={() => { loanForm.setFieldsValue({ loanAmount: lead.loanAmount }); setLoanOpen(true); }}>Edit Loan Amount</Button>
                  )}
```
add:
```js
                  {canChangeProduct && (
                    <Button block size="small" icon={<SwapOutlined />} onClick={openProductModal}>Change Product</Button>
                  )}
```
(Indentation in the Employee block is one level deeper than Agency/Admin, matching its surrounding `Edit Loan Amount` button exactly.)

- [ ] **Step 6: Add the Product History section**

Directly after the Status History section's closing (line 661, right before the `{/* Remarks ... */}` comment):
```js
          {/* Status History */}
          {lead.statusHistory?.length > 0 && (
            <Card size="small" title={sectionLabel('Status History')} style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
              ...
            </Card>
          )}

          {/* Remarks — admin, agency, sales employee only */}
```
add a new block between them:
```js
          {/* Status History */}
          {lead.statusHistory?.length > 0 && (
            <Card size="small" title={sectionLabel('Status History')} style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
              ...
            </Card>
          )}

          {/* Product History */}
          {lead.productHistory?.length > 0 && (
            <Card size="small" title={sectionLabel('Product History')} style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
              <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                <Timeline
                  style={{ marginTop: 8 }}
                  items={[...lead.productHistory].reverse().map((h) => ({
                    color: 'purple',
                    children: (
                      <div style={{ paddingBottom: 2 }}>
                        <div style={{ fontSize: 12, color: '#0f172a' }}>
                          {h.fromBankName} — {h.fromProductName} → {h.toBankName} — {h.toProductName}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                          {new Date(h.changedAt).toLocaleString()}
                          {role !== 'agent' && h.changedBy && ` · ${h.changedBy.name || h.changedBy.email}`}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </div>
            </Card>
          )}

          {/* Remarks — admin, agency, sales employee only */}
```

- [ ] **Step 7: Add the Change Product modal**

Directly after the "Loan amount modal" (lines 1213-1224):
```js
      {/* Loan amount modal */}
      <Modal title="Edit Loan Amount" open={loanOpen} onCancel={() => setLoanOpen(false)} onOk={saveLoanAmount} okText="Save" destroyOnClose>
        <Descriptions size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Client">{lead.customerName}</Descriptions.Item>
          <Descriptions.Item label="Product">{lead.loanProduct?.name}</Descriptions.Item>
        </Descriptions>
        <Form form={loanForm} layout="vertical">
          <Form.Item name="loanAmount" label="Loan Amount (AED)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
```
add:
```js

      {/* Change Product modal */}
      <Modal title="Change Product" open={productModalOpen} onCancel={() => setProductModalOpen(false)} onOk={saveProductChange} okText="Save" confirmLoading={productSaving} destroyOnClose>
        <Descriptions size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Client">{lead.customerName}</Descriptions.Item>
          <Descriptions.Item label="Current Product">{product?.name || '—'}</Descriptions.Item>
        </Descriptions>
        <Form form={productForm} layout="vertical">
          <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Select a bank' }]}>
            <Select
              showSearch
              allowClear
              placeholder="Select bank"
              loading={productCatalogueLoading}
              options={productBankOptions}
              onChange={onProductBankChange}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="productId" label="Product" rules={[{ required: true, message: 'Select a product' }]}>
            <Select
              showSearch
              disabled={!selectedProductBankId}
              placeholder={selectedProductBankId ? 'Select product' : 'Select a bank first'}
              loading={productCatalogueLoading}
              options={productOptions}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        </Form>
      </Modal>
```

- [ ] **Step 8: Verify — lint**

Run: `cd frontend && npx eslint src/pages/leads/LeadDetail.jsx`
Expected: no new errors (pre-existing errors/warnings in this file, if any, are unrelated and unchanged).

- [ ] **Step 9: Verify — build**

Run: `cd frontend && npx vite build`
Expected: build succeeds (`✓ built in ...`).

- [ ] **Step 10: Verify — manual walkthrough**

Against the running dev servers:
1. As the agency owner, open a `submitted` credit-card lead, click "Change Product," pick a different bank and card, save. Confirm: the lead's product/bank update on the detail page, a "Product History" card appears showing the from→to change, and (as that lead's agent) the agent's Commissions page / Dashboard stat tiles / MyLeads row show the new payout amount.
2. As a Coordinator employee of the same agency, open a different submitted lead and confirm the same button/flow works.
3. As a Sales employee, confirm the button only appears on leads where `assignedSalesEmployee` is them — not on other leads.
4. As an Account-Access or CPV employee, confirm the button never appears.
5. As Super Admin, confirm the button appears on any lead. As a Product-scoped or Finance-scoped admin account, confirm it does not.
6. Move a lead to `disbursed`, confirm the button disappears there (and, calling `PATCH /leads/:id/product` directly with a tool like curl/Postman against that lead's id, confirm it 400s).
7. Confirm the lead's agent receives a notification when the product changes.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/leads/LeadDetail.jsx
git commit -m "Add Change Product button, modal, and Product History to lead detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
