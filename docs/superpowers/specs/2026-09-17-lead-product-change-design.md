# Lead Product Change — Design

## Problem

Once an agent submits a lead for a specific product (e.g. "Ajman Bank Bright
Titanium Card"), there is currently no way to change that product if the
customer, during the agency's follow-up call, chooses a different one (e.g.
"Ultracash Card", or "World Card" → "Free Card"). The lead is stuck with
whatever product the agent originally picked, and so is its payout.

Client requirement: a defined set of roles should be able to change the
product on an already-submitted lead, with the payout recalculating
automatically and reflecting everywhere payout is shown (agent Commissions
page, agent Dashboard, agent MyLeads).

## Who can change it

| Role | Condition |
|---|---|
| Super Admin | `role === 'admin'`, `adminScope === null` |
| Sub Admin | `role === 'admin'`, `adminScope === 'coordinator'` |
| Leads Admin | `role === 'admin'`, `adminScope === 'leads'` |
| Agency (owner) | `role === 'agency'`, own leads only |
| Agency Coordinator employee | `role === 'employee'`, `employeeType === 'coordinator'`, agency-wide (own agency's leads) |
| Agency Sales employee | `role === 'employee'`, `employeeType === 'sales'`, only leads where they are `assignedSalesEmployee` |

Explicitly excluded: Product Admin (`adminScope === 'product'`), Finance
Admin (`adminScope === 'finance'`), Account-Access employee
(`employeeType === 'account'`), CPV employee (`employeeType === 'cpv'`).

This is a genuinely new authorization pattern — `adminScope` is defined on
`User` (`backend/models/User.js:17`) but today is only used for
admin-account management (`backend/controllers/admin.controller.js:406-524`);
no lead/payout endpoint currently checks it. This feature introduces the
first `adminScope` gate on a lead-mutating endpoint.

## Scope of the change

- **Same category only**: a card lead can only move to another card
  product, a loan lead to another loan product, an account lead to another
  account product. `lead.productType` itself never changes. (Matches both
  of the client's examples; keeps the UI to a single product picker instead
  of a full re-submission flow.)
- **Bank can change**: the picker is bank → product, not constrained to the
  lead's existing bank. Picking a new bank and a same-category product from
  it replaces both `lead.bank` and the product ref together.
- **Lock point**: allowed while `lead.status` is one of `submitted`,
  `under_review`, `assigned`, `approved`. Blocked once `disbursed` — this
  mirrors the existing loan-amount-edit rule at
  `backend/controllers/lead.controller.js:542-545`.
- **Audit trail**: every change appends an entry to a new `productHistory`
  array on the lead (who, when, from → to), shown on the lead detail page
  next to the existing status history.
- **Agent notification**: the lead's agent gets a notification when their
  lead's product changes, since it affects their payout.

## Data model changes

`backend/models/Lead.js` — add:

```js
productHistory: [{
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now },
  fromBankName:    { type: String },
  fromProductName: { type: String },
  toBankName:      { type: String },
  toProductName:   { type: String },
  _id: false,
}],
```

All four are name *snapshots* (not refs), mirroring `Lead.js`'s existing
`statusHistory` sub-schema shape (`backend/models/Lead.js:179-187`) and
keeping the history readable even if a bank/product is later renamed or
deleted — and avoiding an extra populate at read time (`changedBy` is the
only ref, and `getOne`'s existing `.populate('statusHistory.changedBy', ...)`
pattern at `backend/controllers/lead.controller.js:2223` is mirrored with a
`.populate('productHistory.changedBy', 'name email')` addition).

## Backend

**Route** — `backend/routes/lead.routes.js`, alongside the existing
`PATCH /:id/loan-amount` (line 39):

```js
router.patch('/:id/product', requireRole('agency', 'employee', 'admin'), ctrl.updateProduct);
```

**Controller** — `backend/controllers/lead.controller.js`, new
`exports.updateProduct`, modeled on `exports.updateLoanAmount` (lines
516-563):

1. Load the lead. 404 if not found.
2. Resolve permission per the matrix above:
   - `admin`: allow if `req.user.adminScope` is `null`, `'coordinator'`, or
     `'leads'`; else 403. (New check — no existing helper for this; add
     inline, following the shape of `allowEmployeeTypes` in
     `backend/middleware/auth.middleware.js:32-37` but for `adminScope`.)
   - `agency`: allow only if `lead.agency` (`backend/models/Lead.js:57`)
     matches `req.user._id`.
   - `employee` + `employeeType === 'coordinator'`: allow, scoped via
     `resolveAgencyId(req.user)` to the lead's agency (same pattern as
     `updateLoanAmount` line ~531).
   - `employee` + `employeeType === 'sales'`: allow only if
     `lead.assignedSalesEmployee` equals `req.user._id`.
   - Anything else: 403.
3. 400 if `lead.status === 'disbursed'`.
4. Body: `{ bank, productId }`. Look up the product in the model matching
   `lead.productType` (`CardProduct`/`LoanProduct`/`AccountProduct`). 404 if
   not found. If the product has `assignedAgencies` set, 400 if the lead's
   agency isn't in that list (mirrors visibility rules used elsewhere for
   these models).
5. Push the `productHistory` entry (snapshot old bank/product name before
   overwriting).
6. Set `lead.bank = bank`, and `lead.cardProduct`/`loanProduct`/
   `accountProduct` (whichever matches `productType`) to the new product id.
7. Call `commissionService.resolveCommissions(lead)` and overwrite
   `lead.grossCommission`/`lead.commission`, same as `updateLoanAmount`
   (`backend/controllers/lead.controller.js:547-554`).
   `holdAmount`/`clawbackUntil` are **not** touched here — those are only
   ever set later, in `markCommissionPaid`
   (`backend/controllers/lead.controller.js:1401-1414`), which only runs
   post-disbursement. Since product changes are blocked once `disbursed`
   (step 3), a lead eligible for a product change never has hold/clawback
   values set yet, so there's nothing to recompute.
8. Save the lead.
9. Create a notification for `lead.agent` via the existing
   `createAndEmit(recipientIds, data, actorId)` helper
   (`backend/utils/notify.js:14`, imported into `lead.controller.js:12`):
   `await createAndEmit([String(populated.agent?._id || populated.agent)], { type: 'product_changed', title: 'Product Changed', body: \`${lead.customerName} — ${fromProductName} → ${toProductName}\`, lead: lead._id }, req.user._id);` —
   same shape as the existing `markCommissionPaid` call
   (`lead.controller.js:1430-1434`). Requires adding `'product_changed'` to
   the `type` enum on `backend/models/Notification.js:6-19` (which is
   required — no validation error).
10. Return the updated, populated lead (mirror `POPULATE_FIELDS` plus
    `.populate('productHistory.changedBy', 'name email')`).

- `frontend/src/pages/leads/LeadDetail.jsx` has no single shared gating
  condition today — the "Edit Loan Amount" button is duplicated inside
  three separate role-gated `<Card title="Actions">` blocks (Agency block
  at line 853, Admin block at line 923, Employee block at line 951, each
  with its own copy of the button). The "Change Product" button is added
  the same way, once per block:
  - **Agency block** (`role === 'agency'`): shown unconditionally within
    the block (agency owner always allowed).
  - **Admin block** (`role === 'admin'`): shown only if
    `[null, 'coordinator', 'leads'].includes(user.adminScope)` — a new
    check; nothing in this file inspects `adminScope` today.
  - **Employee block**: shown if `user.employeeType === 'coordinator'`
    (agency-wide), or `user.employeeType === 'sales' && String(user.id) ===
    String(lead.assignedSalesEmployee?._id)` — this per-lead assignment
    check is also new; today's `hasFullAccess` flag
    (`et === 'sales' || et === 'coordinator'`, line 957) grants Sales the
    same blanket access as Coordinator with no assignment check, which the
    new button must not inherit.
  - All three additionally require `LOAN_EDITABLE_FROM.includes(lead.status)`
    (same list as loan-amount editing: `submitted`, `under_review`,
    `assigned`, `approved` — line 67) to mirror the lock point.
- Modal: Bank select → Product select, reusing the exact cascading pattern
  already in `frontend/src/pages/agent/SubmitLead.jsx` (fetch
  `/card-products`, `/loan-products`, `/account-products` once, derive the
  bank list from the fetched array, filter the product `<Select>` by the
  chosen bank) — filtered additionally to the lead's existing `productType`
  category. On submit, calls `PATCH /leads/:id/product`.
  - **Route-guard gap to fix**: `GET /card-products`, `/loan-products`,
    `/account-products` currently only allow
    `requireRole('admin', 'agent', 'agency')` (e.g.
    `backend/routes/cardProduct.routes.js:9`) — `employee` is not in the
    list, even though each controller's `list` filter is already
    employee-aware (`resolveAgencyId(req.user)`). This must be widened to
    `requireRole('admin', 'agent', 'agency', 'employee')` on all three
    routes, or Coordinator/Sales employees can't populate the picker.
- On success: toast, refetch the lead — updated product and payout show
  immediately (no separate recompute needed client-side, since the backend
  freezes the new `commission` onto the lead, matching how every other
  payout display already reads the stored field, not a live join).
- New "Product History" section on the lead detail page, listing
  `productHistory` entries (mirrors the existing Status History section at
  `frontend/src/pages/leads/LeadDetail.jsx:637-661`).

No changes needed to `Commissions.jsx`, `Dashboard.jsx`, or `MyLeads.jsx` —
they already read `lead.commission`/`grossCommission` as stored fields, so
once the backend overwrites those fields, these views update automatically
on next fetch.

## Error handling

| Case | Response |
|---|---|
| Lead not found | 404 |
| Caller not in the permission matrix | 403 |
| Lead is `disbursed` | 400 |
| New product not in the lead's category | 400 |
| Product not found | 404 |
| Product not visible to lead's agency (`assignedAgencies`) | 400 |
| Sales employee not the lead's assigned sales employee | 403 |

## Testing

Manual, no automated test suite exists for this area today:

- As agency owner, Coordinator employee, assigned Sales employee, Super
  Admin, and Sub Admin/Leads Admin: open a `submitted`/`approved` lead,
  change its product to a different one in the same category (including
  across banks), confirm:
  - `productHistory` gets a new entry with correct from/to.
  - Agent's Commissions page, Dashboard stat tiles, and MyLeads row all
    show the updated payout.
  - Agent receives a notification.
- As Product Admin, Finance Admin, Account-Access employee, CPV employee,
  and a Sales employee NOT assigned to the lead: confirm the button is
  hidden and the endpoint 403s if called directly.
- Attempt the change on a `disbursed` lead: confirm it's blocked both in
  the UI (button hidden/disabled) and at the API (400).
- Attempt to pick a product from a different category (e.g. a loan product
  on a card lead) directly via API: confirm 400.
