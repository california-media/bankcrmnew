# Agent Products Catalog — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

## Overview

New page in agent portal at `/agent/products` showing all active credit card and loan products with estimated commission payouts. Agents use this as a reference before pitching products to customers.

## Data Sources

- `GET /card-products` — returns active cards (filtered by backend for non-admin), populated with `bank` (name, code, isActive), `commissionBrackets`, `cardImage`, `feeType`
- `GET /loan-products` — returns active loans, populated with `bank` (name, code, isActive), `commissionBrackets`
- Both fetched in parallel client-side, merged into single array with a `productType` discriminator field

No backend changes required.

## Stat Cards (4)

| # | Label | Value |
|---|-------|-------|
| 1 | Live Products | Total count of active cards + loans |
| 2 | Card Products | Count of credit card products |
| 3 | Loan Products | Count of loan products |
| 4 | Top Payout | Highest `payable` value across all brackets of all products, formatted as `AED X` |

## Product Grid

**Layout:** 3 columns desktop, 2 tablet (≤768px), 1 mobile (≤480px). CSS `grid` or Ant Design `Row/Col`.

**Filters above grid:**
- Search input (filter by product name, case-insensitive)
- Type filter Select: All / Credit Cards / Loans

### Product Card (each item)

```
┌─────────────────────────────────────┐
│  [Avatar]  Product Name      [Type] │
│            Bank Name                │
│            ● Authorized             │
│  ─────────────────────────────────  │
│  Commission Brackets:               │
│  ≥ AED 5,000 → AED 500             │
│  ≥ AED 8,000 → AED 800  [Free]     │
│                                     │
│  [Card image thumbnail] (cards only)│
└─────────────────────────────────────┘
```

**Avatar:** Colored circle with bank initials (first 2 letters of bank name). Color deterministic from bank name (hash → pick from 8 preset colors).

**Type tag:** `Credit Card` blue / `Personal Loan` purple (Ant Design Tag).

**Authorized badge:** Green dot + "Authorized" text (indicates agent is authorized to sell).

**Commission brackets:** Each bracket on own line — `≥ AED {minimumSalary} → AED {payable}`. For credit cards, append `Free` (green) or `Paid` (blue) tag per bracket.

**Card image:** If `cardImage` exists on credit card product, show small thumbnail (52×34px, rounded) below brackets.

## Routing & Navigation

- Route: `/agent/products` → `<Products />`
- Nav item: "Products" added to agent sidebar (after Dashboard, before My Leads or similar position)
- Component file: `frontend/src/pages/agent/Products.jsx`

## Component Architecture

Single file `Products.jsx`:
- `useEffect` parallel fetch both endpoints
- `useMemo` for filtered list and stat computations
- `BankAvatar` inline helper (colored initials)
- No subcomponents extracted — page is self-contained

## Error Handling

- Loading skeleton while fetching
- Empty state if no products match filter
- Fetch errors shown via `message.error`
