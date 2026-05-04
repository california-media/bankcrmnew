# Bank CRM — Project Structure

A MERN CRM for managing bank-product leads (credit cards, loans). Three independent roles: **Admin** (mediator), **Agency**, **Agent**. Agents and agencies are independent entities (no hierarchy).

---

## 1. Top-level layout

```
bank_crm/
├── backend/                Node.js + Express + Mongoose API
├── frontend/               Vite + React + Redux Toolkit + Ant Design
└── project-structure.md    This document
```

---

## 2. Backend

Express REST API. JWT-based auth. Mongoose models. CommonJS.

```
backend/
├── server.js               Express bootstrap, env validation, CORS, route mounts, error handler
├── seed.js                 Creates default admin user (run once: `npm run seed`)
├── .env                    Secrets / config (PORT, MONGO_URI, JWT_SECRET, SMTP_*, ADMIN_*, CLIENT_URL)
├── config/
│   └── db.js               Mongoose connection
├── models/
│   ├── User.js             Unified user (role: admin | agency | agent), pre-save bcrypt
│   ├── Bank.js             Bank entity (admin-managed)
│   ├── Lead.js             Lead entity with `status` lifecycle and `commissionStatus` ledger field
│   ├── CommissionRule.js   Per (productType, bank?) flat AED amount, optional tier label
│   └── VolumeBonus.js      Monthly volume-bonus tier (threshold + amount + active)
├── middleware/
│   └── auth.middleware.js  `protect` (JWT) + `requireRole(...roles)`
├── utils/
│   ├── token.js            JWT signing, invite-token + referral-code generators
│   └── email.js            Invite email via nodemailer (Gmail SMTP); console fallback if SMTP_HOST blank
├── services/
│   └── commission.service.js
│                           Resolve commission amount from rules, recalc on status change,
│                           ledger summary, monthly volume bonus computation
├── controllers/
│   ├── auth.controller.js          registerAgent, login, verifyInvite, setPassword, me
│   ├── bank.controller.js          CRUD for banks
│   ├── agency.controller.js        Invite / list / resend-invite (admin only)
│   ├── lead.controller.js          create (agent), listMine/stats/ledger (agent),
│   │                               listForAgency (agency), listAll (admin),
│   │                               updateStatus (agency claims + admin override),
│   │                               markCommissionPaid (admin)
│   ├── commissionRule.controller.js   CRUD (admin write, all roles read)
│   ├── volumeBonus.controller.js      CRUD (admin write, all roles read)
│   └── admin.controller.js         Admin oversight: listAgents (with stats), overview counts
└── routes/
    ├── auth.routes.js              /api/auth/*
    ├── bank.routes.js              /api/banks/*
    ├── agency.routes.js            /api/agencies/*  (admin only)
    ├── lead.routes.js              /api/leads/*  (mixed: agent / agency / admin per route)
    ├── commissionRule.routes.js    /api/commission-rules/*
    ├── volumeBonus.routes.js       /api/volume-bonuses/*
    └── admin.routes.js             /api/admin/*  (admin only)
```

### 2.1 Data models

**User** — single collection for all roles.

| Field | Type | Notes |
|---|---|---|
| name | String | |
| email | String | unique, lowercased |
| password | String | bcrypt hashed |
| phone | String | |
| role | enum | `admin` \| `agency` \| `agent` |
| banks | ObjectId[] → Bank | agency-only |
| referralCode | String | agent-only, unique |
| referredBy | ObjectId → User | agent-only |
| inviteToken / inviteTokenExpires | String / Date | agency invite flow |
| isActive | Boolean | |

**Bank** — `name` (unique), `code`, `description`.

**Lead**
| Field | Type | Notes |
|---|---|---|
| customerName, phone | String | |
| productType | enum | `credit_card` \| `loan` |
| bank | ObjectId → Bank | |
| status | enum | `submitted`, `assigned_to_bank`, `under_review`, `approved`, `rejected`, `disbursed` |
| agent | ObjectId → User | the filer |
| agency | ObjectId → User \| null | claiming agency (set when agency takes first action) |
| commission | Number | AED, written by `commission.service.recalcOnStatusChange` |
| commissionStatus | enum | `none` \| `pending` \| `payable` \| `paid` |
| commissionPaidAt | Date | set when admin marks paid |
| notes | String | |

**Lead lifecycle**
```
submitted → under_review → assigned_to_bank → approved → disbursed
                                            ↓
                                        rejected
```

**Commission ledger lifecycle** (mirrors `commissionStatus`):
```
none → pending (on lead approved) → payable (on lead disbursed) → paid (admin action)
```

**CommissionRule** — `productType`, `bank` (nullable; null = default for the product), `amount` (AED), `tier` (optional label). Resolution in service: try (productType, bank), fall back to (productType, null).

**VolumeBonus** — `threshold` (approved leads in month), `amount` (AED), `active` (bool). Highest matching threshold wins; bonuses don't stack.

### 2.2 API endpoints

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
| GET | `/api/banks` | any |
| POST/PUT/DELETE | `/api/banks[/:id]` | admin |

#### Agencies
| POST | `/api/agencies` | admin | Invite by email + assign banks |
| GET | `/api/agencies` | admin | List active and pending |
| POST | `/api/agencies/:id/resend-invite` | admin | Rotate token, resend |

#### Leads
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/leads` | agent | Submit a new lead (status=submitted, agency=null) |
| GET | `/api/leads/mine` | agent | Agent's own leads |
| GET | `/api/leads/stats` | agent | Counters for dashboard |
| GET | `/api/leads/ledger` | agent | Earnings ledger + current monthly bonus |
| GET | `/api/leads/agency` | agency | Leads where bank ∈ self.banks AND (agency null \| self) |
| GET | `/api/leads` | admin | All leads, fully populated |
| PATCH | `/api/leads/:id/status` | agency, admin | Update status; agency claims if unclaimed; recalcs commission |
| POST | `/api/leads/:id/mark-paid` | admin | Move commission from `payable` → `paid` |

#### Commission rules / volume bonuses
| GET | `/api/commission-rules` | any | Read-only for agents/agencies (used in their UIs) |
| POST/PUT/DELETE | `/api/commission-rules[/:id]` | admin |
| GET | `/api/volume-bonuses` | any |
| POST/PUT/DELETE | `/api/volume-bonuses[/:id]` | admin |

#### Admin oversight
| GET | `/api/admin/overview` | admin | Top-level counts (agents/agencies/banks/leads, paid/payable totals) |
| GET | `/api/admin/agents` | admin | All agents with `{ total, approved, paidCommission }` stats |

### 2.3 Email / invite handling

`utils/email.js` uses nodemailer with Gmail SMTP when `SMTP_HOST=smtp.gmail.com` (and creds set). If `SMTP_HOST` is blank, the invite URL is logged to the server console **and** returned in the API response (`inviteUrl`) so admins can copy it from the UI.

---

## 3. Frontend

Vite + React (vanilla JS, JSX). Redux Toolkit for state. React Router v6 for routing. Ant Design for UI.

```
frontend/
├── index.html
├── vite.config.js
├── .env                    VITE_API_URL=http://localhost:5000/api
└── src/
    ├── main.jsx            Renders <Provider><BrowserRouter><App/>...
    ├── App.jsx             ConfigProvider (dark sidebar + gold selected accent), route table
    ├── index.css           Minimal global reset
    ├── api/
    │   └── client.js       axios instance, attaches Bearer token, clears on 401
    ├── store/
    │   ├── index.js        configureStore({ auth })
    │   └── slices/
    │       └── authSlice.js  login / registerAgent / setPassword / fetchMe (with JSDoc shape docs)
    ├── components/
    │   ├── ProtectedRoute.jsx  Auth + role guard
    │   └── AppLayout.jsx       Sider + Header + Outlet, role-aware menu
    └── pages/
        ├── Login.jsx
        ├── Register.jsx
        ├── SetPassword.jsx
        ├── admin/
        │   ├── Dashboard.jsx           Overview stat tiles
        │   ├── Banks.jsx               CRUD
        │   ├── Agencies.jsx            Invite + list
        │   ├── Leads.jsx               All leads, search/filter, mark-paid action
        │   ├── Agents.jsx              All agents with summary stats
        │   ├── CommissionRules.jsx     CRUD for the rules engine
        │   └── VolumeBonuses.jsx       CRUD for monthly bonuses
        ├── agent/
        │   ├── Dashboard.jsx           Stats + recent leads + profile/referral card
        │   ├── SubmitLead.jsx          Sectioned form (Client Info, Product Details)
        │   ├── MyLeads.jsx             Search + status/product filters
        │   └── Commissions.jsx         Paid / Payable / Expected, payments history, rates reference
        └── agency/
            ├── Dashboard.jsx           Queue summary + assigned banks
            └── Leads.jsx               Lead queue with claim + approve/reject actions
```

### 3.1 Routing

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

### 3.2 Theme

Uses `ConfigProvider` with stock Ant Design components — no custom CSS. The only deviations from antd defaults:
- `Layout.siderBg = #0f172a` (dark navy) and `Menu.darkItemSelectedBg = #d4a847` (gold) for a financial-app feel
- Two stat cards (the headline "Commission Earned" / "Paid Out" / "Commission Paid" cards) get a soft `#fdf6e3` cream background to match the gold accent

Everything else is stock antd: `Card`, `Statistic`, `Table`, `Tag`, `Form`, `Modal`, `Popconfirm`, `Empty`, etc.

---

## 4. Feature flow

### 4.1 Admin onboarding
1. `npm run seed` creates `admin@bankcrm.local / admin123`.
2. Admin logs in → `/admin`.

### 4.2 Bank, agency, and rule setup (admin)
1. Admin → **Banks** → adds banks.
2. Admin → **Commission Rules** → sets AED amount per (product, bank).
3. Admin → **Volume Bonuses** → optional monthly bonus tiers.
4. Admin → **Agencies → Invite Agency** → email + multi-select banks.

### 4.3 Agency invite acceptance
Same as before — invite link from email (or copied from modal in dev), `SetPassword` page activates the account.

### 4.4 Agent registration
Self-serve at `/register`, optional referral code → instantly active.

### 4.5 Lead submission and routing
1. Agent submits a lead — `status='submitted'`, `agency=null`.
2. Every agency whose `banks` include the lead's bank sees it on **/agency/leads** as "Open".
3. First agency to take any action (mark Review / Approve / Reject) **claims** the lead — `lead.agency=self`. From that point only they (and admin) can act on it.
4. As status moves through `under_review → assigned_to_bank → approved → disbursed`, `commission.service.recalcOnStatusChange` updates `commission` and `commissionStatus`:
   - **approved** → commission set from the matching `CommissionRule`, `commissionStatus='pending'`
   - **disbursed** → `commissionStatus='payable'`
   - **rejected** → commission cleared, `commissionStatus='none'`
5. Admin sees the payable commission on **/admin/leads** and clicks **Mark Paid** → `commissionStatus='paid'`, `commissionPaidAt` set.

### 4.6 Agent earnings view
**/agent/commissions** reads `/leads/ledger`:
- **Paid Out** = sum of leads with `commissionStatus='paid'`
- **Pending Payout** = sum of `'payable'`
- **Expected Earnings** = sum of `'pending'`
- Plus the current month's volume bonus snapshot (highest threshold met by the agent's approved-this-month count).

### 4.7 Admin oversight
- **/admin** — counts across the system
- **/admin/leads** — every lead, full filters, mark-paid
- **/admin/agents** — every agent with `{ total leads, approved, paid commission }`
- **/admin/agencies** — already existed; lists agencies + banks assigned

---

## 5. Auth model

- Single `/login` for all roles. JWT carries `{ id, role }`.
- Stored in `localStorage`, attached via axios interceptor; 401s clear it.
- Role-based authz on the backend (`requireRole(...)`) and frontend (`ProtectedRoute roles={[...]}`).

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
- **KYC** — Emirates ID / Visa Type / Nationality / Email on the customer record. Not on Lead today.
- **Customer employment & income** — Employer, Job Title, Monthly Salary, Years in Job. Not stored.
- **Loan amount** on a Lead — useful for percentage-based commissions; today rules are flat AED only.
- **Multiple product types** — only `credit_card` and `loan`. Mortgage / Personal Loan / Auto Loan / Business Loan are not separate types yet.
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
