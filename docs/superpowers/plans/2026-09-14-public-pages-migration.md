# Public Pages Live Data Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 7 static public pages in `/Users/developer/Downloads/` from hardcoded product data + fake Apply forms to live backend data + real lead-creating submissions, exactly mirroring how `personal-loans-in-uae.html` already does it — without changing how any page looks, filters, sorts, or compares.

**Architecture:** Each file's hardcoded `const LOANS = [...]` array is replaced with `let LOANS = []; let BANKS = [];` plus an `async function initData()` that fetches the real catalog, filters to this file's one category, maps each real document into that file's *existing* internal item shape (same field names the file's own render/filter code already reads — nothing there changes), and then triggers the same initial-render call the page used to run synchronously. Apply forms get real `fetch()` calls to the matching backend endpoint. This is the exact pattern `personal-loans-in-uae.html`'s `initData()` already uses — read it as the reference implementation before starting any task.

**Tech Stack:** Plain HTML/JS (no framework, no build step) for the 7 files. Depends on `docs/superpowers/plans/2026-09-14-public-pages-backend.md` (all 3 tasks) being complete first — every task here needs the new `/api/public/account-products`, `/api/public/account-apply`, and `loanType`-accepting `/api/public/loan-apply` endpoints, plus the new `LoanProduct`/`AccountProduct` fields, to exist.

**Spec:** `docs/superpowers/specs/2026-09-14-public-pages-live-data-design.md` (Parts 2-4)

## Global Constraints

- **These 7 files are NOT part of the git repo** — they live in `/Users/developer/Downloads/`. There is no git history for them; "verify" here means diffing a backup copy taken before editing (`cp file.html file.html.bak` before starting, `diff file.html.bak file.html` to review the actual change, delete the `.bak` once confirmed correct), not git commits.
- Additive/non-disruptive only: every existing render/filter/sort/comparison/wizard function in each file must keep working completely unchanged — read `personal-loans-in-uae.html`'s `initData()` (and the whole file, if useful context) as the working reference pattern before touching anything.
- `credit-cards-in-uae.html` and `personal-loans-in-uae.html` are not touched by any task in this plan.
- Callback ("Request a Callback") mini-forms are explicitly out of scope for every file — leave them exactly as they are.
- No test framework — verification is a Node script simulating the real fetch+map against the live API (proving the mapped objects carry every field name the page's own code reads), plus a curl-based real Apply submission proving a real `Lead` lands with the right fields, plus disclosing that visual/browser confirmation (does the page still render/filter/look right) is a gap for a human to close — no browser tool is available to any implementer here.
- Every implementer's first step, before writing anything, is to `cp` a backup of its target file(s), then re-read the current exact content around: (a) the `const LOANS = [...]`/`const BANKS = [...]` declarations, (b) the `document.addEventListener("DOMContentLoaded", function(){...})` handler — to find exactly which call(s) inside it perform the *initial* product-list render (the thing that needs to move into `initData()`'s tail, to run after the fetch resolves instead of synchronously). Everything else in that handler stays exactly where it is. This spec cannot give you exact pre-verified line numbers for this part — the investigation this plan is based on catalogued *field names*, not every internal render-call site — so read the file yourself before editing.

---

### Task 1: `business-loans-in-uae.html` + `pos-loans-in-uae.html` (paired — same dataset, same shape)

**Files:**
- Modify: `/Users/developer/Downloads/business-loans-in-uae.html`
- Modify: `/Users/developer/Downloads/pos-loans-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/loan-products` (existing, already returns `loanCategory`), `POST /api/public/loan-apply` (existing + Task 1 of the backend plan's `loanType` addition).
- Produces: nothing else depends on these two files.

- [ ] **Step 1: Back up both files**

```bash
cp "/Users/developer/Downloads/business-loans-in-uae.html" "/Users/developer/Downloads/business-loans-in-uae.html.bak"
cp "/Users/developer/Downloads/pos-loans-in-uae.html" "/Users/developer/Downloads/pos-loans-in-uae.html.bak"
```

- [ ] **Step 2: Read the current exact content of both files' `LOANS`/`BANKS` declarations and their `DOMContentLoaded` handler**

Both files currently have their entire `LOANS` array as ONE minified line (`const LOANS = [{"id":"biz-adcb-1",...}, ...]`, confirmed ~32,000 characters) with a `BANKS` array on the line right above it, and `PAGE_VERTICAL = "biz"` (business-loans) / `"pos"` (pos-loans) defined nearby. Read enough surrounding context in each file to know exactly where these lines sit and what runs in each file's `DOMContentLoaded` handler.

- [ ] **Step 3: Replace the hardcoded arrays with a live fetch, in BOTH files**

In each file, replace the `const BANKS = [...]; const LOANS = [...];` pair with:
```js
let BANKS = [];
let LOANS = [];

async function initData(){
  try {
    const resp = await fetch(API_BASE + '/api/public/loan-products');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) { console.warn('[Loans] API returned no data'); return; }

    const bankMap = {};
    LOANS = data
      .filter(l => l.loanCategory === PAGE_VERTICAL_CATEGORY && l.bank?.name)
      .map(l => {
        const bankName = l.bank.name;
        const bankId = slugify(bankName);
        if (!bankMap[bankId]) {
          bankMap[bankId] = { id: bankId, name: bankName, short: l.bank.code || bankName.slice(0,3).toUpperCase(), url: '#', sourceLabel: l.sourceLabel || bankName };
        }
        return {
          id: l._id, category: PAGE_VERTICAL, bankId, bank: bankName, product: l.name,
          type: l.loanType || 'Conventional', rateBasis: l.rateBasis || 'reducing',
          rateMin: l.rateMin ?? null, rateMax: l.rateMax ?? null, rateDisplay: l.interestRateRange || '',
          minTurnover: l.minTurnover ?? null, minPosHistoryMonths: l.minPosHistoryMonths ?? null,
          maxAmount: l.maxAmountNum ?? null, maxAmountNote: l.maxAmountNote || '',
          tenureMax: l.tenureMaxMonths ?? null, processingFee: l.processingFee || 'Not publicly disclosed',
          earlySettlement: l.earlySettlement || 'Not publicly disclosed', lateFee: l.lateFee || 'Not publicly disclosed',
          collateralRequired: l.collateralRequired || false, tags: l.tags || [],
          features: htmlToList(l.benefits), eligibility: stripHtml(l.feesEligibility),
          source: l.source || '', sourceLabel: l.sourceLabel || '',
        };
      });
    BANKS = Object.values(bankMap);
  } catch (err) {
    console.error('[Loans] Failed to load data:', err);
  }
}
initData();
```
Where `PAGE_VERTICAL_CATEGORY` is `'business'` in business-loans-in-uae.html and `'pos_loan'` in pos-loans-in-uae.html (write the literal string, not a variable — there is no such variable in the file today). Keep the existing `PAGE_VERTICAL` constant (`"biz"`/`"pos"`) exactly as it is — it's still used elsewhere in the file for the `VERTICALS`/`LR`-prefix logic, only the raw hardcoded data source changes.

You'll need two small helpers these files don't currently have — add them right above `initData()` (copy `personal-loans-in-uae.html`'s versions verbatim, they're plain utility functions with no dependencies):
```js
function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function htmlToList(html){ if(!html) return []; const div=document.createElement('div'); div.innerHTML=html; return Array.from(div.querySelectorAll('li')).map(li=>li.textContent.trim()).filter(Boolean); }
function stripHtml(html){ if(!html) return ''; const div=document.createElement('div'); div.innerHTML=html; return div.textContent.trim(); }
```

Then add the standard `API_BASE` constant right before `initData()` (neither file has one today):
```js
const API_BASE = (location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:8000' : 'https://api.mysilah.ae';
```

- [ ] **Step 4: Move the initial render trigger into `initData()`'s tail**

Per the Global Constraints: find whatever call(s) inside each file's `DOMContentLoaded` handler currently perform the first product-list render (likely something like `renderBankFilterList(); applyAllFilters('LR');` or similar — read the actual handler to find the real call). Remove that specific call from `DOMContentLoaded` and add it to the end of `initData()`'s `try` block (after `BANKS = Object.values(bankMap);`), so the initial render happens once real data has arrived instead of on a synchronous empty array. Leave every other line in `DOMContentLoaded` untouched, in its original order.

- [ ] **Step 5: Wire the real Apply form in BOTH files**

Each file's Apply form is `<form id="applyFormLR" onsubmit="submitApply('LR', event)">` with fields (per file, no `id` attributes currently — you'll need to add `id`s to read their values, since `submitApply` today reads nothing): Full Name, Company/Business Name, Mobile, Email, Amount Needed (AED), Business Trading Since (year — business-loans only, not read by pos-loans' apply flow if the field isn't relevant there), Monthly Turnover (AED), Company Status (select).

Give each of those inputs an `id` (e.g. `afNameLR`, `afCompanyLR`, `afMobileLR`, `afEmailLR`, `afAmountLR`, `afTurnoverLR`, `afCompanyStatusLR`) if they don't already have one — check first, some already do (`#afNameLR`/`#afCompanyLR`/`#afMobileLR`/`#afEmailLR` per the investigation; only the amount/trading-since/turnover/company-status inputs lack ids).

Replace `submitApply(vKey, ev)` (currently just toggles CSS classes) with:
```js
async function submitApply(vKey, ev){
  ev.preventDefault();
  const P = VERTICALS[vKey].prefix;
  const btn = document.querySelector('#applyForm'+P+' .af-submit') || document.querySelector('#applyForm'+P+' button[type=submit]');
  const errorEl = document.getElementById('applyFormError'+P);
  const phone = document.getElementById('afMobile'+P).value.replace(/[\s\-]/g,'');
  if (!/^5\d{8}$/.test(phone)) {
    alert('Enter 9 digits starting with 5 (e.g. 501234567)');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  try {
    const resp = await fetch(API_BASE + '/api/public/loan-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: document.getElementById('afName'+P).value.trim(),
        phone: '971' + phone,
        email: document.getElementById('afEmail'+P).value.trim(),
        salary: null,
        loanAmount: document.getElementById('afAmount'+P)?.value || null,
        loanProductId: window['_applyLoanId'+P] || null,
        loanType: vKey === 'LR' ? (PAGE_VERTICAL === 'pos' ? 'pos_loan' : null) : null,
      }),
    });
    if (!resp.ok) { const d = await resp.json(); throw new Error(d.message || 'Submission failed'); }
    document.getElementById('applyForm'+P).style.display = 'none';
    document.getElementById('applySuccess'+P).classList.add('show');
  } catch (err) {
    if (errorEl) { errorEl.textContent = 'Error: ' + err.message; errorEl.style.display = ''; }
    else alert('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Eligibility Check →'; }
  }
}
```
(`window['_applyLoanId'+P]` — check whether the file already sets a variable like this when a specific product's "Apply" button is clicked to open this modal; if it does, reuse it exactly as named. If no such tracking variable exists yet, you'll need to find wherever the Apply modal is opened for a specific loan card and set `window['_applyLoanId'+P] = loan.id;` there, mirroring how `credit-cards-in-uae.html` sets `window._applyCardId` when its own Apply modal opens.)

Per the spec: Business Loan (`business-loans-in-uae.html`) sends no `loanType` (leave it `null` for that file — only pos-loans-in-uae.html's copy of this function sends `'pos_loan'`). Simplest correct approach: write this function slightly differently per file rather than trying to make one shared snippet branch on `PAGE_VERTICAL` for this — in business-loans-in-uae.html, the `loanType` line is just `loanType: null,`; in pos-loans-in-uae.html it's `loanType: 'pos_loan',`.

- [ ] **Step 6: Verify — Node script proves the mapping works against the real API**

```bash
node -e "
fetch('http://localhost:8000/api/public/loan-products').then(r=>r.json()).then(data => {
  const biz = data.filter(l => l.loanCategory === 'business' && l.bank?.name);
  const pos = data.filter(l => l.loanCategory === 'pos_loan' && l.bank?.name);
  console.log('business matches:', biz.length, biz[0] && biz[0].name);
  console.log('pos_loan matches:', pos.length, pos[0] && pos[0].name);
});
"
```
Expected: at least the loan products seeded earlier in this project show up (`Aafaq Business Finance`/`Aafaq Islamic Finance` for business; `Mashreq POS Machine Finance`/`RAKBANK SME POS Finance` for pos_loan) — if this prints 0 for either, something's wrong with the category filter string, fix before continuing.

- [ ] **Step 7: Verify — a real apply submission from each file's logic**

```bash
node -e "
require('dotenv').config();
const http = require('http');
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname:'localhost', port:8000, path, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} }, res => {
      let raw=''; res.on('data',c=>raw+=c); res.on('end',()=>resolve({status:res.statusCode, body:JSON.parse(raw||'{}')}));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}
(async () => {
  const r1 = await post('/api/public/loan-apply', { customerName:'TEST biz apply', phone:'971501110010', email:'t@example.com', loanType: null });
  console.log('business apply:', r1.status, r1.body);
  const r2 = await post('/api/public/loan-apply', { customerName:'TEST pos apply', phone:'971501110011', email:'t@example.com', loanType: 'pos_loan' });
  console.log('pos apply:', r2.status, r2.body);
})();
"
```
Expected: both `201`. Clean up both test leads via a `Lead.deleteMany({customerName:{\$in:['TEST biz apply','TEST pos apply']}})` script, same pattern used throughout this project.

- [ ] **Step 8: Disclose the browser-verification gap**

State clearly in your report: the page's actual visual rendering (bank cards populate, filters/sort/compare still work against real data, the Apply modal opens correctly and submits) was not verified in a browser — no browser tool available. This needs a human to open both pages and click through before considering this task fully done.

- [ ] **Step 9: Clean up backups once you're confident the diff is correct**

```bash
diff "/Users/developer/Downloads/business-loans-in-uae.html.bak" "/Users/developer/Downloads/business-loans-in-uae.html"
diff "/Users/developer/Downloads/pos-loans-in-uae.html.bak" "/Users/developer/Downloads/pos-loans-in-uae.html"
```
Review both diffs are exactly what's described above (the `LOANS`/`BANKS` swap, the moved render-trigger call, the `submitApply` rewrite) and nothing else changed. Then:
```bash
rm "/Users/developer/Downloads/business-loans-in-uae.html.bak" "/Users/developer/Downloads/pos-loans-in-uae.html.bak"
```

---

### Task 2: `auto-loan-in-uae.html`

**Files:**
- Modify: `/Users/developer/Downloads/auto-loan-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/loan-products` filtered to `loanCategory === 'auto_loan'`, `POST /api/public/loan-apply` with `loanType: 'auto_loan'`.

- [ ] **Step 1: Back up the file**

`cp "/Users/developer/Downloads/auto-loan-in-uae.html" "/Users/developer/Downloads/auto-loan-in-uae.html.bak"`

- [ ] **Step 2: Read the current exact content**

The `BANKS`/`LOANS` arrays are around lines 1810-1837 (confirmed: `LOANS` closes with `];` right before a `</script>` tag, and a SEPARATE `<script>` tag with all the render/filter logic follows). Read the `DOMContentLoaded` handler (around line 3751) in full to find exactly which call performs the initial bank-card render.

- [ ] **Step 3: Replace the hardcoded arrays with a live fetch**

Same pattern as Task 1, adapted to this file's item shape (per the investigation, this file's consumed fields are: `bank, bankId, disclosedNote, earlySettlement, eligibility, features, id, lateFee, maxAmount, maxAmountNote, minSalary, processingFee, product, rateBasis, rateDisplay, rateMax, rateMin, rateType, salaryTransferRequired, source, tags, tenureMax, type`):
```js
let BANKS = [];
let LOANS = [];
const API_BASE = (location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:8000' : 'https://api.mysilah.ae';

function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function htmlToList(html){ if(!html) return []; const div=document.createElement('div'); div.innerHTML=html; return Array.from(div.querySelectorAll('li')).map(li=>li.textContent.trim()).filter(Boolean); }
function stripHtml(html){ if(!html) return ''; const div=document.createElement('div'); div.innerHTML=html; return div.textContent.trim(); }

async function initData(){
  try {
    const resp = await fetch(API_BASE + '/api/public/loan-products');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) { console.warn('[AutoLoan] API returned no data'); return; }
    const bankMap = {};
    LOANS = data
      .filter(l => l.loanCategory === 'auto_loan' && l.bank?.name)
      .map(l => {
        const bankName = l.bank.name;
        const bankId = slugify(bankName);
        if (!bankMap[bankId]) bankMap[bankId] = { id: bankId, name: bankName, short: l.bank.code || bankName.slice(0,3).toUpperCase(), url: '#', sourceLabel: l.sourceLabel || bankName };
        return {
          id: l._id, bankId, bank: bankName, product: l.name, type: l.loanType || 'Conventional',
          rateType: l.rateType || '', rateMin: l.rateMin ?? null, rateMax: l.rateMax ?? null,
          rateDisplay: l.interestRateRange || '', minSalary: l.minSalary ?? null,
          maxAmount: l.maxAmountNum ?? null, maxAmountNote: l.maxAmountNote || '',
          tenureMax: l.tenureMaxMonths ?? null, processingFee: l.processingFee || 'Not publicly disclosed',
          earlySettlement: l.earlySettlement || 'Not publicly disclosed', lateFee: l.lateFee || 'Not publicly disclosed',
          salaryTransferRequired: l.salaryTransferRequired ?? null, tags: l.tags || [],
          features: htmlToList(l.benefits), eligibility: stripHtml(l.feesEligibility),
          source: l.source || '', sourceLabel: l.sourceLabel || '', rateBasis: l.rateBasis || 'reducing',
          disclosedNote: l.disclosedNote || '',
        };
      });
    BANKS = Object.values(bankMap);
    // <<< move the initial render-trigger call here, e.g. renderBankFilterList(); applyAllFilters(); — find the real call in this file's DOMContentLoaded handler and move it here, don't guess the name >>>
  } catch (err) {
    console.error('[AutoLoan] Failed to load data:', err);
  }
}
initData();
```

- [ ] **Step 4: Remove that same render-trigger call from `DOMContentLoaded`**, leaving everything else in that handler untouched.

- [ ] **Step 5: Wire the real Apply form + remove EmailJS**

The Apply form (`#afFullName`, `#afMobile`, `#afEmail`, `#afSalary`, `#afLoanAmount`, `#afEmploymentStatus`, `#afEmployerName`) already has a `submitApply(e)` handler that validates, then calls `afGeneratePdf(formData, matchData)` and `afSendEmail(formData, matchData)` before showing success. Change it to:
1. Keep the validation (`afGatherFormData()`/`afValidateForm()`) and `afGeneratePdf(formData, matchData)` calls exactly as they are.
2. Remove the `afSendEmail(formData, matchData)` call.
3. Add a real submission before showing success:
```js
  const resp = await fetch(API_BASE + '/api/public/loan-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: formData.fullName, phone: '971' + formData.mobile.replace(/[\s\-]/g,''),
      email: formData.email, salary: formData.salary, loanAmount: formData.loanAmount,
      employmentStatus: formData.employmentStatus, loanProductId: window._applyLoanId || null,
      loanType: 'auto_loan',
    }),
  });
  if (!resp.ok) { const d = await resp.json().catch(()=>({})); errorEl.textContent = d.message || 'Submission failed'; errorEl.style.display=''; return; }
```
placed after the existing validation/PDF steps and before the `document.getElementById("applyFormWrap").classList.add("hide")` line (check `formData`'s actual key names from `afGatherFormData()` — use whatever it really returns, the names above are best guesses from the form's field ids and must be confirmed against the real function body before finalizing). `window._applyLoanId` needs to be set wherever this file's per-card "Apply" button opens the modal — find that click handler and set it there, mirroring `credit-cards-in-uae.html`'s `window._applyCardId` pattern, if it isn't already tracked under some other name.
4. Delete the `afSendEmail` function definition entirely, the `EMAILJS_CONFIG` object + its `emailjs.init(...)` guard, and the `<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js">` tag. Keep `afGeneratePdf` untouched.

- [ ] **Step 6: Verify — Node script proves the mapping + apply work**

Same pattern as Task 1 Steps 6-7, filtering on `loanCategory === 'auto_loan'` and submitting with `loanType: 'auto_loan'`. Clean up the test lead after.

- [ ] **Step 7: Verify no EmailJS references remain**

```bash
grep -c "emailjs\|EMAILJS_CONFIG\|afSendEmail" "/Users/developer/Downloads/auto-loan-in-uae.html"
```
Expected: `0`.

- [ ] **Step 8: Disclose the browser-verification gap** (same wording as Task 1 Step 8).

- [ ] **Step 9: Review the diff, then delete the backup**

```bash
diff "/Users/developer/Downloads/auto-loan-in-uae.html.bak" "/Users/developer/Downloads/auto-loan-in-uae.html"
rm "/Users/developer/Downloads/auto-loan-in-uae.html.bak"
```

---

### Task 3: `mortgage-loan-in-uae.html`

**Files:**
- Modify: `/Users/developer/Downloads/mortgage-loan-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/loan-products` filtered to `loanCategory === 'mortgage'`, `POST /api/public/loan-apply` with `loanType: 'mortgage_new'` or `'mortgage_buyout'`.

- [ ] **Step 1: Back up the file**

`cp "/Users/developer/Downloads/mortgage-loan-in-uae.html" "/Users/developer/Downloads/mortgage-loan-in-uae.html.bak"`

- [ ] **Step 2: Read the current exact content** — `BANKS`/`LOANS` around lines 1830-1866; `DOMContentLoaded` handler around line 3779; the Apply form around line 1571.

- [ ] **Step 3: Replace the hardcoded arrays with a live fetch**

Identical structure to Task 2 Step 3, but filter `l.loanCategory === 'mortgage'` and console-log-prefix `[Mortgage]` instead of `[AutoLoan]` — same field mapping (this file's consumed field set is identical to auto-loan-in-uae.html's, per the investigation).

- [ ] **Step 4: Move the render-trigger call**, same as Task 2 Step 4.

- [ ] **Step 5: Add the New-vs-Buyout dropdown to the Apply form**

The Apply form currently has no field distinguishing a fresh mortgage from a buyout/refinance. Add a new required `<select>` as the FIRST field in the form (before Full Name), matching the visual style of the other `<select>` in this form (`#afEmploymentStatus`):
```html
<div class="af-group">
  <label class="af-label">Mortgage Type <span style="color:#ef4444">*</span></label>
  <select class="af-input" id="afMortgageType" required>
    <option value="" disabled selected>Select one</option>
    <option value="mortgage_new">Just Need a New Mortgage</option>
    <option value="mortgage_buyout">Buyout — Refinance an Existing Mortgage</option>
  </select>
</div>
```
(Match the exact existing `<div class="af-group">`/`<label class="af-label">`/`<select class="af-input">` markup this form already uses for `#afEmploymentStatus` — copy that block's structure, don't invent new class names.)

- [ ] **Step 6: Wire the real Apply form + remove EmailJS**

Same as Task 2 Step 5, but:
- Read `document.getElementById('afMortgageType').value` and send it as `loanType` in the POST body instead of a hardcoded `'auto_loan'`.
- Add `'afMortgageType'` to whatever list `afValidateForm`/the missing-fields check already validates against, so submitting without picking New/Buyout shows the same "please complete" error the other required fields already produce (read `afValidateForm`'s actual body first to match its existing style exactly).

- [ ] **Step 7: Verify — Node script proves the mapping + both apply variants work**

Same pattern as Task 2 Step 6, but run the apply check twice — once with `loanType: 'mortgage_new'`, once with `loanType: 'mortgage_buyout'` — confirming both succeed and persist the right value. Clean up both test leads after.

- [ ] **Step 8: Verify no EmailJS references remain** (same command as Task 2 Step 7, run against this file).

- [ ] **Step 9: Disclose the browser-verification gap** (same wording as Task 1 Step 8 — also explicitly mention the new dropdown's visual placement/required-validation UX needs a human check).

- [ ] **Step 10: Review the diff, then delete the backup**

```bash
diff "/Users/developer/Downloads/mortgage-loan-in-uae.html.bak" "/Users/developer/Downloads/mortgage-loan-in-uae.html"
rm "/Users/developer/Downloads/mortgage-loan-in-uae.html.bak"
```

---

### Task 4: `business-accounts-in-uae.html`

**Files:**
- Modify: `/Users/developer/Downloads/business-accounts-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/account-products` (new, from the backend plan) filtered to `accountCategory === 'business'`, `POST /api/public/account-apply` (new) with `accountType: 'business_account'`.

- [ ] **Step 1: Back up the file**

`cp "/Users/developer/Downloads/business-accounts-in-uae.html" "/Users/developer/Downloads/business-accounts-in-uae.html.bak"`

- [ ] **Step 2: Read the current exact content** — `LOANS` array around lines 1602-1624 (sibling `BANKS` at 1590-1600); `DOMContentLoaded` around line 2432; Apply form around line 1526.

- [ ] **Step 3: Replace the hardcoded array with a live fetch**

This file's consumed fields (per the investigation): `id, bankId, bank, product, accountType, type, monthlyFee, monthlyFeeDisplay, minBalance, minBalanceDisplay, fallBelowFee, freeTransactions, multiCurrency, digitalOnboarding, businessTypesSupported, features, eligibility, source, tags`.

```js
let BANKS = [];
let LOANS = [];
const API_BASE = (location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:8000' : 'https://api.mysilah.ae';

function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function htmlToList(html){ if(!html) return []; const div=document.createElement('div'); div.innerHTML=html; return Array.from(div.querySelectorAll('li')).map(li=>li.textContent.trim()).filter(Boolean); }
function stripHtml(html){ if(!html) return ''; const div=document.createElement('div'); div.innerHTML=html; return div.textContent.trim(); }
function fmtMinBalance(n){ return (n === 0 || n == null) ? 'AED 0 (no minimum balance)' : 'AED ' + Number(n).toLocaleString(); }

async function initData(){
  try {
    const resp = await fetch(API_BASE + '/api/public/account-products');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) { console.warn('[BusinessAccounts] API returned no data'); return; }
    const bankMap = {};
    LOANS = data
      .filter(a => a.accountCategory === 'business' && a.bank?.name)
      .map(a => {
        const bankName = a.bank.name;
        const bankId = slugify(bankName);
        if (!bankMap[bankId]) bankMap[bankId] = { id: bankId, name: bankName, short: a.bank.code || bankName.slice(0,3).toUpperCase(), url: '#' };
        return {
          id: a._id, bankId, bank: bankName, product: a.name, accountType: 'Digital Business Account',
          type: a.type || 'Conventional', monthlyFee: a.monthlyFee || null, monthlyFeeDisplay: a.monthlyFee || 'Not publicly disclosed',
          minBalance: a.minBalance ?? null, minBalanceDisplay: fmtMinBalance(a.minBalance),
          fallBelowFee: a.fallBelowFee || 'Not publicly disclosed', freeTransactions: a.freeTransactions || 'Not publicly disclosed',
          multiCurrency: a.multiCurrency || false, digitalOnboarding: a.digitalOnboarding || false,
          businessTypesSupported: '', features: htmlToList(a.benefits), eligibility: stripHtml(a.feesEligibility),
          source: a.source || '', tags: a.tags || [],
        };
      });
    BANKS = Object.values(bankMap);
    // <<< move the initial render-trigger call here — find it in this file's DOMContentLoaded handler >>>
  } catch (err) {
    console.error('[BusinessAccounts] Failed to load data:', err);
  }
}
initData();
```
(`businessTypesSupported` has no matching field anywhere on `AccountProduct` and wasn't in this project's Part 1d field list — leave it as an empty string; if the page's rendering code requires a non-empty value to avoid a visual gap, note this in your report as a possible follow-up field, but don't invent a new schema field for it without asking — it's outside this plan's approved field list.)

- [ ] **Step 4: Move the render-trigger call**, same pattern as Task 2 Step 4.

- [ ] **Step 5: Wire the real Apply form**

Form fields: `#afFullName`, `#afMobile`, `#afEmail`, `#afBusinessName`, `#afBusinessType` (select), `#afTurnover`. Replace `submitApply(e)` (currently `afGatherFormData()` → `afValidateForm()` → toggle success classes, no network) — keep the validation exactly as-is, add a real submission right before the success-toggle:
```js
  const resp = await fetch(API_BASE + '/api/public/account-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: formData.fullName, phone: '971' + formData.mobile.replace(/[\s\-]/g,''),
      email: formData.email, salary: formData.turnover,
      accountProductId: window._applyAccountId || null, accountType: 'business_account',
    }),
  });
  if (!resp.ok) { const d = await resp.json().catch(()=>({})); errorEl.textContent = d.message || 'Submission failed'; errorEl.style.display=''; return; }
```
(confirm `formData`'s real key names from `afGatherFormData()`'s actual body before finalizing — the names above are best guesses from the form field ids/labels. `window._applyAccountId` needs setting wherever this file's per-card Apply button opens the modal, same pattern as the other tasks.)

- [ ] **Step 6: Verify — Node script proves the mapping + apply work**

Same pattern as Task 1 Steps 6-7, filtering `accountCategory === 'business'` and submitting to `/api/public/account-apply` with `accountType: 'business_account'`. Clean up the test lead after.

- [ ] **Step 7: Disclose the browser-verification gap** (same wording as Task 1 Step 8).

- [ ] **Step 8: Review the diff, then delete the backup.**

---

### Task 5: `current-account-in-uae.html`

**Files:**
- Modify: `/Users/developer/Downloads/current-account-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/account-products` filtered to `accountCategory === 'current'`, `POST /api/public/account-apply` with `accountType: 'current_account'`.

- [ ] **Step 1: Back up the file**

`cp "/Users/developer/Downloads/current-account-in-uae.html" "/Users/developer/Downloads/current-account-in-uae.html.bak"`

- [ ] **Step 2: Read the current exact content** — `LOANS` array around lines 1545-1561; `DOMContentLoaded` around line 2370; Apply form around line 1469.

- [ ] **Step 3: Replace the hardcoded array with a live fetch**

This file's consumed fields: `accountType, bank, bankId, digitalOnboarding, eligibility, fallBelowFee, features, id, minBalance, minBalanceDisplay, monthlyFee, monthlyFeeDisplay, multiCurrency, product, salaryTransferRequired, source, tags, type`. Same structure as Task 4 Step 3, adjusted:
```js
async function initData(){
  try {
    const resp = await fetch(API_BASE + '/api/public/account-products');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) { console.warn('[CurrentAccount] API returned no data'); return; }
    const bankMap = {};
    LOANS = data
      .filter(a => a.accountCategory === 'current' && a.bank?.name)
      .map(a => {
        const bankName = a.bank.name;
        const bankId = slugify(bankName);
        if (!bankMap[bankId]) bankMap[bankId] = { id: bankId, name: bankName, short: a.bank.code || bankName.slice(0,3).toUpperCase(), url: '#' };
        return {
          id: a._id, bankId, bank: bankName, product: a.name, accountType: 'Digital Current Account',
          type: a.type || 'Conventional', monthlyFee: a.monthlyFee ?? null, monthlyFeeDisplay: a.monthlyFee || 'Not publicly disclosed',
          minBalance: a.minBalance ?? null, minBalanceDisplay: fmtMinBalance(a.minBalance),
          fallBelowFee: a.fallBelowFee || 'Not applicable', multiCurrency: a.multiCurrency || false,
          digitalOnboarding: a.digitalOnboarding || false, salaryTransferRequired: a.salaryTransferRequired ?? null,
          features: htmlToList(a.benefits), eligibility: stripHtml(a.feesEligibility),
          source: a.source || '', tags: a.tags || [],
        };
      });
    BANKS = Object.values(bankMap);
    // <<< move the initial render-trigger call here >>>
  } catch (err) {
    console.error('[CurrentAccount] Failed to load data:', err);
  }
}
initData();
```
(Add the same `let BANKS=[]; let LOANS=[]; const API_BASE=...; slugify/htmlToList/stripHtml/fmtMinBalance` helpers above this, exactly as in Task 4 Step 3 — copy them verbatim, this file doesn't have them either.)

- [ ] **Step 4: Move the render-trigger call.**

- [ ] **Step 5: Wire the real Apply form**

Form fields: `#afFullName`, `#afMobile`, `#afEmail`, `#afBusinessName` (labelled "Employer Name" — recycled id, ignore the name), `#afBusinessType` (labelled "Employment Type"), `#afTurnover` (labelled "Monthly Salary (AED)"). Same submission pattern as Task 4 Step 5, but:
```js
      customerName: formData.fullName, phone: '971' + formData.mobile.replace(/[\s\-]/g,''),
      email: formData.email, salary: formData.turnover,
      accountProductId: window._applyAccountId || null, accountType: 'current_account',
```

- [ ] **Step 6: Verify — Node script proves the mapping + apply work**, filtering `accountCategory === 'current'`, submitting `accountType: 'current_account'`. Clean up the test lead after.

- [ ] **Step 7: Disclose the browser-verification gap.**

- [ ] **Step 8: Review the diff, then delete the backup.**

---

### Task 6: `savings-accounts-in-uae.html`

**Files:**
- Modify: `/Users/developer/Downloads/savings-accounts-in-uae.html`

**Interfaces:**
- Consumes: `GET /api/public/account-products` filtered to `accountCategory === 'savings'`, `POST /api/public/account-apply` with `accountType: 'savings_account'`.

- [ ] **Step 1: Back up the file**

`cp "/Users/developer/Downloads/savings-accounts-in-uae.html" "/Users/developer/Downloads/savings-accounts-in-uae.html.bak"`

- [ ] **Step 2: Read the current exact content** — `LOANS` array around lines 1486-1506; `DOMContentLoaded` around line 2322; Apply form around line 1412.

- [ ] **Step 3: Replace the hardcoded array with a live fetch**

This file's consumed fields: `accountType, bank, bankId, digitalOnboarding, eligibility, fallBelowFee, features, id, minBalance, minBalanceDisplay, monthlyFeeDisplay, multiCurrency, payoutFrequency, product, rateDisplay, rateMax, rateMin, salaryTransferRequired, source, tags, type`.
```js
async function initData(){
  try {
    const resp = await fetch(API_BASE + '/api/public/account-products');
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) { console.warn('[Savings] API returned no data'); return; }
    const bankMap = {};
    LOANS = data
      .filter(a => a.accountCategory === 'savings' && a.bank?.name)
      .map(a => {
        const bankName = a.bank.name;
        const bankId = slugify(bankName);
        if (!bankMap[bankId]) bankMap[bankId] = { id: bankId, name: bankName, short: a.bank.code || bankName.slice(0,3).toUpperCase(), url: '#' };
        return {
          id: a._id, bankId, bank: bankName, product: a.name, accountType: 'Digital Savings Account',
          type: a.type || 'Conventional', rateDisplay: a.interestRate || 'Not publicly disclosed',
          rateMin: null, rateMax: null,
          minBalance: a.minBalance ?? null, minBalanceDisplay: fmtMinBalance(a.minBalance),
          monthlyFeeDisplay: a.monthlyFee || 'AED 0/month', fallBelowFee: a.fallBelowFee || 'Not applicable',
          payoutFrequency: a.payoutFrequency || 'Monthly', multiCurrency: a.multiCurrency || false,
          digitalOnboarding: a.digitalOnboarding || false, salaryTransferRequired: a.salaryTransferRequired ?? null,
          features: htmlToList(a.benefits), eligibility: stripHtml(a.feesEligibility),
          source: a.source || '', tags: a.tags || [],
        };
      });
    BANKS = Object.values(bankMap);
    // <<< move the initial render-trigger call here >>>
  } catch (err) {
    console.error('[Savings] Failed to load data:', err);
  }
}
initData();
```
(`rateMin`/`rateMax` have no numeric equivalent on `AccountProduct` — `interestRate` is a free-text string, e.g. "up to 3.5% p.a.". Leave `rateMin`/`rateMax` as `null`; if this file's rendering code does math on them rather than just displaying `rateDisplay`, note that in your report rather than inventing numbers.)

- [ ] **Step 4: Move the render-trigger call.**

- [ ] **Step 5: Wire the real Apply form**

Form fields: `#afFullName`, `#afMobile`, `#afEmail`, `#afBusinessName` (labelled "Employer Name"), `#afBusinessType` (labelled "Employment Type"), `#afTurnover` (labelled "Monthly Salary (AED)"). Same pattern as Task 5 Step 5, with `accountType: 'savings_account'`.

- [ ] **Step 6: Verify — Node script proves the mapping + apply work**, filtering `accountCategory === 'savings'`, submitting `accountType: 'savings_account'`. Clean up the test lead after.

- [ ] **Step 7: Disclose the browser-verification gap.**

- [ ] **Step 8: Review the diff, then delete the backup.**
