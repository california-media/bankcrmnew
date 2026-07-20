# Leads MIS Excel Export

## Problem

Admin and agency users have no way to get lead/pipeline data out of the app for offline reporting (MIS reports) — no export button exists anywhere, and no xlsx/csv library is installed in the frontend.

## Scope

- **Export only.** Import (bulk create/update leads from a spreadsheet) is explicitly deferred to a future request.
- Restricted to admin and agency roles — enforced implicitly by page location: the button lives on `frontend/src/pages/admin/Leads.jsx` (already admin-only via routing) and `frontend/src/pages/agency/Leads.jsx` (already agency-only via routing). No new backend endpoint, no new auth check needed.
- Exports the **currently filtered view** — both pages already compute a client-side `filtered` array (status/product/search filters applied) that feeds their `<Table dataSource={filtered}>`. The export button reads from that same array, so it always matches what's on screen.
- Client-side generation only — add the `xlsx` (SheetJS) package to `frontend/package.json`; no backend route, no server round trip.

## Columns

In this order:

| Column | Source |
|---|---|
| Reference | `leadNumber` |
| Customer Name | `customerName` |
| Phone | `phone` |
| Bank | `bank?.name` |
| Product | `cardProduct?.name` or `loanProduct?.name` depending on `productType` |
| Status | `status` (raw enum value — `draft`/`submitted`/`under_review`/`assigned`/`approved`/`rejected`/`disbursed`) |
| Commission Status | `commissionStatus` (`none`/`pending`/`payable`/`paid`) |
| Agent | `agent?.name || agent?.email` |
| Agency | `agency?.name || agency?.email` — **admin export only**, omitted on the agency page's export since every row is that same agency |
| Created | `createdAt`, formatted `DD MMM YYYY` |
| Last Updated | `updatedAt`, formatted `DD MMM YYYY` |

No "Disbursed Date" column — the Lead model has no dedicated disbursed-at timestamp (only `disbursementReceiptAt`, which is agency-receipt-specific, not a general disbursement date), so "Last Updated" is the honest substitute.

## Frontend

- `frontend/package.json`: add `xlsx` dependency.
- New shared helper `frontend/src/utils/exportLeadsExcel.js`: exports one function `exportLeadsToExcel(leads, { includeAgency })` that builds the column set above (conditionally including "Agency") and triggers a browser download named `leads-mis-report-<YYYY-MM-DD>.xlsx` via `XLSX.writeFile`.
- `frontend/src/pages/admin/Leads.jsx`: add an "Export to Excel" button near the existing filter controls, calling `exportLeadsToExcel(filtered, { includeAgency: true })`.
- `frontend/src/pages/agency/Leads.jsx`: add the same button, calling `exportLeadsToExcel(filtered, { includeAgency: false })`.

## Error handling

- Empty `filtered` array: button still works, produces a workbook with header row only (no special-case needed — this matches how the on-screen table would also just show "no data").
- No async/network failure modes to handle — this is synchronous, in-memory to file.

## Testing

No test framework exists in this repo — manual verification: on both pages, apply a filter, click "Export to Excel", open the downloaded file, confirm row count and column values match the filtered on-screen table.
