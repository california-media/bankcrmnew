# New Product Categories (Accounts + Loan sub-types) — Design Spec

**Date:** 2026-09-12
**Status:** Draft — pending review

## Overview

The public site now has referral pages for 7 product categories that the admin
panel has no matching infrastructure for: Business Account, Current Account,
Saving Account, POS Loan, Car Loan, Mortgage Loan (New), Mortgage Loan
(Buyout). Business Loan is unaffected — it already maps to the existing
`business` loan category and has no special milestone flow (approve/reject →
disburse only), so it needs nothing new.

This spec adds:
1. An admin catalog for the 3 **Account** products (new product family — not
   loans).
2. A milestone/status flow for each of the 6 categories that have one,
   matching the process flows given, wired the same way the existing
   pdc/buyout/sme/pos_loan_non_bank flows already work.
3. Agent-facing lead creation (`SubmitLead.jsx`) support for all of the above.

**Hard constraint: additive only.** Every change below is a new file, a new
enum *value* appended to an existing list, a new optional schema field, a new
route, or a single-line insertion into a shared file (one nav entry, one
route import+registration, one dropdown option). No existing enum value,
field, route, or component is renamed, removed, or restructured. Confirmed
identity decisions (do not collapse into existing ones):
- New `pos_loan` loan category/type is separate from the existing
  `pos_loan_non_bank` (PDC+DDA) flow — both coexist.
- New `mortgage_buyout` is separate from the existing `buyout` loan-type
  (SME/personal loan buyout flow) — both coexist.

## Sub-project 1 — Account Products (new family)

### Backend model — `backend/models/AccountProduct.js` (new file)

Parallel shape to `LoanProduct`, swapping loan-only fields for account ones:

```js
{
  name: String (required),
  accountCategory: enum ['business', 'current', 'savings'] (required),
  bank: ObjectId ref Bank (required),
  agency: ObjectId ref User,
  commissionBrackets: [{ minimumSalary, receivable, payable }],  // flat AED amounts, like CardProduct — accounts have no loan amount to take a % of
  benefits: String, feesEligibility: String,
  isActive / agentVisible / websiteVisible: Boolean (default true),
  redirectUrl: String, redirectActive: Boolean,
  minBalance: Number,
  monthlyFee: String,
  interestRate: String,       // relevant mainly for savings; optional for business/current
  keyNotes: String,
  tags: [String],
  timestamps: true
}
```

### Backend controller + routes (new files)

- `backend/controllers/accountProduct.controller.js`: `list` (populate
  bank+agency), `create`, `update`, `remove` — copy `loanProduct.controller.js`
  pattern exactly (plain JSON body, no file upload).
- `backend/routes/accountProduct.routes.js` mounted at `/api/account-products`:
  `GET /` (admin/agent/agency), `POST /` (admin), `PUT /:id` (admin),
  `DELETE /:id` (admin) — same role gates as `loan-products`.
- One new mount line in `backend/server.js`, next to the existing
  `app.use('/api/loan-products', require('./routes/loanProduct.routes'));`
  (line 74): `app.use('/api/account-products', require('./routes/accountProduct.routes'));`

### Admin UI

- New page `frontend/src/pages/admin/AccountProducts.jsx` — copy
  `LoanProducts.jsx`'s list+filter+modal+form structure. Category dropdown:
  Business Account / Current Account / Saving Account. Drop the loan-only
  form fields (interest rate range/min/max/type/basis, tenure, salary
  transfer required, processing fee, early settlement, late fee, Islamic/
  Conventional) in favor of: min balance, monthly fee, interest rate
  (optional, shown for savings).
- `frontend/src/components/AppLayout.jsx`: insert **one** nav entry directly
  below the existing `Loan Products` entry:
  `{ key: '/admin/account-products', icon: <BankOutlined />, label: <Link to="/admin/account-products">Account Products</Link> }`
- `frontend/src/App.jsx`: one new import + one new
  `<Route path="account-products" element={<AccountProducts />} />`, placed
  next to the existing `card-products`/`featured-products`/`loan-products`
  routes.

### Lead model support

- `Lead.productType` enum: append `'account'` (existing: `credit_card`,
  `loan`).
- New fields: `accountProduct` (ObjectId ref `AccountProduct`), `accountType`
  (enum `['business_account', 'current_account', 'savings_account', null]`,
  default `null`) — this is the flow discriminator, mirroring how `loanType`
  works for loans.
- New milestone fields (see flow table below).

### Lead creation (backend)

`lead.controller.js` `exports.create`: add an `else if (productType ===
'account')` branch before the final rejecting `else` (mirrors the existing
`credit_card`/`loan` branches) — validates `accountProduct`, resolves
`bank`/`agency` from it (same `agency` fallback logic as the other two
branches), and sets `leadData.accountProduct` / `leadData.accountType`.

`backend/services/commission.service.js` `resolveCommissions(lead)`: add one
new `if (lead.productType === 'account' && lead.accountProduct)` branch,
placed like the existing `credit_card` branch (flat AED bracket amounts,
`findBracket()` reused as-is, no percentage/loanAmount multiplication since
accounts have no loan amount) — existing `credit_card`/`loan` branches
untouched.

## Sub-project 2 — Loan-family additions

### `LoanProduct.loanCategory` enum

Append `'pos_loan'` (backend model enum + the `LOAN_CATEGORIES` options array
in `LoanProducts.jsx`, one new object: `{ value: 'pos_loan', label: 'POS Loan' }`).
`mortgage`, `auto_loan`, and `business` already exist — no changes needed
there; admins already manage Car Loan / Mortgage Loan / Business Loan
products through the existing Loan Products page.

### `Lead.loanType` enum

Append 4 new values: `pos_loan`, `auto_loan`, `mortgage_new`,
`mortgage_buyout` (existing values untouched).

## Milestone flows (both sub-projects)

Same convention as the existing fields (e.g. `buyoutAccountOpenDone` /
`buyoutAccountOpenNote`), namespaced per category so nothing shares state
with an existing flow:

| Category | Discriminator | New Lead fields | Flow |
|---|---|---|---|
| POS Loan | `loanType='pos_loan'` | `posLoanAccountOpenDone/Note` | Approved → Account Open → Disbursed |
| Car Loan | `loanType='auto_loan'` | `carLoanRegistrationDone/Note` | Approved → Car Registration → Disbursed |
| Mortgage New | `loanType='mortgage_new'` | `mortgageNewDocsDone/Note`, `mortgageNewEvaluationDone/Note`, `mortgageNewRegistrationDone/Note` | Approved → Docs → Evaluation → Registration → Disbursed (strict) |
| Mortgage Buyout | `loanType='mortgage_buyout'` | `mortgageBuyoutDocsDone/Note`, `mortgageBuyoutEvaluationDone/Note`, `mortgageBuyoutLlDone/Note`, `mortgageBuyoutMcDone/Note`, `mortgageBuyoutClDone/Note`, `mortgageBuyoutRegistrationDone/Note` | Approved → Docs → Evaluation → LL → MC → CL → Registration → Disbursed (strict) |
| Business Account | `accountType='business_account'` | `businessAccountOpenDone/Note`, `businessAccountFundCreditedDone/Note` | Approved → (Account Open + Fund Credited, either order) → Disbursed |
| Current Account | `accountType='current_account'` | `currentAccountOpenDone/Note`, `currentAccountSalaryCreditedDone/Note` | Approved → (Account Open + Salary Credited, either order) → Disbursed |
| Saving Account | `accountType='savings_account'` | `savingsAccountOpenDone/Note`, `savingsFundCreditedDone/Note` | Approved → Account Open → Fund Credited → Disbursed (strict) |

### Backend routes + controller

One new `PATCH /leads/:id/<segment>` route per new field pair, added next to
the existing milestone routes in `lead.routes.js` (same `requireRole('agency',
'employee')` gate), e.g. `pos-loan-account-open`, `car-loan-registration`,
`mortgage-new-docs`, `mortgage-new-evaluation`, `mortgage-new-registration`,
`mortgage-buyout-docs`, `...-evaluation`, `...-ll`, `...-mc`, `...-cl`,
`...-registration`, `business-account-open`, `business-account-fund-credited`,
`current-account-open`, `current-account-salary-credited`,
`savings-account-open`, `savings-fund-credited`.

**Controller implementation note:** the existing milestone controller methods
(e.g. `updateBuyoutAccountOpen`) are each a ~25-line hand-copied block
(find lead by ownership → set field → push statusHistory → notify admins+
agent). Rather than copy that block 16 more times, I'll add one small
internal helper used only by these new endpoints (e.g.
`makeMilestoneHandler(field, noteField, statusLabel, notifTitle)` returning
an Express handler) — existing handlers stay untouched, this only avoids
repeating the same 16 near-identical blocks for the new code. Flagging this
in case you'd rather I match the existing copy-paste style exactly instead.

### Frontend — `frontend/src/utils/loanActions.js`

Additive entries only, existing cases untouched:
- `ACTION_LABELS`: 16 new `<segment>: <Label>` entries.
- `LOAN_MILESTONES`: 4 new keys (`pos_loan`, `auto_loan`, `mortgage_new`,
  `mortgage_buyout`) plus 3 new keys for the account flows
  (`business_account`, `current_account`, `savings_account`) — same ordered
  `{field, type}` array shape.
- `getLoanActions(row)`: at the top, if `row.accountType` is set, switch on
  that first (new small switch block, same `{buttons, canDisburse}` return
  shape as existing cases) instead of `row.loanType`; otherwise fall through
  to the existing `loanType` switch, which gets 4 new `case` blocks appended
  (existing cases untouched).

No changes needed in `LeadDetail.jsx` / `agency/Leads.jsx` /
`employee/AssignedLeads.jsx` — they all consume `getLoanActions()` /
`LOAN_MILESTONES` already and get the new flows automatically once the util
is extended.

## Agent lead creation — `frontend/src/pages/agent/SubmitLead.jsx`

Current shape (confirmed by reading the file): a 3-button segmented control
(Credit Card / Personal Loan / Business Loan) drives `productType` +
`selectedLoanGroup`; `loanGroupOf(loanCategory)` buckets every `loanCategory`
except `'business'` into `'personal'`; a `loanType` `<Select>` then offers 3
hardcoded options per group.

Additive changes:
1. **New segmented button** `{ value: 'account', label: 'Account', icon: <BankOutlined/> }`
   appended to the 3 existing ones. `selectProductTab('account')` sets
   `productType='account'` (no loan group).
2. **New account-category sub-selector**, shown when `productType==='account'`
   (same visual slot the `loanType` Select occupies for loans): 3 options —
   Business / Current / Savings — setting `accountType` and filtering the
   newly-fetched `accountProducts` list (fetched alongside `cardProducts`/
   `loanProducts` in the existing `Promise.all`, filtered by
   `isActive && agentVisible !== false && bank?.isActive !== false` like the
   other two).
3. **`loanType` Select options**: since `pos_loan`/`auto_loan`/
   `mortgage_new`/`mortgage_buyout` LoanProduct categories all fall into the
   `'personal'` group under `loanGroupOf`, append 4 options to the
   *`'personal'` branch only* (existing `business` branch untouched):
   `{ value: 'auto_loan', label: 'Auto Loan' }`,
   `{ value: 'mortgage_new', label: 'Mortgage Loan (New)' }`,
   `{ value: 'mortgage_buyout', label: 'Mortgage Loan (Buyout)' }`,
   `{ value: 'pos_loan', label: 'POS Loan' }`.
4. Submit payload: additive `if (productType === 'account') { payload.accountProduct = values.accountProduct; if (values.accountType) payload.accountType = values.accountType; }` block next to the existing `credit_card`/`loan` blocks.

## Out of scope (explicitly not touched by this work)

- The admin dashboard's "Lead pipeline" chart and "Product payouts" widget
  (`Dashboard.jsx`) stay on their current hardcoded `credit_card`/`loan`
  breakdown — not extended to show Account/new-category splits.
- The Kanban `Pipeline.jsx` board's `credit_card`/`loan` segmented toggle —
  not extended with an `account` option.
- Public-site referral pages (already shipped in an earlier piece of work).
- Card Products / Featured Products — untouched.

## Testing / verification

- Backend: create an `AccountProduct`, create a `Lead` against it for each of
  the 3 account types, walk each milestone route in sequence, confirm
  `canDisburse`-equivalent state and `statusHistory` entries. Same for each
  new loan sub-type against a `LoanProduct` with the matching category.
- Frontend: manual pass through `SubmitLead.jsx` for all 4 tabs (including
  new Account tab and the 4 new personal-group loan types), confirm
  `AccountProducts.jsx` CRUD parity with `LoanProducts.jsx`, confirm nav
  entry position and route.
