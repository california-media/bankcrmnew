# Bank CRM — Project Structure

A MERN CRM that connects three independent parties around bank-product leads (credit cards and loans):

- **Agents** find customers in the field and file leads.
- **Agencies** receive those leads, work them through review, and shepherd them to a bank decision.
- **The Admin (Mediator)** runs the master data — the banks of record, the agencies on the masthead, the commission rules — and pays agents out.

Agencies and agents are independent: no agency owns an agent, and no agent reports to an agency. The agent decides, lead by lead, which agency to file with.

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
2. Admin signs in and configures the master data:
   - **Banks** — every bank that the system will ever route leads to.
   - **Commission Rules** — for each (product, bank) pair, how many AED an agent earns when a lead is approved. A "default" rule (no bank set) acts as the fallback for that product.
   - **Volume Bonuses** — optional monthly tiers that pay agents extra when they cross approved-lead thresholds (e.g. 10 approvals = AED 1,000 bonus).
3. Admin invites agencies one at a time:
   - Enter the agency's email + pick the banks that agency is allowed to service.
   - System creates an inactive `User { role: agency }` with a 24-hour `inviteToken`.
   - An invite email is sent (Gmail SMTP); in dev (no SMTP), the invite URL is also returned in the API response so the admin can copy it from the modal.

### 2.2 Agency activation
1. Agency clicks the invite link → lands on `/set-password?token=…`.
2. The token is verified, the agency picks a name + password, account is activated, JWT issued, redirected to `/agency`.
3. The agency now sees the banks they were assigned. They have nothing to do until an agent files a lead with them.

### 2.3 Agent registration
1. Agent self-registers at `/register` (no admin involvement).
2. Optionally enters a referral code from another agent — that agent becomes their `referredBy`.
3. System generates a unique 8-char `referralCode` for the new agent (used to refer further agents).
4. Account is immediately active, JWT issued, redirected to `/agent`.

### 2.4 Filing a lead (Agent) — two separate actions

**Step 1 — Create a draft.** At `/agent/leads/new`:
1. Agent enters the customer's name and phone.
2. Picks a **Product** (Credit Card or Loan).
3. Picks a **Bank**.
4. Optional notes.

The lead is saved with `status='draft'` and `agency=null`. It is the agent's private record — no agency can see it yet. The agent can also delete a draft from the actions column.

**Step 2 — Send the draft to an agency.** At `/agent/leads`, every draft row has a **Send to Agency** action:
1. Clicking it opens a modal that fetches `GET /api/agencies/for-bank/:bankId` — only active agencies whose assigned banks include this lead's bank.
2. Agent picks one and confirms.
3. The backend validates the agency services the bank, sets `lead.agency` and flips `status='submitted'`. The lead is now visible on that one agency's queue.

The split keeps "I have customer info" separate from "I've decided who handles it."

### 2.5 Working a lead (Agency)
At `/agency/leads`, the agency sees every lead filed to them. From the actions column they walk it through:

| From → To | Button | What happens |
|---|---|---|
| `submitted` → `under_review` | **Start Review** | Agency has picked it up |
| `under_review` → `assigned` | **Mark Assigned** | Agency has handed the case off to the bank |
| any non-final → `approved` | **Approve** | Lead is approved. Commission is computed from the matching CommissionRule and stored on the lead. `commissionStatus` becomes `pending`. |
| any non-final → `rejected` | **Reject** | Commission cleared. `commissionStatus` becomes `none`. |
| `approved` → `disbursed` | **Mark Disbursed** | Funds released. `commissiontStatus` becomes `payable` — meaning the agent has earned it but hasn't been paid yet. |

Agencies cannot touch leads filed to other agencies. Admins can override any status.

### 2.6 Agent visibility into their own pipeline
- `/agent` — headline numbers (commission earned, pending commission, active cases, closed deals) + recent leads + their referral code (copyable).
- `/agent/leads` — full filterable list of every lead they've filed and the current stage.
- `/agent/commissions` — the **ledger view**:
  - **Paid Out** — leads where `commissionStatus = paid`
  - **Pending Payout** — leads where `commissionStatus = payable` (disbursed, awaiting cheque)
  - **Expected Earnings** — leads where `commissionStatus = pending` (approved, not yet disbursed)
  - **Volume bonus banner** appears when the agent has crossed a monthly threshold this calendar month.
  - Reference table at the bottom shows the active CommissionRules so the agent knows what each product/bank pair is worth.

### 2.7 Paying the agent (Admin)
1. Admin opens `/admin/leads`. Every lead with `commissionStatus = payable` shows a **Mark Paid** action.
2. Clicking it sets `commissionStatus = paid` and stamps `commissionPaidAt = now`.
3. The agent's `/agent/commissions` page now shows the lead under "Commission Payments".

### 2.8 Admin oversight (today)
- `/admin` — counts across the system (agents, agencies, banks, leads by stage, commission paid vs payable).
- `/admin/leads` — every lead with full filters; mark-paid action on payable rows.
- `/admin/agents` — every agent with their summary stats (`{ totalLeads, approvedLeads, paidCommission }`) and who referred them.
- `/admin/agencies` — every agency, their assigned banks, activation status, and resend-invite for pending ones.
- `/admin/banks`, `/admin/commission-rules`, `/admin/volume-bonuses` — master-data CRUD.

### 2.9 Lead lifecycle (status diagram)

```
                ┌──────────────┐
                │    draft     │  ← agent created; agency=null; private to agent
                └──────┬───────┘
                       │ Send to Agency  (agent picks an agency)
                ┌──────▼───────┐
                │  submitted   │  ← agency now sees it on their queue
                └──────┬───────┘
                       │ Start Review
                ┌──────▼───────┐
                │ under_review │
                └──────┬───────┘
                       │ Mark Assigned
                ┌──────▼───────┐
                │   assigned   │  ← agency has handed off to the bank
                └──────┬───────┘
                       │ Approve / Reject available throughout
            ┌──────────┴──────────┐
            ▼                     ▼
      ┌──────────┐          ┌──────────┐
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
├── seed.js                 Creates default admin user (run once: `npm run seed`)
├── .env                    Secrets / config
├── config/
│   └── db.js               Mongoose connection
├── models/
│   ├── User.js             Unified user (role: admin | agency | agent), pre-save bcrypt
│   ├── Bank.js             Bank entity
│   ├── Lead.js             Lead lifecycle + commission ledger fields
│   ├── CommissionRule.js   (productType, bank?) → AED amount
│   └── VolumeBonus.js      Monthly volume-bonus tier
├── middleware/
│   └── auth.middleware.js  `protect` (JWT) + `requireRole(...roles)`
├── utils/
│   ├── token.js            JWT signing, invite-token + referral-code generators
│   └── email.js            Invite email via nodemailer (Gmail SMTP); console fallback if SMTP_HOST blank
├── services/
│   └── commission.service.js   rule resolution, recalc on status change, ledger summary, monthly bonus
├── controllers/
│   ├── auth.controller.js          registerAgent, login, verifyInvite, setPassword, me
│   ├── bank.controller.js          CRUD for banks
│   ├── agency.controller.js        Invite/list/resend (admin); listForBank (agent + admin)
│   ├── lead.controller.js          create (agent), listMine/stats/ledger (agent),
│   │                               listForAgency (agency), listAll (admin),
│   │                               updateStatus, markCommissionPaid (admin)
│   ├── commissionRule.controller.js   CRUD (admin write, all roles read)
│   ├── volumeBonus.controller.js      CRUD (admin write, all roles read)
│   └── admin.controller.js         listAgents (with stats), overview counts
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
| banks | ObjectId[] → Bank | agency-only |
| referralCode, referredBy | — | agent-only |
| inviteToken, inviteTokenExpires, isActive | — | agency invite flow |

**Bank** — `name` (unique), `code`, `description`.

**Lead**

| Field | Type | Notes |
|---|---|---|
| customerName, phone | String | |
| productType | enum | `credit_card` \| `loan` |
| bank | ObjectId → Bank | |
| status | enum | `draft`, `submitted`, `under_review`, `assigned`, `approved`, `rejected`, `disbursed` |
| agent | ObjectId → User | the filer |
| agency | ObjectId → User \| null | null while in `draft`; set when the agent sends the lead |
| commission | Number | AED, written by `commission.service.recalcOnStatusChange` |
| commissionStatus | enum | `none` \| `pending` \| `payable` \| `paid` |
| commissionPaidAt | Date | set when admin marks paid |
| notes | String | |

**CommissionRule** — `productType`, `bank` (nullable; null = default for the product), `amount` (AED), `tier` (optional label).
Resolution order in `commission.service.resolveCommissionAmount`: try `(productType, bank)`, then fall back to `(productType, null)`.

**VolumeBonus** — `threshold` (approved leads in month), `amount` (AED), `active` (bool). Highest matching threshold wins; bonuses don't stack.

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

#### Banks
| Method | Path | Role |
|---|---|---|
| GET | `/api/banks` | any |
| POST/PUT/DELETE | `/api/banks[/:id]` | admin |

#### Agencies
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/agencies` | admin | Invite by email + assign banks |
| GET | `/api/agencies` | admin | List active and pending |
| POST | `/api/agencies/:id/resend-invite` | admin | Rotate token, resend |
| GET | `/api/agencies/for-bank/:bankId` | agent, admin | Active agencies that service this bank (used by the agent's lead form) |

#### Leads
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/leads` | agent | Create a new lead as `draft` (no agency yet) |
| POST | `/api/leads/:id/send-to-agency` | agent | Pick an agency for a draft → `status='submitted'` |
| DELETE | `/api/leads/:id` | agent | Delete one of the agent's own drafts |
| GET | `/api/leads/mine` | agent | Agent's own leads |
| GET | `/api/leads/stats` | agent | Counters for dashboard (incl. `drafts`) |
| GET | `/api/leads/ledger` | agent | Earnings ledger + current monthly bonus |
| GET | `/api/leads/agency` | agency | Leads where `agency = self` |
| GET | `/api/leads` | admin | All leads, fully populated |
| PATCH | `/api/leads/:id/status` | agency, admin | Update status; recalcs commission |
| POST | `/api/leads/:id/mark-paid` | admin | Move commission `payable` → `paid` |

#### Commission rules / volume bonuses
| Method | Path | Role |
|---|---|---|
| GET | `/api/commission-rules` | any |
| POST/PUT/DELETE | `/api/commission-rules[/:id]` | admin |
| GET | `/api/volume-bonuses` | any |
| POST/PUT/DELETE | `/api/volume-bonuses[/:id]` | admin |

#### Admin oversight
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/overview` | Top-level counts (agents/agencies/banks/leads, paid/payable totals) |
| GET | `/api/admin/agents` | All agents with `{ total, approved, paidCommission }` stats |

### 3.3 Email / invite handling

`utils/email.js` uses nodemailer with Gmail SMTP when `SMTP_HOST` is set in `.env`. Otherwise, in dev, the invite URL is logged to the server console **and** returned in the API response (`inviteUrl`) so the admin can copy it from the UI.

---

## 4. Frontend

Vite + React (vanilla JS, JSX). Redux Toolkit for state. React Router v6. Ant Design only — no custom CSS beyond the two ConfigProvider tokens noted in §4.3.

```
frontend/
├── index.html
├── vite.config.js
├── .env                    VITE_API_URL=http://localhost:5000/api
└── src/
    ├── main.jsx            Renders <Provider><BrowserRouter><App/>...
    ├── App.jsx             ConfigProvider (theme tokens) + route table
    ├── index.css           Minimal global reset
    ├── api/
    │   └── client.js       axios instance, attaches Bearer token, clears on 401
    ├── store/
    │   ├── index.js        configureStore({ auth })
    │   └── slices/
    │       └── authSlice.js  login / registerAgent / setPassword / fetchMe (with JSDoc shapes)
    ├── components/
    │   ├── ProtectedRoute.jsx  Auth + role guard
    │   └── AppLayout.jsx       Sider + Header + Outlet, role-aware menu
    └── pages/
        ├── Login.jsx, Register.jsx, SetPassword.jsx
        ├── admin/
        │   ├── Dashboard.jsx, Banks.jsx, Agencies.jsx, Leads.jsx,
        │   ├── Agents.jsx, CommissionRules.jsx, VolumeBonuses.jsx
        ├── agent/
        │   ├── Dashboard.jsx, SubmitLead.jsx, MyLeads.jsx, Commissions.jsx
        └── agency/
            ├── Dashboard.jsx, Leads.jsx
```

### 4.1 Routing

| Path | Role | Page |
|---|---|---|
| `/login` | public | Login |
| `/register` | public | Agent self-registration |
| `/set-password?token=...` | public | Activate invited account |
| `/admin` | admin | Overview |
| `/admin/leads` | admin | All Leads |
| `/admin/agents` | admin | Agents |
| `/admin/agencies` | admin | Agencies |
| `/admin/banks` | admin | Banks |
| `/admin/commission-rules` | admin | Commission Rules |
| `/admin/volume-bonuses` | admin | Volume Bonuses |
| `/agent` | agent | Dashboard |
| `/agent/leads` | agent | My Leads |
| `/agent/leads/new` | agent | Submit Lead |
| `/agent/commissions` | agent | Commissions |
| `/agency` | agency | Dashboard |
| `/agency/leads` | agency | Lead Queue |

### 4.2 State

`auth` Redux slice holds `{ user, status, error, hydrated }`. JWT lives in `localStorage`. On any 401 the axios response interceptor clears the token; `ProtectedRoute` calls `fetchMe()` once per session to rehydrate.

### 4.3 Theme

Stock Ant Design components throughout. Two `ConfigProvider` token overrides only:
- `Layout.siderBg = #0f172a` and `Menu.darkItemSelectedBg = #d4a847` for the dark sidebar with gold accent.
- A few stat tiles ("Commission Earned", "Paid Out", "Commission Paid") use a soft cream background that matches the gold accent.

No custom CSS, no Google Fonts, no design libraries beyond antd.

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
npm run dev      # nodemon on :5000

# Frontend
cd frontend
npm install
npm run dev      # vite on :5173
```

Required env vars (validated at startup): `MONGO_URI`, `JWT_SECRET`. SMTP is optional in dev (invite URL is returned in the API response if unset).

---

## 7. Not yet implemented (intentionally)

Per the current scope:
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
