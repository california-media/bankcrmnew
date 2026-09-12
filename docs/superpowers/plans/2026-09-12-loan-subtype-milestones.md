# Loan Sub-type Milestone Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the POS Loan / Car Loan / Mortgage (New + Buyout) categories to the Loan Products catalog, and give each — plus the 3 Account flows from the companion plan — their specified milestone-based approval flow, matching the existing pdc/buyout/sme/pos_loan_non_bank convention exactly.

**Architecture:** Append new enum values and namespaced boolean/note field pairs to the existing `LoanProduct`/`Lead` models (no existing values touched). Add one new PATCH route + controller handler per milestone, using one small shared handler-factory (new code only — existing hand-written handlers stay as-is) to avoid retyping the same ~25-line block 17 times. Extend `loanActions.js` so the 3 admin/agency/employee lead-list pages that already consume it pick up the new flows with zero changes of their own.

**Tech Stack:** Node/Express/Mongoose (backend), React/Ant Design (frontend). No automated test framework in this repo — verify via `node -e` sanity checks, unauthenticated curl route-presence checks (`401` = route exists, `404` = it doesn't), a direct-script functional walk of the milestone sequences, and manual UI verification against the already-running dev servers (backend `:8000`, frontend `:5175`).

**Spec:** `docs/superpowers/specs/2026-09-12-new-product-categories-design.md` (Sub-project 2, and the milestone-flow table)

**Depends on:** `docs/superpowers/plans/2026-09-12-account-products.md` Task 2 (adds `Lead.accountType`) — the `getLoanActions` change in Task 3 of this plan reads `row.accountType`, so run that plan's Task 2 first (or confirm it's already merged) before starting Task 3 here.

## Global Constraints

- Additive only: every existing enum value, field, route, and `case` in `getLoanActions`/`LOAN_MILESTONES`/`ACTION_LABELS` stays exactly as-is. Nothing renamed or removed.
- `pos_loan` (new) stays fully separate from `pos_loan_non_bank` (existing). `mortgage_buyout` (new) stays fully separate from `buyout` (existing).
- New milestone fields/routes are namespaced per category (e.g. `mortgageBuyoutDocsDone`, not a shared `docsDone`) — matches how `buyoutAccountOpenDone` vs `smeBuyoutAccountOpenDone` are already kept separate in this codebase, even though they mean similar things.

---

### Task 1: Backend — new enum values + milestone fields on `LoanProduct` and `Lead`

**Files:**
- Modify: `backend/models/LoanProduct.js:15`
- Modify: `backend/models/Lead.js:43,120`

**Interfaces:**
- Produces: `LoanProduct.loanCategory` now includes `'pos_loan'`. `Lead.loanType` now includes `pos_loan`, `auto_loan`, `mortgage_new`, `mortgage_buyout`. 17 new boolean/note field pairs on `Lead` (listed below) — consumed by Task 2 (routes/controller) and Task 3 (`loanActions.js`).

- [ ] **Step 1: Add the new loan category**

In `backend/models/LoanProduct.js`, line 15, change:
```js
    loanCategory: { type: String, enum: ['personal', 'mortgage', 'investor', 'business', 'auto_loan', 'buyout', 'fresh', 'pdc', 'stl'], required: true },
```
to:
```js
    loanCategory: { type: String, enum: ['personal', 'mortgage', 'investor', 'business', 'auto_loan', 'buyout', 'fresh', 'pdc', 'stl', 'pos_loan'], required: true },
```

- [ ] **Step 2: Add the new loan types**

In `backend/models/Lead.js`, line 43, change:
```js
    loanType: { type: String, enum: ['buyout', 'pdc', 'new_stl_loan', 'business_loan', 'sme_new_loan', 'sme_buyout_loan', 'pos_loan_non_bank', null], default: null },
```
to:
```js
    loanType: { type: String, enum: ['buyout', 'pdc', 'new_stl_loan', 'business_loan', 'sme_new_loan', 'sme_buyout_loan', 'pos_loan_non_bank', 'pos_loan', 'auto_loan', 'mortgage_new', 'mortgage_buyout', null], default: null },
```

- [ ] **Step 3: Add the milestone fields**

In `backend/models/Lead.js`, directly after line 120 (`posDdaNote: { type: String, trim: true },`) and before line 121 (`agencyPaymentStatus: ...`), add:
```js
    // POS Loan milestone (new — distinct from pos_loan_non_bank above)
    posLoanAccountOpenDone: { type: Boolean, default: false },
    posLoanAccountOpenNote: { type: String, trim: true },
    // Car Loan milestone
    carLoanRegistrationDone: { type: Boolean, default: false },
    carLoanRegistrationNote: { type: String, trim: true },
    // Mortgage New Loan milestones (sequential)
    mortgageNewDocsDone: { type: Boolean, default: false },
    mortgageNewDocsNote: { type: String, trim: true },
    mortgageNewEvaluationDone: { type: Boolean, default: false },
    mortgageNewEvaluationNote: { type: String, trim: true },
    mortgageNewRegistrationDone: { type: Boolean, default: false },
    mortgageNewRegistrationNote: { type: String, trim: true },
    // Mortgage Buyout Loan milestones (sequential, distinct from the generic buyout fields above)
    mortgageBuyoutDocsDone: { type: Boolean, default: false },
    mortgageBuyoutDocsNote: { type: String, trim: true },
    mortgageBuyoutEvaluationDone: { type: Boolean, default: false },
    mortgageBuyoutEvaluationNote: { type: String, trim: true },
    mortgageBuyoutLlDone: { type: Boolean, default: false },
    mortgageBuyoutLlNote: { type: String, trim: true },
    mortgageBuyoutMcDone: { type: Boolean, default: false },
    mortgageBuyoutMcNote: { type: String, trim: true },
    mortgageBuyoutClDone: { type: Boolean, default: false },
    mortgageBuyoutClNote: { type: String, trim: true },
    mortgageBuyoutRegistrationDone: { type: Boolean, default: false },
    mortgageBuyoutRegistrationNote: { type: String, trim: true },
    // Business Account milestones (either order)
    businessAccountOpenDone: { type: Boolean, default: false },
    businessAccountOpenNote: { type: String, trim: true },
    businessAccountFundCreditedDone: { type: Boolean, default: false },
    businessAccountFundCreditedNote: { type: String, trim: true },
    // Current Account milestones (either order)
    currentAccountOpenDone: { type: Boolean, default: false },
    currentAccountOpenNote: { type: String, trim: true },
    currentAccountSalaryCreditedDone: { type: Boolean, default: false },
    currentAccountSalaryCreditedNote: { type: String, trim: true },
    // Saving Account milestones (sequential)
    savingsAccountOpenDone: { type: Boolean, default: false },
    savingsAccountOpenNote: { type: String, trim: true },
    savingsFundCreditedDone: { type: Boolean, default: false },
    savingsFundCreditedNote: { type: String, trim: true },
```

- [ ] **Step 4: Verify — models load cleanly**

Run:
```bash
cd backend && node -e "require('./models/LoanProduct'); require('./models/Lead'); console.log('Models OK')"
```
Expected: prints `Models OK` with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/models/LoanProduct.js backend/models/Lead.js
git commit -m "Add pos_loan/auto_loan/mortgage_new/mortgage_buyout enums and milestone fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — 17 new milestone routes + controller handlers

**Files:**
- Modify: `backend/controllers/lead.controller.js` (add a shared handler factory + 17 exports, after `exports.updatePosDda` at line 1057)
- Modify: `backend/routes/lead.routes.js` (add 17 routes, after line 57 `pos-dda`)

**Interfaces:**
- Consumes: the 17 field pairs from Task 1.
- Produces: `PATCH /api/leads/:id/<segment>` for each of the 17 segments listed below — consumed by Task 4 (`loanActions.js` maps `type` → route segment 1:1) and by whatever UI renders the milestone buttons (`LeadDetail.jsx`, `agency/Leads.jsx`, `employee/AssignedLeads.jsx` — unchanged, they call generic action buttons off `getLoanActions()`).

- [ ] **Step 1: Add the shared handler factory + 17 handlers**

In `backend/controllers/lead.controller.js`, directly after `exports.updatePosDda`'s closing `};` (line 1057), add:

```js

// Shared factory for simple boolean-milestone endpoints (find lead by
// ownership -> set the done/note fields -> log statusHistory -> notify).
// Existing hand-written handlers above (updateBuyoutAccountOpen etc.) are
// untouched; this only avoids repeating the same block for new milestones.
function makeMilestoneHandler({ doneField, noteField, statusLabel, notifTitle, notifVerb }) {
  return async (req, res) => {
    try {
      let lead;
      if (req.user.role === 'employee') {
        const empId = req.user._id;
        lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
      } else {
        lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
      }
      if (!lead) return res.status(404).json({ message: 'Lead not found' });
      lead[doneField] = true;
      const note = req.body.note ? String(req.body.note).trim() : undefined;
      if (note) lead[noteField] = note;
      lead.statusHistory.push({ status: statusLabel, note, changedBy: req.user._id, changedAt: new Date() });
      await lead.save();
      const populated = await lead.populate(POPULATE_FIELDS);
      try {
        const adminIds = await getAdminIds();
        const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
        await createAndEmit(
          recipients,
          { type: statusLabel, title: notifTitle, body: `${lead.customerName} — ${notifVerb}`, lead: lead._id },
          req.user._id,
        );
      } catch (_) {}
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
}

exports.updatePosLoanAccountOpen = makeMilestoneHandler({ doneField: 'posLoanAccountOpenDone', noteField: 'posLoanAccountOpenNote', statusLabel: 'pos_loan_account_open_done', notifTitle: 'Account Open Completed', notifVerb: 'Account Open completed' });
exports.updateCarLoanRegistration = makeMilestoneHandler({ doneField: 'carLoanRegistrationDone', noteField: 'carLoanRegistrationNote', statusLabel: 'car_loan_registration_done', notifTitle: 'Car Registration Completed', notifVerb: 'Car Registration completed' });
exports.updateMortgageNewDocs = makeMilestoneHandler({ doneField: 'mortgageNewDocsDone', noteField: 'mortgageNewDocsNote', statusLabel: 'mortgage_new_docs_done', notifTitle: 'Property Mortgage Docs Completed', notifVerb: 'Property Mortgage Docs completed' });
exports.updateMortgageNewEvaluation = makeMilestoneHandler({ doneField: 'mortgageNewEvaluationDone', noteField: 'mortgageNewEvaluationNote', statusLabel: 'mortgage_new_evaluation_done', notifTitle: 'Evaluation Completed', notifVerb: 'Evaluation completed' });
exports.updateMortgageNewRegistration = makeMilestoneHandler({ doneField: 'mortgageNewRegistrationDone', noteField: 'mortgageNewRegistrationNote', statusLabel: 'mortgage_new_registration_done', notifTitle: 'Property Registration Completed', notifVerb: 'Property Registration completed' });
exports.updateMortgageBuyoutDocs = makeMilestoneHandler({ doneField: 'mortgageBuyoutDocsDone', noteField: 'mortgageBuyoutDocsNote', statusLabel: 'mortgage_buyout_docs_done', notifTitle: 'Property Mortgage Docs Completed', notifVerb: 'Property Mortgage Docs completed' });
exports.updateMortgageBuyoutEvaluation = makeMilestoneHandler({ doneField: 'mortgageBuyoutEvaluationDone', noteField: 'mortgageBuyoutEvaluationNote', statusLabel: 'mortgage_buyout_evaluation_done', notifTitle: 'Evaluation Completed', notifVerb: 'Evaluation completed' });
exports.updateMortgageBuyoutLl = makeMilestoneHandler({ doneField: 'mortgageBuyoutLlDone', noteField: 'mortgageBuyoutLlNote', statusLabel: 'mortgage_buyout_ll_done', notifTitle: 'LL Completed', notifVerb: 'LL completed' });
exports.updateMortgageBuyoutMc = makeMilestoneHandler({ doneField: 'mortgageBuyoutMcDone', noteField: 'mortgageBuyoutMcNote', statusLabel: 'mortgage_buyout_mc_done', notifTitle: 'MC Completed', notifVerb: 'MC completed' });
exports.updateMortgageBuyoutCl = makeMilestoneHandler({ doneField: 'mortgageBuyoutClDone', noteField: 'mortgageBuyoutClNote', statusLabel: 'mortgage_buyout_cl_done', notifTitle: 'CL Completed', notifVerb: 'CL completed' });
exports.updateMortgageBuyoutRegistration = makeMilestoneHandler({ doneField: 'mortgageBuyoutRegistrationDone', noteField: 'mortgageBuyoutRegistrationNote', statusLabel: 'mortgage_buyout_registration_done', notifTitle: 'Property Registration Completed', notifVerb: 'Property Registration completed' });
exports.updateBusinessAccountOpen = makeMilestoneHandler({ doneField: 'businessAccountOpenDone', noteField: 'businessAccountOpenNote', statusLabel: 'business_account_open_done', notifTitle: 'Account Open Completed', notifVerb: 'Account Open completed' });
exports.updateBusinessAccountFundCredited = makeMilestoneHandler({ doneField: 'businessAccountFundCreditedDone', noteField: 'businessAccountFundCreditedNote', statusLabel: 'business_account_fund_credited_done', notifTitle: 'Fund Credited Completed', notifVerb: 'Fund Credited completed' });
exports.updateCurrentAccountOpen = makeMilestoneHandler({ doneField: 'currentAccountOpenDone', noteField: 'currentAccountOpenNote', statusLabel: 'current_account_open_done', notifTitle: 'Account Open Completed', notifVerb: 'Account Open completed' });
exports.updateCurrentAccountSalaryCredited = makeMilestoneHandler({ doneField: 'currentAccountSalaryCreditedDone', noteField: 'currentAccountSalaryCreditedNote', statusLabel: 'current_account_salary_credited_done', notifTitle: 'Salary Credited Completed', notifVerb: 'Salary Credited completed' });
exports.updateSavingsAccountOpen = makeMilestoneHandler({ doneField: 'savingsAccountOpenDone', noteField: 'savingsAccountOpenNote', statusLabel: 'savings_account_open_done', notifTitle: 'Account Open Completed', notifVerb: 'Account Open completed' });
exports.updateSavingsFundCredited = makeMilestoneHandler({ doneField: 'savingsFundCreditedDone', noteField: 'savingsFundCreditedNote', statusLabel: 'savings_fund_credited_done', notifTitle: 'Fund Credited Completed', notifVerb: 'Fund Credited completed' });
```

- [ ] **Step 2: Add the routes**

In `backend/routes/lead.routes.js`, directly after line 57 (`router.patch('/:id/pos-dda', requireRole('agency', 'employee'), ctrl.updatePosDda);`) and before line 58 (`receipt`), add:
```js
router.patch('/:id/pos-loan-account-open', requireRole('agency', 'employee'), ctrl.updatePosLoanAccountOpen);
router.patch('/:id/car-loan-registration', requireRole('agency', 'employee'), ctrl.updateCarLoanRegistration);
router.patch('/:id/mortgage-new-docs', requireRole('agency', 'employee'), ctrl.updateMortgageNewDocs);
router.patch('/:id/mortgage-new-evaluation', requireRole('agency', 'employee'), ctrl.updateMortgageNewEvaluation);
router.patch('/:id/mortgage-new-registration', requireRole('agency', 'employee'), ctrl.updateMortgageNewRegistration);
router.patch('/:id/mortgage-buyout-docs', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutDocs);
router.patch('/:id/mortgage-buyout-evaluation', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutEvaluation);
router.patch('/:id/mortgage-buyout-ll', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutLl);
router.patch('/:id/mortgage-buyout-mc', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutMc);
router.patch('/:id/mortgage-buyout-cl', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutCl);
router.patch('/:id/mortgage-buyout-registration', requireRole('agency', 'employee'), ctrl.updateMortgageBuyoutRegistration);
router.patch('/:id/business-account-open', requireRole('agency', 'employee'), ctrl.updateBusinessAccountOpen);
router.patch('/:id/business-account-fund-credited', requireRole('agency', 'employee'), ctrl.updateBusinessAccountFundCredited);
router.patch('/:id/current-account-open', requireRole('agency', 'employee'), ctrl.updateCurrentAccountOpen);
router.patch('/:id/current-account-salary-credited', requireRole('agency', 'employee'), ctrl.updateCurrentAccountSalaryCredited);
router.patch('/:id/savings-account-open', requireRole('agency', 'employee'), ctrl.updateSavingsAccountOpen);
router.patch('/:id/savings-fund-credited', requireRole('agency', 'employee'), ctrl.updateSavingsFundCredited);
```

- [ ] **Step 3: Verify — routes are mounted and guarded**

The backend nodemon server auto-restarts on save. After it restarts, run:
```bash
for seg in pos-loan-account-open car-loan-registration mortgage-new-docs mortgage-new-evaluation mortgage-new-registration mortgage-buyout-docs mortgage-buyout-evaluation mortgage-buyout-ll mortgage-buyout-mc mortgage-buyout-cl mortgage-buyout-registration business-account-open business-account-fund-credited current-account-open current-account-salary-credited savings-account-open savings-fund-credited; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "http://localhost:8000/api/leads/000000000000000000000000/$seg")
  echo "$seg -> $code"
done
```
Expected: every line prints `401` (route exists, rejected only for missing auth — a `404` on any line means that route didn't get wired).

- [ ] **Step 4: Verify — direct-script functional walk of one full sequence**

Create a temporary file `backend/verify-mortgage-buyout-flow.js` to exercise the longest new flow end-to-end at the model layer (bypassing HTTP/auth, same rationale as the account-flow check in the companion plan):

```js
require('dotenv').config();
const mongoose = require('mongoose');
const Bank = require('./models/Bank');
const User = require('./models/User');
const Lead = require('./models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const bank = await Bank.findOne({ isActive: true });
  const agent = await User.findOne({ role: 'agent' });
  if (!bank || !agent) throw new Error('Need at least one active bank and one agent user to test with');

  const lead = await Lead.create({
    customerName: 'TEST Mortgage Buyout',
    phone: '971500000000',
    productType: 'loan',
    bank: bank._id,
    loanAmount: 1000000,
    loanType: 'mortgage_buyout',
    status: 'approved',
    agent: agent._id,
    agency: agent._id,
  });

  const steps = [
    'mortgageBuyoutDocsDone', 'mortgageBuyoutEvaluationDone', 'mortgageBuyoutLlDone',
    'mortgageBuyoutMcDone', 'mortgageBuyoutClDone', 'mortgageBuyoutRegistrationDone',
  ];
  for (const field of steps) {
    lead[field] = true;
    await lead.save();
    const allDone = steps.every((f) => lead[field] !== undefined && lead[f]);
  }
  const reloaded = await Lead.findById(lead._id);
  const allSet = steps.every((f) => reloaded[f] === true);
  console.log('All 6 mortgage_buyout milestones set:', allSet);
  if (!allSet) throw new Error('FAIL: not all milestone fields persisted');
  console.log('PASS: mortgage_buyout milestone fields work end to end');

  await Lead.findByIdAndDelete(lead._id);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `cd backend && node verify-mortgage-buyout-flow.js`
Expected: prints `All 6 mortgage_buyout milestones set: true` then `PASS: ...`.

Then delete the scratch file: `rm backend/verify-mortgage-buyout-flow.js`.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/lead.controller.js backend/routes/lead.routes.js
git commit -m "Add milestone routes/handlers for pos_loan, auto_loan, mortgage_new/buyout, and account flows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — extend `loanActions.js` for all 7 new flows

**Files:**
- Modify: `frontend/src/utils/loanActions.js`

**Interfaces:**
- Consumes: `row.loanType` / `row.accountType` (Task 1 here + companion plan Task 2), the 17 route segments (Task 2 here).
- Produces: `getLoanActions(row)` returns the same `{buttons: [{type, label}], canDisburse}` shape for the 7 new flows as it already does for the existing ones — `LeadDetail.jsx`, `agency/Leads.jsx`, and `employee/AssignedLeads.jsx` need no changes since they already call this function generically.

- [ ] **Step 1: Extend `ACTION_LABELS`**

In `frontend/src/utils/loanActions.js`, add to the `ACTION_LABELS` object (after the existing `'pos-dda': 'DDA',` line):
```js
  'pos-loan-account-open': 'Account Open',
  'car-loan-registration': 'Car Registration',
  'mortgage-new-docs': 'Property Mortgage Docs',
  'mortgage-new-evaluation': 'Evaluation',
  'mortgage-new-registration': 'Property Registration',
  'mortgage-buyout-docs': 'Property Mortgage Docs',
  'mortgage-buyout-evaluation': 'Evaluation',
  'mortgage-buyout-ll': 'LL',
  'mortgage-buyout-mc': 'MC',
  'mortgage-buyout-cl': 'CL',
  'mortgage-buyout-registration': 'Property Registration',
  'business-account-open': 'Account Open',
  'business-account-fund-credited': 'Fund Credited',
  'current-account-open': 'Account Open',
  'current-account-salary-credited': 'Salary Credited',
  'savings-account-open': 'Account Open',
  'savings-fund-credited': 'Fund Credited',
```

- [ ] **Step 2: Extend `LOAN_MILESTONES`**

Add these keys to the `LOAN_MILESTONES` object (after the existing `pos_loan_non_bank: [...]` entry):
```js
  pos_loan: [{ field: 'posLoanAccountOpenDone', type: 'pos-loan-account-open' }],
  auto_loan: [{ field: 'carLoanRegistrationDone', type: 'car-loan-registration' }],
  mortgage_new: [
    { field: 'mortgageNewDocsDone', type: 'mortgage-new-docs' },
    { field: 'mortgageNewEvaluationDone', type: 'mortgage-new-evaluation' },
    { field: 'mortgageNewRegistrationDone', type: 'mortgage-new-registration' },
  ],
  mortgage_buyout: [
    { field: 'mortgageBuyoutDocsDone', type: 'mortgage-buyout-docs' },
    { field: 'mortgageBuyoutEvaluationDone', type: 'mortgage-buyout-evaluation' },
    { field: 'mortgageBuyoutLlDone', type: 'mortgage-buyout-ll' },
    { field: 'mortgageBuyoutMcDone', type: 'mortgage-buyout-mc' },
    { field: 'mortgageBuyoutClDone', type: 'mortgage-buyout-cl' },
    { field: 'mortgageBuyoutRegistrationDone', type: 'mortgage-buyout-registration' },
  ],
  business_account: [
    { field: 'businessAccountOpenDone', type: 'business-account-open' },
    { field: 'businessAccountFundCreditedDone', type: 'business-account-fund-credited' },
  ],
  current_account: [
    { field: 'currentAccountOpenDone', type: 'current-account-open' },
    { field: 'currentAccountSalaryCreditedDone', type: 'current-account-salary-credited' },
  ],
  savings_account: [
    { field: 'savingsAccountOpenDone', type: 'savings-account-open' },
    { field: 'savingsFundCreditedDone', type: 'savings-fund-credited' },
  ],
```

- [ ] **Step 3: Extend `getLoanActions`**

Replace the whole function (currently lines 60-108) with:
```js
export function getLoanActions(row) {
  if (row.status !== 'approved') return { buttons: [], canDisburse: false };

  // Account leads use accountType as their flow discriminator, the same
  // role loanType plays for loans — checked first since accountType is
  // only ever set on productType==='account' leads.
  if (row.accountType) {
    switch (row.accountType) {
      case 'business_account': {
        const buttons = [];
        if (!row.businessAccountOpenDone) buttons.push({ type: 'business-account-open', label: 'Account Open' });
        if (!row.businessAccountFundCreditedDone) buttons.push({ type: 'business-account-fund-credited', label: 'Fund Credited' });
        return { buttons, canDisburse: buttons.length === 0 };
      }
      case 'current_account': {
        const buttons = [];
        if (!row.currentAccountOpenDone) buttons.push({ type: 'current-account-open', label: 'Account Open' });
        if (!row.currentAccountSalaryCreditedDone) buttons.push({ type: 'current-account-salary-credited', label: 'Salary Credited' });
        return { buttons, canDisburse: buttons.length === 0 };
      }
      case 'savings_account': {
        if (!row.savingsAccountOpenDone) return { buttons: [{ type: 'savings-account-open', label: 'Account Open' }], canDisburse: false };
        if (!row.savingsFundCreditedDone) return { buttons: [{ type: 'savings-fund-credited', label: 'Fund Credited' }], canDisburse: false };
        return { buttons: [], canDisburse: true };
      }
      default:
        return { buttons: [], canDisburse: false };
    }
  }

  switch (row.loanType) {
    case 'pdc':
      return row.pdcChqDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'pdc-chq', label: 'PDC Chq' }], canDisburse: false };
    case 'new_stl_loan': {
      if (!row.freshAccountOpenDone || !row.freshStlDone) {
        const buttons = [];
        if (!row.freshAccountOpenDone) buttons.push({ type: 'fresh-account-open', label: 'Account Open' });
        if (!row.freshStlDone) buttons.push({ type: 'fresh-stl', label: 'STL' });
        return { buttons, canDisburse: false };
      }
      return { buttons: [], canDisburse: true };
    }
    case 'buyout': {
      if (!row.buyoutAccountOpenDone || !row.buyoutLlReceivedDone) {
        const buttons = [];
        if (!row.buyoutAccountOpenDone) buttons.push({ type: 'buyout-account-open', label: 'Account Open' });
        if (!row.buyoutLlReceivedDone) buttons.push({ type: 'buyout-ll-received', label: 'LL Received' });
        return { buttons, canDisburse: false };
      }
      if (!row.buyoutMcSubmittedDone) return { buttons: [{ type: 'buyout-mc-submitted', label: 'MC Submitted' }], canDisburse: false };
      if (!row.buyoutClReceivedDone) return { buttons: [{ type: 'buyout-cl-received', label: 'CL Received' }], canDisburse: false };
      if (!row.buyoutStlDone) return { buttons: [{ type: 'buyout-stl', label: 'STL' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    case 'sme_new_loan':
      return row.smeAccountOpenDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'sme-account-open', label: 'Account Open' }], canDisburse: false };
    case 'sme_buyout_loan': {
      if (!row.smeBuyoutAccountOpenDone) return { buttons: [{ type: 'sme-buyout-account-open', label: 'Account Open' }], canDisburse: false };
      if (!row.smeBuyoutLlDone) return { buttons: [{ type: 'sme-buyout-ll', label: 'LL' }], canDisburse: false };
      if (!row.smeBuyoutMcDone) return { buttons: [{ type: 'sme-buyout-mc', label: 'MC' }], canDisburse: false };
      if (!row.smeBuyoutClDone) return { buttons: [{ type: 'sme-buyout-cl', label: 'CL' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    case 'pos_loan_non_bank': {
      const buttons = [];
      if (!row.posPdcDone) buttons.push({ type: 'pos-pdc', label: 'PDC' });
      if (!row.posDdaDone) buttons.push({ type: 'pos-dda', label: 'DDA' });
      return { buttons, canDisburse: buttons.length === 0 };
    }
    case 'pos_loan':
      return row.posLoanAccountOpenDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'pos-loan-account-open', label: 'Account Open' }], canDisburse: false };
    case 'auto_loan':
      return row.carLoanRegistrationDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'car-loan-registration', label: 'Car Registration' }], canDisburse: false };
    case 'mortgage_new': {
      if (!row.mortgageNewDocsDone) return { buttons: [{ type: 'mortgage-new-docs', label: 'Property Mortgage Docs' }], canDisburse: false };
      if (!row.mortgageNewEvaluationDone) return { buttons: [{ type: 'mortgage-new-evaluation', label: 'Evaluation' }], canDisburse: false };
      if (!row.mortgageNewRegistrationDone) return { buttons: [{ type: 'mortgage-new-registration', label: 'Property Registration' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    case 'mortgage_buyout': {
      if (!row.mortgageBuyoutDocsDone) return { buttons: [{ type: 'mortgage-buyout-docs', label: 'Property Mortgage Docs' }], canDisburse: false };
      if (!row.mortgageBuyoutEvaluationDone) return { buttons: [{ type: 'mortgage-buyout-evaluation', label: 'Evaluation' }], canDisburse: false };
      if (!row.mortgageBuyoutLlDone) return { buttons: [{ type: 'mortgage-buyout-ll', label: 'LL' }], canDisburse: false };
      if (!row.mortgageBuyoutMcDone) return { buttons: [{ type: 'mortgage-buyout-mc', label: 'MC' }], canDisburse: false };
      if (!row.mortgageBuyoutClDone) return { buttons: [{ type: 'mortgage-buyout-cl', label: 'CL' }], canDisburse: false };
      if (!row.mortgageBuyoutRegistrationDone) return { buttons: [{ type: 'mortgage-buyout-registration', label: 'Property Registration' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    default:
      return { buttons: [], canDisburse: false };
  }
}
```

(Every existing `case` block above is copied verbatim from the current file — only the `accountType` pre-check and the 4 new `case`s at the bottom are new.)

- [ ] **Step 4: Verify — lint**

Run: `cd frontend && npx eslint src/utils/loanActions.js`
Expected: no errors.

- [ ] **Step 5: Verify — manual check via a scratch component or browser console**

Since `loanActions.js` is an ES module (not requireable from plain Node), sanity-check it live in the browser instead: open the already-running app, open devtools console on any admin/agency page, and run:
```js
const { getLoanActions } = await import('/src/utils/loanActions.js');
console.log(getLoanActions({ status: 'approved', loanType: 'mortgage_buyout' }));
// expect: { buttons: [{ type: 'mortgage-buyout-docs', label: 'Property Mortgage Docs' }], canDisburse: false }
console.log(getLoanActions({ status: 'approved', accountType: 'savings_account', savingsAccountOpenDone: true }));
// expect: { buttons: [{ type: 'savings-fund-credited', label: 'Fund Credited' }], canDisburse: false }
```
(Vite serves source files directly in dev mode, so this dynamic import works without a build step.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/loanActions.js
git commit -m "Extend loanActions.js with pos_loan/auto_loan/mortgage_new/buyout and account flows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — Loan Products category option + `SubmitLead.jsx` loan-type options

**Files:**
- Modify: `frontend/src/pages/admin/LoanProducts.jsx:13-23,25-35`
- Modify: `frontend/src/pages/agent/SubmitLead.jsx:502-516`

**Interfaces:**
- Consumes: `pos_loan` loanCategory (Task 1), the new loanType route segments are irrelevant here (this task only affects what value gets submitted, not the milestone UI).
- Produces: admins can create a `LoanProduct` with category "POS Loan"; agents can pick Auto Loan / Mortgage Loan (New) / Mortgage Loan (Buyout) / POS Loan as the `loanType` when submitting a personal-group loan lead.

- [ ] **Step 1: Add the category option**

In `frontend/src/pages/admin/LoanProducts.jsx`, change `LOAN_CATEGORIES` (lines 13-23):
```js
const LOAN_CATEGORIES = [
  { value: 'personal',  label: 'Personal Loan' },
  { value: 'mortgage',  label: 'Mortgage Loan' },
  { value: 'investor',  label: 'Investor Loan' },
  { value: 'business',  label: 'Business Loan' },
  { value: 'auto_loan', label: 'Auto Loan' },
  { value: 'buyout',    label: 'Buyout Loan' },
  { value: 'fresh',     label: 'Fresh Loan' },
  { value: 'pdc',       label: 'PDC Loans' },
  { value: 'stl',       label: 'STL Loan' },
  { value: 'pos_loan',  label: 'POS Loan' },
];
```
and `CATEGORY_COLOR` (lines 25-35):
```js
const CATEGORY_COLOR = {
  personal:  'cyan',
  mortgage:  'purple',
  investor:  'gold',
  business:  'blue',
  auto_loan: 'green',
  buyout:    'volcano',
  fresh:     'lime',
  pdc:       'geekblue',
  stl:       'orange',
  pos_loan:  'magenta',
};
```

- [ ] **Step 2: Add the loanType options**

In `frontend/src/pages/agent/SubmitLead.jsx`, the `loanType` `<Select>` (lines 503-515) currently reads:
```js
                      <Select size="middle" placeholder="Select loan type" options={
                        selectedLoanGroup === 'business'
                          ? [
                              { value: 'sme_new_loan',      label: 'SME New Loan' },
                              { value: 'sme_buyout_loan',   label: 'SME Buyout Loan' },
                              { value: 'pos_loan_non_bank', label: 'POS Loan / Non Bank' },
                            ]
                          : [
                              { value: 'new_stl_loan', label: 'New STL Loan' },
                              { value: 'buyout',       label: 'Buyout' },
                              { value: 'pdc',          label: 'PDC' },
                            ]
                      } />
```
Change only the `'personal'`-group array (the `business` branch is untouched):
```js
                      <Select size="middle" placeholder="Select loan type" options={
                        selectedLoanGroup === 'business'
                          ? [
                              { value: 'sme_new_loan',      label: 'SME New Loan' },
                              { value: 'sme_buyout_loan',   label: 'SME Buyout Loan' },
                              { value: 'pos_loan_non_bank', label: 'POS Loan / Non Bank' },
                            ]
                          : [
                              { value: 'new_stl_loan',     label: 'New STL Loan' },
                              { value: 'buyout',           label: 'Buyout' },
                              { value: 'pdc',              label: 'PDC' },
                              { value: 'auto_loan',        label: 'Auto Loan' },
                              { value: 'mortgage_new',     label: 'Mortgage Loan (New)' },
                              { value: 'mortgage_buyout',  label: 'Mortgage Loan (Buyout)' },
                              { value: 'pos_loan',         label: 'POS Loan' },
                            ]
                      } />
```

- [ ] **Step 3: Verify — lint**

Run: `cd frontend && npx eslint src/pages/admin/LoanProducts.jsx src/pages/agent/SubmitLead.jsx`
Expected: no new errors.

- [ ] **Step 4: Verify — manual walkthrough**

1. As admin, go to Loan Products → Add Loan, confirm "POS Loan" appears in the Category dropdown; create one against any bank, save, confirm it lists with a magenta "POS Loan" tag.
2. As agent, go to Submit Lead → Personal Loan tab, confirm the Loan Type dropdown now also offers Auto Loan / Mortgage Loan (New) / Mortgage Loan (Buyout) / POS Loan (in addition to the existing New STL Loan / Buyout / PDC).
3. Pick "Mortgage Loan (Buyout)", pick any loan product from that group (the category filter is by group not by the specific loanType, so any personal-group product works — this matches existing behavior for e.g. picking "Buyout" against a `personal` category product today), fill required fields, submit.
4. As admin/agency, find that lead, move its `status` to `approved` (via the existing status UI), then open its detail view and confirm the "Property Mortgage Docs" button now appears (from Task 3's `getLoanActions`), and clicking through all 6 buttons in order eventually shows no more buttons (disbursable).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/LoanProducts.jsx frontend/src/pages/agent/SubmitLead.jsx
git commit -m "Add pos_loan category option and new loanType choices to agent lead form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
