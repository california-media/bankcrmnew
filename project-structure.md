# Bank CRM — Project Structure

A MERN CRM that connects three independent parties around bank-product leads (credit cards and loans):

- **Agents** find customers in the field and file leads.
- **Agencies** receive those leads, work them through review, and shepherd them to a bank decision. **Each agency owns its own list of banks and its own commission rules** — the same "Emirates NBD" can exist as separate records under two different agencies, and what an agency pays per approved lead is its own decision.
- **The Admin (Mediator)** runs the user-level master data — invites agencies, creates agents, defines monthly volume bonuses — and pays agents out.

Agencies and agents are independent: no agency owns an agent, and no agent reports to an agency. The agent decides, lead by lead, which agency to file with and which of that agency's banks to use.

---

## 1. Top-level layout

```
bank_crm/
├── backend/                Node.js + Express + Mongoose API
├── frontend/               Vite + React + Redux Toolkit + Ant Design
└── project-structure.md    This document
```

---

## 2. End-to-end flow

This is the canonical journey of a lead from signup to payout. Reads top-to-bottom.

### 2.1 One-time setup (Admin)
1. Run `npm run seed` in the backend → default admin (`admin@bankcrm.local / admin123`) is created.
2. Admin signs in and:
   - Invites agencies (email-only — agencies set up their own banks and rules after activating).
   - Optionally creates agents directly via `/admin/agents → Add Agent` (immediately active, password set by admin).
   - Sets **Volume Bonuses** — system-wide monthly tiers that pay agents extra when they cross approved-lead thresholds (e.g. 10 approvals = AED 1,000 bonus).

The admin no longer manages banks or commission rules — those moved to agencies.

### 2.2 Agency activation
1. Agency clicks the invite link → lands on `/set-password?token=…`.
2. Token verified, agency picks a name + password, account activated, JWT issued, redirected to `/agency`.
3. The agency now sets themselves up:
   - **My Banks** — adds the banks they service (private to them).
   - **Commission Rules** — for each (product, bank) pair, the AED amount they pay an agent per approved lead. A "default" rule (no bank set) is the fallback for that product across the agency's banks.

### 2.3 Agent registration
- Self-serve at `/register` (optional referral code from another agent).
- **OR** admin creates the agent directly from `/admin/agents`. Either way, the account is immediately active and a unique 8-char `referralCode` is generated.

### 2.4 Filing a lead — two separate actions

**Step 1 — Create a draft.** At `/agent/leads/new`:
1. Agent enters the customer's name and phone.
2. Picks a **Product** (Credit Card or Loan).
3. Optional notes.

The lead is saved with `status='draft'`, `agency=null`, `bank=null`. It's the agent's private record. The agent can also delete a draft from the actions column on My Leads.

**Step 2 — Send the draft.** From `/agent/leads`, every draft row has a **Send to Agency** action. The modal walks the agent through:
1. Pick an active **agency** (any active agency on the platform — `/api/agencies/active`).
2. Pick a **bank** from that agency's bank list (`/api/banks/for-agency/:agencyId`).
3. Confirm.

The backend validates the bank belongs to the chosen agency, sets `lead.agency` + `lead.bank`, and flips status to `submitted`. Only that one agency now sees the lead.

**Admin can also do step 2** on behalf of an agent. From `/admin/leads`, drafts have the same Send to Agency button — useful when an agent gets stuck or asks for routing help.

### 2.5 Working a lead (Agency)
At `/agency/leads`, the agency sees every lead filed to them. From the actions column they walk it through:

| From → To | Button | What happens |
|---|---|---|
| `submitted` → `under_review` | **Start Review** | Agency has picked it up |
| `under_review` → `assigned` | **Mark Assigned** | Agency has handed the case off to the bank |
| `assigned` → `approved` | **Approve** | Lead is approved. Commission is computed from the agency's matching `CommissionRule` and stored on the lead. `commissionStatus='pending'`. |
| `approved` → `disbursed` | **Mark Disbursed** | Funds released. `commissionStatus='payable'` — agent has earned it but hasn't been paid yet. |
| any of `submitted` / `under_review` / `assigned` / `approved` → `rejected` | **Reject** | Commission cleared. `commissionStatus='none'`. |

**Approve is gated:** it only appears once the lead reaches `assigned`. **Reject is open throughout** — available at every non-terminal stage including `approved`. Admin can override any transition.

Agencies cannot touch leads filed to other agencies.

### 2.6 Agent visibility into their own pipeline
- `/agent` — headline numbers (commission earned, pending commission, active cases, closed deals) + recent leads + their referral code (copyable).
- `/agent/leads` — full filterable list of every lead they've filed and the current stage. Drafts get **Send to Agency** + **Delete** actions.
- `/agent/commissions` — the **ledger view**:
  - **Paid Out** — `commissionStatus='paid'`
  - **Pending Payout** — `commissionStatus='payable'` (disbursed, awaiting cheque)
  - **Expected Earnings** — `commissionStatus='pending'` (approved, not yet disbursed)
  - **Volume bonus banner** when the agent has crossed a monthly threshold this month
  - Active **Volume Bonus** tiers shown for reference

### 2.7 Paying the agent (Admin)
1. Admin opens `/admin/leads`. Every lead with `commissionStatus='payable'` has a **Mark Paid** action.
2. Clicking it sets `commissionStatus='paid'` and stamps `commissionPaidAt = now`.
3. The agent's `/agent/commissions` page now lists the lead under "Commission Payments".

### 2.8 Admin oversight
- `/admin` — counts across the system (agents, agencies, leads by stage, commission paid vs payable).
- `/admin/leads` — every lead with full filters; **Send to Agency** on drafts, **Mark Paid** on payable rows.
- `/admin/agents` — every agent with their summary stats (`{ total, approved, paidCommission }`); **Add Agent** modal creates one directly.
- `/admin/agencies` — every agency, activation status, **Resend Invite** for pending ones.
- `/admin/volume-bonuses` — CRUD for monthly bonus tiers (system-wide).

### 2.9 Lead lifecycle (status diagram)

```
                ┌──────────────┐
                │    draft     │  ← agent created; private to agent
                └──────┬───────┘
                       │ Send to Agency  (agent or admin picks agency + bank)
                ┌──────▼───────┐
                │  submitted   │  ← agency now sees it on their queue
                └──────┬───────┘
                       │ Start Review                         ┐
                ┌──────▼───────┐                              │ Reject is available
                │ under_review │                              │ from any of these
                └──────┬───────┘                              │ four states
                       │ Mark Assigned                        │
                ┌──────▼───────┐                              │
                │   assigned   │  ← only here can you approve │
                └──────┬───────┘                              │
                       │ Approve                              │
            ┌──────────┴──────────┐                           │
            ▼                     ▼                           │
      ┌──────────┐          ┌──────────┐ ◄───────────────────┘
      │ approved │          │ rejected │  ← terminal; commission cleared
      └────┬─────┘          └──────────┘
           │ Mark Disbursed
      ┌────▼─────┐
      │ disbursed│  ← terminal
      └──────────┘
```

### 2.10 Commission ledger lifecycle

```
   ┌──────┐    lead approved    ┌────────┐   lead disbursed   ┌─────────┐   admin marks paid   ┌──────┐
   │ none ├────────────────────►│ pending├───────────────────►│ payable ├─────────────────────►│ paid │
   └──────┘                     └────────┘                    └─────────┘                      └──────┘
        ▲    rejected → cleared
        │
   (rejection at any time clears commission back to `none`)
```

---

## 3. Backend

Express REST API. JWT-based auth. Mongoose models. CommonJS.

```
backend/
├── server.js               Express bootstrap, env validation, CORS, route mounts, error handler
├── seed.js                 Creates default admin user (`npm run seed`)
├── .env                    Secrets / config
├── config/db.js            Mongoose connection
├── models/
│   ├── User.js             Unified user (role: admin | agency | agent), pre-save bcrypt
│   ├── Bank.js             Per-agency bank (has `agency` ref)
│   ├── Lead.js             Lead lifecycle + commission ledger fields
│   ├── CommissionRule.js   Per-agency rule: (productType, bank?) → AED amount
│   └── VolumeBonus.js      System-wide monthly volume-bonus tier
├── middleware/auth.middleware.js   `protect` (JWT) + `requireRole(...roles)`
├── utils/
│   ├── token.js            JWT signing, invite-token + referral-code generators
│   └── email.js            Invite email via nodemailer (Gmail SMTP); console fallback
├── services/commission.service.js
│                           Resolves the agency's rule for a lead, recalcs commission on
│                           status change, computes monthly bonus
├── controllers/
│   ├── auth.controller.js          registerAgent, login, verifyInvite, setPassword, me
│   ├── bank.controller.js          Agency CRUD; agent/admin read by agency
│   ├── agency.controller.js        Invite/list/resend (admin); listActive (agent + admin)
│   ├── lead.controller.js          create / sendToAgency / removeDraft (agent;
│   │                               sendToAgency also admin), listMine/stats/ledger,
│   │                               listForAgency, listAll, updateStatus (with status guards),
│   │                               markCommissionPaid
│   ├── commissionRule.controller.js   Agency CRUD
│   ├── volumeBonus.controller.js      Admin CRUD; everyone reads
│   └── admin.controller.js         listAgents, overview, createAgent
└── routes/
    ├── auth.routes.js              /api/auth/*
    ├── bank.routes.js              /api/banks/*
    ├── agency.routes.js            /api/agencies/*
    ├── lead.routes.js              /api/leads/*
    ├── commissionRule.routes.js    /api/commission-rules/*
    ├── volumeBonus.routes.js       /api/volume-bonuses/*
    └── admin.routes.js             /api/admin/*
```

### 3.1 Data models

**User** — single collection for all roles.

| Field | Type | Notes |
|---|---|---|
| name, email, password, phone | — | email unique, lowercased; password bcrypt-hashed |
| role | enum | `admin` \| `agency` \| `agent` |
| referralCode, referredBy | — | agent-only |
| inviteToken, inviteTokenExpires, isActive | — | agency invite flow |

(There is no longer a `User.banks` field — banks live in the Bank collection with an `agency` ref.)

**Bank** — `name`, `code`, `description`, **`agency` (required ref to a User with role=agency)**. Two agencies can each have their own "Emirates NBD".

**Lead**

| Field | Type | Notes |
|---|---|---|
| customerName, phone | String | |
| productType | enum | `credit_card` \| `loan` |
| bank | ObjectId → Bank \| null | null while in `draft`; set at send-to-agency |
| status | enum | `draft`, `submitted`, `under_review`, `assigned`, `approved`, `rejected`, `disbursed` |
| agent | ObjectId → User | the filer |
| agency | ObjectId → User \| null | null while in `draft`; set at send-to-agency |
| commission | Number | AED, written by `commission.service.recalcOnStatusChange` |
| commissionStatus | enum | `none` \| `pending` \| `payable` \| `paid` |
| commissionPaidAt | Date | set when admin marks paid |
| notes | String | |

**CommissionRule** — `productType`, `bank` (nullable; null = agency's default for that product), `amount` (AED), `tier` (optional label), **`agency` (required)**. Resolution in service: try `(agency, productType, bank)`, fall back to `(agency, productType, null)`.

**VolumeBonus** — `threshold`, `amount`, `active`. System-wide. Highest matching threshold wins; bonuses don't stack.

### 3.2 API endpoints

All non-public routes require `Authorization: Bearer <jwt>`.

#### Auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register-agent` | public | Agent self-registration (optional referral code) |
| POST | `/api/auth/login` | public | Single login for all 3 roles |
| GET | `/api/auth/invite/:token` | public | Verify invite token |
| POST | `/api/auth/set-password` | public | Activate invited account |
| GET | `/api/auth/me` | any | Current user (rehydrate session) |

#### Banks (per-agency)
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/banks` | agency | The calling agency's banks |
| POST | `/api/banks` | agency | Create one of the agency's banks |
| PUT | `/api/banks/:id` | agency | Update one of the agency's banks |
| DELETE | `/api/banks/:id` | agency | Delete one of the agency's banks |
| GET | `/api/banks/for-agency/:agencyId` | agent, admin | Read-only view of an agency's banks (used by Send-to-Agency) |

#### Agencies
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/agencies` | admin | Invite by email |
| GET | `/api/agencies` | admin | List all agencies |
| POST | `/api/agencies/:id/resend-invite` | admin | Rotate token, resend invite |
| GET | `/api/agencies/active` | agent, admin | Lightweight active list (used by Send-to-Agency) |

#### Leads
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/leads` | agent | Create a draft (no agency, no bank yet) |
| POST | `/api/leads/:id/send-to-agency` | agent, admin | Pick agency + bank → `submitted` |
| DELETE | `/api/leads/:id` | agent | Delete one of own drafts |
| GET | `/api/leads/mine` | agent | Agent's own leads |
| GET | `/api/leads/stats` | agent | Counters for dashboard (incl. `drafts`) |
| GET | `/api/leads/ledger` | agent | Earnings ledger + current monthly bonus |
| GET | `/api/leads/agency` | agency | Leads where `agency = self` |
| GET | `/api/leads` | admin | All leads, fully populated |
| PATCH | `/api/leads/:id/status` | agency, admin | Update status; enforces FROM-state guards (approve only from `assigned`, reject from any non-terminal-positive); recalcs commission |
| POST | `/api/leads/:id/mark-paid` | admin | Move commission `payable` → `paid` |

#### Commission rules (per-agency) / Volume bonuses (system-wide)
| Method | Path | Role |
|---|---|---|
| GET / POST / PUT / DELETE | `/api/commission-rules[/:id]` | agency |
| GET | `/api/volume-bonuses` | any |
| POST / PUT / DELETE | `/api/volume-bonuses[/:id]` | admin |

#### Admin oversight
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/overview` | Top-level counts |
| GET | `/api/admin/agents` | All agents + summary stats |
| POST | `/api/admin/agents` | Create an agent directly (admin-issued) |

### 3.3 Email / invite handling

`utils/email.js` uses nodemailer with Gmail SMTP when `SMTP_HOST` is set. Otherwise the invite URL is logged to the server console **and** returned in the API response so the admin can copy it.

---

## 4. Frontend

Vite + React (vanilla JS, JSX). Redux Toolkit. React Router v6. **Ant Design only** — no custom CSS beyond two `ConfigProvider` token overrides.

```
frontend/src/
├── App.jsx, main.jsx, index.css
├── api/client.js
├── store/{index.js, slices/authSlice.js}
├── components/
│   ├── ProtectedRoute.jsx        Auth + role guard
│   ├── AppLayout.jsx             Sider + Header + Outlet, role-aware menu
│   └── SendToAgencyModal.jsx     Reusable: agency → bank picker → POST send-to-agency
└── pages/
    ├── Login.jsx, Register.jsx, SetPassword.jsx
    ├── admin/
    │   ├── Dashboard.jsx           Overview tiles
    │   ├── Agencies.jsx            Invite + list
    │   ├── Leads.jsx               All leads + Send-to-Agency on drafts + Mark-Paid
    │   ├── Agents.jsx              List + Add Agent modal
    │   └── VolumeBonuses.jsx       CRUD
    ├── agent/
    │   ├── Dashboard.jsx           Stats + recent leads + profile/referral
    │   ├── SubmitLead.jsx          Customer + product (no bank — chosen later)
    │   ├── MyLeads.jsx             Filters + Send-to-Agency on drafts + delete
    │   └── Commissions.jsx         Paid / Payable / Expected + payments + bonus tiers
    └── agency/
        ├── Dashboard.jsx           Queue summary + bank list (fetched from /api/banks)
        ├── Leads.jsx               Queue with Approve/Reject status guards
        ├── Banks.jsx               CRUD for the agency's own banks
        └── CommissionRules.jsx     CRUD for the agency's own rules
```

### 4.1 Routing

| Path | Role | Page |
|---|---|---|
| `/login`, `/register`, `/set-password?token=…` | public | — |
| `/admin` | admin | Overview |
| `/admin/leads` | admin | All Leads |
| `/admin/agents` | admin | Agents (list + Add Agent) |
| `/admin/agencies` | admin | Agencies |
| `/admin/volume-bonuses` | admin | Volume Bonuses |
| `/agent` | agent | Dashboard |
| `/agent/leads` | agent | My Leads |
| `/agent/leads/new` | agent | New Lead (saves a draft) |
| `/agent/commissions` | agent | Commissions |
| `/agency` | agency | Dashboard |
| `/agency/leads` | agency | Lead Queue |
| `/agency/banks` | agency | My Banks |
| `/agency/commission-rules` | agency | Commission Rules |

### 4.2 State

`auth` Redux slice holds `{ user, status, error, hydrated }`. JWT in `localStorage`. On any 401 the axios response interceptor clears the token; `ProtectedRoute` calls `fetchMe()` once per session to rehydrate.

### 4.3 Theme

Stock Ant Design. Two `ConfigProvider` token overrides only:
- `Layout.siderBg = #0f172a` and `Menu.darkItemSelectedBg = #d4a847` for the dark sidebar with gold accent
- A few stat tiles use a soft cream background to match the gold accent

No custom CSS, no Google Fonts.

---

## 5. Auth model

- Single `/login` for all roles. JWT carries `{ id, role }`.
- Stored in `localStorage`, attached via axios request interceptor; 401s clear it.
- Role-based authorization on the backend (`requireRole(...)`) and frontend (`ProtectedRoute roles={[...]}`). Both must stay in sync.

---

## 6. Running locally

```bash
# Backend
cd backend
npm install
npm run seed     # one-time: create default admin
npm run dev      # nodemon on $PORT (defaults to 5000; .env may override)

# Frontend
cd frontend
npm install
npm run dev      # vite on :5173
```

Required env vars (validated at startup): `MONGO_URI`, `JWT_SECRET`. SMTP is optional (invite URL is returned in the API response if unset).

---

## 7. Not yet implemented (intentionally)

- **KYC** — Emirates ID / Visa Type / Nationality / Email on the customer record.
- **Customer employment & income** — Employer, Job Title, Monthly Salary, Years in Job.
- **Loan amount** on a Lead — useful for percentage-based commissions; today rules are flat AED only.
- **More product types** — only `credit_card` and `loan`. Mortgage / Personal Loan / Auto Loan / Business Loan are not separate types yet.
- **Quick Tips** — coaching/tip module on the agent dashboard.
- **Notifications** — bell + activity feed.

---

## 8. Tech stack

| Layer | Lib |
|---|---|
| Frontend framework | React 19 + Vite |
| State | Redux Toolkit + react-redux |
| Routing | react-router-dom v6 |
| UI | Ant Design + @ant-design/icons (no custom CSS) |
| HTTP | axios |
| Backend | Express 5 |
| ODM | Mongoose |
| Auth | jsonwebtoken + bcryptjs |
| Email | nodemailer (Gmail SMTP) |
