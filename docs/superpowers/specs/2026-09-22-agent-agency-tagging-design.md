# Agent-under-Agency tagging + agency override commission

## Client requirement (verbatim context)

> At New Sign up Register as Agency it works also as an agent to submit leads, but that agency will have employees, if the agency creates any account for the agent under that then this agent should be tagged under the agency, because we will slightly pay higher commission to the agency.
>
> Example: California works with MySilah to give agents and leads. If we pay an agent AED 800 on our portal for a card, we pay California AED 850 — AED 800 goes to the agent, AED 50 by default goes to California, whenever that agent's lead gets booked (disbursed).
>
> Whenever any agency tries to become part [of the platform], it should first be approved by admin.

## Status of the three parts

1. **Admin approval for new agency signups** — already implemented today (`registerAgency` sets `isActive: false`, `registrationStatus: 'pending'`; admin approves in the Agencies page). Nothing to build.
2. **Agency can act as its own agent (submit leads directly)** — new, scoped below.
3. **Agency creates Agent accounts under itself; that agent's disbursed leads earn the agency an extra, admin-set AED amount** — new, scoped below.

## Decisions already confirmed with the user

- The override is a **fixed AED amount**, not a percentage.
- It is **set by admin, per bank product** (alongside the existing per-bracket `receivable`/`payable` commission amounts).
- An agent becomes tagged to an agency because **the agency creates the agent's account** (like adding an Employee today), not via self-signup with a code.
- When an **agency submits a lead itself**, it simply earns the normal full agent commission (e.g. AED 800) — no separate override, since there's no separate agent being paid.

## Data model changes

- **`User.js`**: no new field needed. The existing `agency` field (`ObjectId ref User`, currently populated only for `employee` accounts) gets populated for `agent` accounts too, when an agency creates the agent. `role: 'agent'` + `agency: <agencyId>` together mean "this agent belongs to this agency."
- **`CardProduct.js` / `LoanProduct.js`**: each entry in `commissionBrackets` gets one new field: `agencyOverride: { type: Number, default: 0 }`, sitting alongside the existing `receivable`/`payable` fields on the same bracket. Admin sets it in the same bracket editor UI used today.
- **`Lead.js`**: two new fields, locked at approval/disbursement exactly like `grossCommission`/`commission` are today:
  - `agencyOverrideAmount: { type: Number, default: 0 }` — the AED amount earned.
  - `agencyOverrideAgency: { type: ObjectId, ref: 'User', default: null }` — which agency earns it (snapshotted at lock time, so a later change to the agent's tag doesn't retroactively move already-locked money).

## Backend logic

- **`commission.service.js`**: `resolveCommissions(lead)` also returns `agencyOverride` from the matched bracket (0 if the lead's agent has no `agency` tag, or if the bracket has no override set). `recalcOnStatusChange` locks `agencyOverrideAmount`/`agencyOverrideAgency` the same way it already locks `grossCommission`/`commission` on `approved` → re-locks on `disbursed` → zeroes on `rejected`.
- **Agency creates an Agent**: new agency-scoped endpoints mirroring `employee.controller.js`'s create/update/list, but `role: 'agent'` instead of `'employee'` (no `employeeType`). New file `agent.controller.js` + `agent.routes.js` (or extend the existing agent-facing routes — decided during implementation) so it doesn't get tangled with the *employee* CRUD, which is a separate concept (`cpv`/`sales`/`coordinator`/`account`, not agents).
- **Agency submitting its own lead**: the existing `POST /api/leads` (currently `requireRole('agent')`) also accepts role `agency`. `req.user._id` becomes `lead.agent` either way — an agency acting as its own agent is simply a `Lead.agent` pointing at an agency-role user. (`resolveCommissions`/payout logic already key off `lead.agent`, so this needs no special-casing elsewhere — an agency-as-agent lead just never has an `agencyOverride`, since `lead.agent.agency` is empty for an agency-role user acting on its own behalf.)

## Frontend changes

- **Agency Panel → new "Agents" page**, mirroring `agency/Employees.jsx`: Add/Edit agent (name, email, password), list of agents this agency has created.
- **Agency Panel → "New Lead"**: reuse the existing agent `SubmitLead.jsx` flow, made reachable for the `agency` role too (new sidebar item + route `/agency/leads/new`).
- **Admin Card/Loan Products → bracket editor**: one more input per bracket, "Agency Override (AED)", next to the existing Receivable/Payable inputs.
- **Visibility of override earnings**: surfaced as a read-only total (e.g. on the agency's own dashboard, and/or added as a column to the existing admin `AgencyLedger.jsx`, grouped by `lead.agencyOverrideAgency` — a different grouping key than that page's current `lead.agency` receivable/payable columns, so it's an additional column, not a replacement). **Actually paying out** that money reuses the existing manual `AgencyPayout` flow admin already uses — no new payout-batching feature in this first pass.

## Out of scope (not asked for, not building)

- No self-service "agent signs up with an agency code" path — only agency-creates-agent.
- No per-agency-configurable override amount — it's admin-set per product, same for every agency.
- No automatic payout/settlement workflow for the override — admin pays it out manually like other agency payouts today, just with the locked `agencyOverrideAmount` as visible reference data.
