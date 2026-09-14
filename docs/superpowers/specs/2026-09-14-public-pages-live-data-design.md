# Public Pages — Live Data + Real Lead Capture — Design Spec

**Date:** 2026-09-14
**Status:** Approved

## Overview

7 standalone public marketing pages in `/Users/developer/Downloads/` (Business Accounts, Business Loan, POS Loan, Auto Loan, Current Account, Mortgage Loan, Saving Accounts) currently have their entire product list **hardcoded** inside the HTML file (a static JS array written months ago) and their "Apply"/"Request Callback" forms are **pure UI stubs** — no `fetch()` anywhere, nothing reaches the database. Two sibling pages (`credit-cards-in-uae.html`, `personal-loans-in-uae.html`) already work correctly: they fetch the real catalog from the backend, reshape it into the page's internal item format, and POST real applications that create real `Lead` documents visible in Admin/Agency.

This spec migrates all 7 pages to the same live pattern, **without changing how any page looks, filters, sorts, or compares** — only where the data comes from, and where a submitted application goes.

## Hard constraints

- **Additive only**, same rule as every prior piece of this project: no existing field, enum value, route, or model gets renamed/removed. `credit-cards-in-uae.html` and `personal-loans-in-uae.html` are not touched at all.
- **Existing render/filter/sort/compare JS in each of the 7 files stays untouched.** Only the code that *populates* `LOANS`/`BANKS` changes (from a literal array to a fetch-and-map), preserving the exact same field names those files' own code already reads (confirmed field-by-field in the investigation below) — the rest of each page's code never needs to know the difference.
- Callback ("Request a Callback") mini-forms are **out of scope** — confirmed neither working page has one, so per the user's own rule these stay as UI-only stubs on all 7 pages.
- No automated test framework exists anywhere in this project (repo or standalone pages) — verification is curl-based endpoint checks, Node scripts simulating each page's mapping function against real API responses, and (for the git-repo pieces) the same per-task/final SDD review process used throughout this project.

## Part 1 — Backend additions (repo: `bankcrmnew`, additive only)

### 1a. New public endpoints for Account Products

Mirrors the existing `getPublicLoanProducts`/`submitWebLoanApply` pair exactly.

- `GET /api/public/account-products` (new controller fn `getPublicAccountProducts` in `public.controller.js`, new route line in `public.routes.js`): `AccountProduct.find({isActive:true, websiteVisible:{$ne:false}}).populate({path:'bank', select:'name code logo isActive'}).select(<all public-safe fields>).lean()`, filtered to `bank?.isActive !== false`, same shape/style as `getPublicLoanProducts`.
- `POST /api/public/account-apply` (new controller fn `submitWebAccountApply`, new route line): mirrors `submitWebLoanApply` field-for-field — requires `customerName`/`phone`/`email`, sets `productType:'account'`, `accountProduct`, `accountType` (new: accepted from body), `bank` (from the account product), default-agency assignment + `leadNumber`, WABA consent, `source:'web_apply'`, `status:'submitted'`.

### 1b. `submitWebLoanApply` learns `loanType`

Currently never sets `Lead.loanType` at all. Add: if `req.body.loanType` is provided, set it on `leadData.loanType`. Purely additive — `personal-loans-in-uae.html` (which never sends this field) keeps behaving exactly as today.

### 1c. New optional `LoanProduct` fields (admin-editable, all optional)

Needed because Business Loan / POS Loan pages display stats the current schema has no field for:
- `minTurnover` (Number) — "Annual/Monthly Business Turnover" requirement (Business Loan)
- `collateralRequired` (Boolean, default `false`) — Business Loan
- `minPosHistoryMonths` (Number) — "months of POS sales history required" (POS Loan)

Every other field the 4 loan pages need already exists on `LoanProduct` (confirmed field-by-field: `interestRateRange`→`rateDisplay`, `maxAmountNum`→`maxAmount`, `tenureMaxMonths`→`tenureMax`, `loanType`[Islamic/Conventional]→`type`, `benefits`→`features` via HTML-to-list, `feesEligibility`→`eligibility` via strip-HTML, `salaryTransferRequired`, `rateMin`/`rateMax`/`rateBasis`/`rateType`, `processingFee`/`earlySettlement`/`lateFee`, `source`/`sourceLabel`, `disclosedNote` — all present).

`getPublicLoanProducts`'s `.select()` string gets these 3 new field names appended so they're actually returned publicly.

`LoanProducts.jsx` (admin) gets 3 new optional form inputs for these (grouped visually near the existing Bank Product Info section — exact placement is an implementation-time call, not a design constraint).

### 1d. New optional `AccountProduct` fields (admin-editable, all optional)

- `type` (String enum `['Islamic','Conventional']`) — matching `LoanProduct.loanType`'s existing enum exactly (same field, same meaning, on a different model — this is the same naming collision the codebase already tolerates between `LoanProduct.loanType` and `Lead.loanType`; not introducing a new pattern, just extending an existing one)
- `digitalOnboarding` (Boolean, default `false`)
- `multiCurrency` (Boolean, default `false`)
- `salaryTransferRequired` (Boolean, default `null` — tri-state, matching `LoanProduct`'s existing field of the same name/shape)
- `freeTransactions` (String) — free text, e.g. "2 free withdrawals per month"
- `fallBelowFee` (String) — free text, e.g. "AED 25/month if balance falls below minimum"
- `payoutFrequency` (String) — free text, e.g. "Monthly" (relevant mainly to Savings)

`minBalanceDisplay` is **not** a new field — the public pages derive it at render time from the existing numeric `minBalance` (e.g. `minBalance === 0 ? 'AED 0 (no minimum balance)' : 'AED ' + minBalance.toLocaleString()`), same way `monthlyFee`/`interestRate` (already free-text strings) directly serve as their own display text.

`getPublicAccountProducts`'s `.select()` includes these new fields. `AccountProducts.jsx` (admin) gets matching new optional form inputs.

## Part 2 — The 4 Loan-family pages (Business Loan, POS Loan, Auto Loan, Mortgage)

`business-loans-in-uae.html` and `pos-loans-in-uae.html` are the same underlying file/dataset split by a `PAGE_VERTICAL` constant (`"biz"` vs `"pos"`) — each still gets its own live fetch (they're separate files on disk), just filtered to a different `loanCategory`.

**Category mapping:** Business Loan → `loanCategory==='business'`, POS Loan → `loanCategory==='pos_loan'`, Auto Loan → `loanCategory==='auto_loan'`, Mortgage → `loanCategory==='mortgage'`.

**Migration pattern per file** (mirrors `personal-loans-in-uae.html`'s `initData()` exactly):
1. Replace `const LOANS = [ ...hardcoded... ]` with `let LOANS = []; let BANKS = [];` (or reuse whatever `BANKS` array already exists per file).
2. Add `async function initData(){ ... }`: `fetch(API_BASE + '/api/public/loan-products')` → filter by this file's `loanCategory` → map each real doc into this file's *exact existing* item shape (field names must match precisely what that file's own rendering/filter code already reads, per the investigation's field lists) → populate `LOANS`/`BANKS` → call whatever render/init functions currently run synchronously right after the old hardcoded array (read each file's current code at implementation time to find these exactly — don't guess from this spec).
3. Call `initData();` at the same top-level spot the old array literal occupied, so page load timing/order stays equivalent.
4. Add the same `API_BASE` constant `personal-loans-in-uae.html` uses (none of these 7 files currently define one): `(location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:8000' : 'https://api.mysilah.ae'`.

**Wire the real Apply form** on each to `POST API_BASE + '/api/public/loan-apply'` with `customerName`/`phone`/`email` + whatever else that file's form already collects, plus the now-real `loanProductId` (a genuine Mongo `_id`, available now that data is live) and:
- Auto Loan → `loanType: 'auto_loan'`
- POS Loan → `loanType: 'pos_loan'`
- Business Loan → no `loanType` sent (the `business` category maps to 3 different flows in the agent-facing form — `sme_new_loan`/`sme_buyout_loan`/`pos_loan_non_bank` — with no single correct default; leaving it unset matches the existing precedent for `personal-loans-in-uae.html`'s own unset-loanType leads, which fall to plain Approve/Reject/Disburse with no milestone flow)
- Mortgage → **new required dropdown** added to the Apply form: "New Mortgage" (`loanType: 'mortgage_new'`) / "Buyout — Refinance Existing Mortgage" (`loanType: 'mortgage_buyout'`)

## Part 3 — The 3 Account-family pages (Business Account, Current Account, Saving Account)

Same migration pattern as Part 2, against the new `/api/public/account-products` endpoint (Part 1a), filtered by `accountCategory` (`business`/`current`/`savings` respectively), and the real Apply form POSTs to the new `/api/public/account-apply` (Part 1a) with `accountProductId` + `accountType` (`business_account`/`current_account`/`savings_account` respectively, matching the existing `Lead.accountType` enum from the already-shipped Account Products work).

## Part 4 — Remove EmailJS from Auto Loan + Mortgage pages

Both currently load `@emailjs/browser`, define a placeholder (never-configured) `EMAILJS_CONFIG`, and call `afSendEmail(...)` from inside `submitApply`. Confirmed neither working page (`credit-cards-in-uae.html`, `personal-loans-in-uae.html`) uses EmailJS at all — per the user's own stated rule, remove:
- The `<script src="...@emailjs/browser...">` tag
- The `EMAILJS_CONFIG` object + its `emailjs.init(...)` guard
- The `afSendEmail(...)` call inside `submitApply`, and the `afSendEmail` function definition itself

**Keep** `afGeneratePdf(...)` and its call — client-side PDF generation, unrelated to email, not asked to remove.

## Out of scope (explicit)

- `credit-cards-in-uae.html`, `personal-loans-in-uae.html` — untouched.
- Callback mini-forms on all 7 pages — untouched (confirmed neither working page has one).
- Any restructuring of the pages' visual design, filters, sort, comparison drawer, "Find My Match"/Savings-wizard tools, PDF report content — untouched; only data source + apply-submission wiring changes.
- `business-loans-in-uae.html`/`pos-loans-in-uae.html`'s existing `minVintageYears`/`repaymentStyle` fields (confirmed dead — never read by that page's own JS) — not being resurrected or backed by new schema fields.

## Testing / verification

No test framework exists (repo or standalone pages). Verification:
- **Backend additions:** `node -e` model/route sanity checks, curl round-trips (list + apply) for the two new endpoints and the `loanType`-accepting change to `submitWebLoanApply`, mirroring exactly how the Account Products and Loan Sub-type Milestones plans were verified earlier in this project. Task-level and final whole-branch SDD review, same as those two plans.
- **The 7 HTML files:** since there's no browser tool available to implementing agents, verify the mapping logic itself via a Node script that fetches the real public endpoint and runs each page's new mapping function's logic against the response (checking the resulting objects have every field name the page's own filter/render code reads — the exact field lists are already catalogued in the investigation this spec is based on), plus a curl-based real apply-submission proving a real `Lead` is created with the right `productType`/`loanType`/`accountType`/`loanProduct`/`accountProduct`. Visual/browser confirmation (does the page still look and filter correctly) is an explicitly disclosed gap for a human to close, same as every other piece of this project.
