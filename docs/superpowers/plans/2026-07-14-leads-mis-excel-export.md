# Leads MIS Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin and agency users export the currently-filtered Leads table to a real `.xlsx` file (MIS report: reference, status, approval/commission status, and standard lead fields) — no backend changes.

**Architecture:** One shared pure-JS helper builds an array-of-objects from whatever leads array it's given (already filtered by the calling page) and hands it to the `xlsx` (SheetJS) library to write a downloadable workbook. Both `admin/Leads.jsx` and `agency/Leads.jsx` get one new button each that calls this helper with their own `filtered` array.

**Tech Stack:** `xlsx` (SheetJS) npm package, React, antd `Button`.

## Global Constraints

- Export only — no import/upload functionality in this plan.
- No new backend endpoint — the export reads data already loaded client-side.
- Access control is implicit: the button only exists on already role-gated pages (`/admin/leads`, `/agency/leads`) — no new permission checks needed.
- No test framework exists anywhere in this repo (confirmed: no `test` script in either `package.json`, no `*.test.js`/`*.spec.js` files). Do not introduce one. Verification is: `npm install` succeeds, `npx eslint` passes, `npm run build` succeeds, and a manual trace of the generated row data against the columns table below.
- Column order and source fields (verbatim from spec):

  | Column | Source |
  |---|---|
  | Reference | `leadNumber` |
  | Customer Name | `customerName` |
  | Phone | `phone` |
  | Bank | `bank?.name` |
  | Product | `cardProduct?.name` (if `productType === 'credit_card'`) or `loanProduct?.name` (if `productType === 'loan'`) |
  | Status | `status` (raw value) |
  | Commission Status | `commissionStatus` (raw value) |
  | Agent | `agent?.name \|\| agent?.email` |
  | Agency | `agency?.name \|\| agency?.email` — **admin export only** |
  | Created | `createdAt`, formatted `DD MMM YYYY` via `dayjs` |
  | Last Updated | `updatedAt`, formatted `DD MMM YYYY` via `dayjs` |

---

## File Structure

- Modify: `frontend/package.json` — add `xlsx` dependency.
- Create: `frontend/src/utils/exportLeadsExcel.js` — the shared export helper (one function, no React).
- Modify: `frontend/src/pages/admin/Leads.jsx` — add the Export button (`includeAgency: true`).
- Modify: `frontend/src/pages/agency/Leads.jsx` — add the Export button (`includeAgency: false`).

---

### Task 1: Install `xlsx` and write the shared export helper

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/utils/exportLeadsExcel.js`

**Interfaces:**
- Produces: `exportLeadsToExcel(leads, { includeAgency })` — default export from `frontend/src/utils/exportLeadsExcel.js`. `leads` is an array of lead objects shaped like what `GET /api/leads` / `GET /api/leads/agency` already return (populated `bank`, `agent`, `agency`, `cardProduct`, `loanProduct`). `includeAgency` is a boolean; when `false`, the "Agency" column is omitted entirely (not just blank). Has no return value — triggers a browser file download as a side effect.

- [ ] **Step 1: Install the `xlsx` package**

Run: `cd "frontend" && npm install xlsx --legacy-peer-deps`

(This repo's frontend has a pre-existing `react-quill` peer-dependency conflict with its React version — every `npm install` in this project needs `--legacy-peer-deps`, confirmed during prior work on this codebase.)

- [ ] **Step 2: Verify the install**

Run: `cd "frontend" && node -e "console.log(require('xlsx').version)"`
Expected: prints a version string (e.g. `0.20.x`), no error.

- [ ] **Step 3: Write the export helper**

Create `frontend/src/utils/exportLeadsExcel.js`:

```js
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '');

const productName = (lead) =>
  lead.productType === 'credit_card'
    ? lead.cardProduct?.name || ''
    : lead.productType === 'loan'
      ? lead.loanProduct?.name || ''
      : '';

export default function exportLeadsToExcel(leads, { includeAgency = false } = {}) {
  const rows = (leads || []).map((lead) => {
    const row = {
      Reference: lead.leadNumber || '',
      'Customer Name': lead.customerName || '',
      Phone: lead.phone || '',
      Bank: lead.bank?.name || '',
      Product: productName(lead),
      Status: lead.status || '',
      'Commission Status': lead.commissionStatus || '',
      Agent: lead.agent?.name || lead.agent?.email || '',
    };
    if (includeAgency) {
      row.Agency = lead.agency?.name || lead.agency?.email || '';
    }
    row.Created = fmtDate(lead.createdAt);
    row['Last Updated'] = fmtDate(lead.updatedAt);
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads MIS Report');

  const filename = `leads-mis-report-${dayjs().format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
```

- [ ] **Step 4: Manual verification**

Run:
```bash
cd "frontend" && node -e "
const dayjs = require('dayjs');
const leads = [
  { leadNumber: 'L-001', customerName: 'Test One', phone: '0501234567', bank: { name: 'ADCB' }, productType: 'credit_card', cardProduct: { name: 'Gold Card' }, status: 'approved', commissionStatus: 'pending', agent: { name: 'Agent A' }, agency: { name: 'Agency X' }, createdAt: new Date(), updatedAt: new Date() },
];
// Can't import ESM directly via require in a one-off node -e; instead confirm the row-shaping logic by hand:
const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '');
const row = {
  Reference: leads[0].leadNumber,
  'Customer Name': leads[0].customerName,
  Phone: leads[0].phone,
  Bank: leads[0].bank?.name,
  Product: leads[0].cardProduct?.name,
  Status: leads[0].status,
  'Commission Status': leads[0].commissionStatus,
  Agent: leads[0].agent?.name,
  Agency: leads[0].agency?.name,
  Created: fmtDate(leads[0].createdAt),
  'Last Updated': fmtDate(leads[0].updatedAt),
};
console.log(JSON.stringify(row, null, 2));
"
```
Expected: prints an object with all 11 fields populated with the test values (confirms the field-mapping logic before it's wired into a browser download, which can't be exercised headlessly).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/utils/exportLeadsExcel.js
git commit -m "$(cat <<'EOF'
Add xlsx dependency and shared leads MIS export helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire the Export button into admin Leads.jsx

**Files:**
- Modify: `frontend/src/pages/admin/Leads.jsx:1-6` (imports), `:288-292` (button bar)

**Interfaces:**
- Consumes: `exportLeadsToExcel` from `frontend/src/utils/exportLeadsExcel.js` (Task 1) — call as `exportLeadsToExcel(filtered, { includeAgency: true })`.
- Consumes: the page's existing `filtered` (from `useMemo`, defined at `Leads.jsx:82`) and `viewMode`/`setViewMode` button bar at `Leads.jsx:288-292` — confirm these still exist at these lines with `grep -n "const filtered\|viewMode === 'table'" frontend/src/pages/admin/Leads.jsx` before editing (line numbers may have drifted).

- [ ] **Step 1: Add the import**

In `frontend/src/pages/admin/Leads.jsx`, change:

```js
import api from '../../api/client';
```

to:

```js
import api from '../../api/client';
import exportLeadsToExcel from '../../utils/exportLeadsExcel';
```

- [ ] **Step 2: Add the button**

Find this block (currently around line 288-292):

```jsx
          <Space size={8}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{filtered.length} shown</Typography.Text>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          </Space>
```

Change it to:

```jsx
          <Space size={8}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{filtered.length} shown</Typography.Text>
            <Button onClick={() => exportLeadsToExcel(filtered, { includeAgency: true })}>Export to Excel</Button>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          </Space>
```

(If the surrounding code has drifted from this exact text, locate the `Space` containing the Table/Cards toggle buttons via the grep from this task's Interfaces section, and insert the new `Button` as the first child of that `Space`, before the Table toggle.)

- [ ] **Step 3: Lint and build**

Run: `cd "frontend" && npx eslint src/pages/admin/Leads.jsx`
Expected: no new errors introduced by this change (this file may have pre-existing baseline lint issues unrelated to this edit — compare against `git stash` if unsure which errors are pre-existing).

Run: `cd "frontend" && npm run build`
Expected: builds successfully, no errors.

- [ ] **Step 4: Manual logic trace**

Read the edited block back and confirm: the button calls `exportLeadsToExcel` with the page's `filtered` array (not the unfiltered `leads` state) and `includeAgency: true`. No browser click-through is possible in this environment (no browser tool) — this trace plus the passing build is the verification for this task.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Leads.jsx
git commit -m "$(cat <<'EOF'
Add Export to Excel button to admin Leads page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the Export button into agency Leads.jsx

**Files:**
- Modify: `frontend/src/pages/agency/Leads.jsx:1-6` (imports), `:458-466` (button bar)

**Interfaces:**
- Consumes: `exportLeadsToExcel` from `frontend/src/utils/exportLeadsExcel.js` (Task 1) — call as `exportLeadsToExcel(filtered, { includeAgency: false })`.
- Consumes: the page's existing `filtered` (from `useMemo`, defined at `Leads.jsx:256`) and the `viewMode` button bar at `Leads.jsx:458-466` — confirm these still exist at these lines with `grep -n "const filtered\|viewMode === 'table'" frontend/src/pages/agency/Leads.jsx` before editing.

- [ ] **Step 1: Add the import**

In `frontend/src/pages/agency/Leads.jsx`, change:

```js
import api from '../../api/client';
```

to:

```js
import api from '../../api/client';
import exportLeadsToExcel from '../../utils/exportLeadsExcel';
```

- [ ] **Step 2: Add the button**

Find this block (currently around line 458-466):

```jsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Lead Queue</h2>
        <Space>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
        </Space>
      </div>
```

Change it to:

```jsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Lead Queue</h2>
        <Space>
          <Button onClick={() => exportLeadsToExcel(filtered, { includeAgency: false })}>Export to Excel</Button>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
        </Space>
      </div>
```

(If the surrounding code has drifted from this exact text, locate the `Space` containing the Table/Cards toggle buttons via the grep from this task's Interfaces section, and insert the new `Button` as the first child of that `Space`.)

- [ ] **Step 3: Lint and build**

Run: `cd "frontend" && npx eslint src/pages/agency/Leads.jsx`
Expected: no new errors introduced by this change.

Run: `cd "frontend" && npm run build`
Expected: builds successfully, no errors.

- [ ] **Step 4: Manual logic trace**

Read the edited block back and confirm: the button calls `exportLeadsToExcel` with the page's `filtered` array and `includeAgency: false` (so no "Agency" column appears, since every row on this page already belongs to the logged-in agency).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/agency/Leads.jsx
git commit -m "$(cat <<'EOF'
Add Export to Excel button to agency Leads page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
