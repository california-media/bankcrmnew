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
├── server.js               Express bootstrap, CORS, JSON, route mounts, error handler
├── seed.js                 Creates default admin user (run once: `npm run seed`)
├── .env                    Secrets / config (PORT, MONGO_URI, JWT_SECRET, SMTP_*, ADMIN_*)
├── config/
│   └── db.js               Mongoose connection
├── models/
│   ├── User.js             Unified user (role: admin | agency | agent), pre-save bcrypt
│   ├── Bank.js             Bank entity (admin-managed)
│   └── Lead.js             Lead entity with status enum (lifecycle below)
├── middleware/
│   └── auth.middleware.js  `protect` (JWT) + `requireRole(...roles)`
├── utils/
│   ├── token.js            JWT signing, invite-token + referral-code generators
│   └── email.js            Invite email via nodemailer; falls back to console log if no SMTP
├── controllers/
│   ├── auth.controller.js  registerAgent, login, verifyInvite, setPassword, me
│   ├── bank.controller.js  CRUD for banks (list public to authenticated users)
│   ├── agency.controller.js create / list / resend-invite (admin only)
│   └── lead.controller.js  create / listMine / stats (agent only)
└── routes/
    ├── auth.routes.js      /api/auth/*
    ├── bank.routes.js      /api/banks/*
    ├── agency.routes.js    /api/agencies/* (admin only)
    └── lead.routes.js      /api/leads/* (agent only)
```

### 2.1 Data models

**User** — single collection for all roles, discriminated by `role`.

| Field | Type | Notes |
|---|---|---|
| name | String | |
| email | String | unique, lowercased |
| password | String | bcrypt hashed via pre-save hook |
| phone | String | |
| role | enum | `admin` \| `agency` \| `agent` |
| banks | ObjectId[] → Bank | agency-only — banks the agency can service |
| referralCode | String | agent-only, unique, auto-generated on registration |
| referredBy | ObjectId → User | agent-only, set when registering with a referral code |
| inviteToken | String | set when admin invites an agency |
| inviteTokenExpires | Date | 24h validity |
| isActive | Boolean | true after self-register (agent) or invite acceptance (agency) |

**Bank** — `name` (unique), `code`, `description`.

**Lead** — `customerName`, `phone`, `productType` (`credit_card` | `loan`), `bank` → Bank, `status`, `agent` → User, `agency` → User (set when sent to agency, not yet wired), `commission`, `notes`.

Lead lifecycle (status enum):
```
submitted → assigned_to_bank → under_review → approved/rejected → disbursed
```

### 2.2 API endpoints

All non-public routes require `Authorization: Bearer <jwt>`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register-agent` | public | Self-registration for agents (optional referral code) |
| POST | `/api/auth/login` | public | Single login for all 3 roles |
| GET | `/api/auth/invite/:token` | public | Verify invite token (used on set-password page) |
| POST | `/api/auth/set-password` | public | Activate invited account, returns auth token |
| GET | `/api/auth/me` | any | Current user (used to rehydrate session) |
| GET | `/api/banks` | any | List banks |
| POST | `/api/banks` | admin | Create bank |
| PUT | `/api/banks/:id` | admin | Update bank |
| DELETE | `/api/banks/:id` | admin | Delete bank |
| POST | `/api/agencies` | admin | Invite agency by email + assign banks |
| GET | `/api/agencies` | admin | List agencies (active and pending) |
| POST | `/api/agencies/:id/resend-invite` | admin | Regenerate and resend invite link |
| POST | `/api/leads` | agent | Submit a new lead |
| GET | `/api/leads/mine` | agent | Agent's own leads |
| GET | `/api/leads/stats` | agent | Aggregated counters for the agent dashboard |

### 2.3 Email / invite handling

`utils/email.js` uses nodemailer when `SMTP_HOST` is set in `.env`. Otherwise, in dev, it logs the invite URL to the server console **and** the API also returns `inviteUrl` in the response so the admin can copy it from the UI.

---

## 3. Frontend

Vite + React (vanilla JS, JSX). Redux Toolkit for state. React Router v6 for routing. Ant Design for UI.

```
frontend/
├── index.html
├── vite.config.js
├── .env                    VITE_API_URL=http://localhost:5000/api
└── src/
    ├── main.jsx            Renders <Provider><BrowserRouter><App/>...</...>
    ├── App.jsx             Route table (login/register/set-password + role-scoped layouts)
    ├── index.css           Minimal global reset (antd handles the rest)
    ├── api/
    │   └── client.js       axios instance, attaches Bearer token, clears on 401
    ├── store/
    │   ├── index.js        configureStore({ auth })
    │   └── slices/
    │       └── authSlice.js  login / registerAgent / setPassword / fetchMe thunks, logout
    ├── components/
    │   ├── ProtectedRoute.jsx  Auth + role guard, hydrates session from token on first mount
    │   └── AppLayout.jsx       Sider + Header + Outlet, role-aware menu and avatar dropdown
    └── pages/
        ├── Login.jsx         Shared login (admin/agency/agent), redirects to /<role>
        ├── Register.jsx      Agent self-registration (optional referral code)
        ├── SetPassword.jsx   Invite acceptance: verifies token, then activates account
        ├── admin/
        │   ├── Dashboard.jsx Quick links to Banks and Agencies
        │   ├── Banks.jsx     CRUD table for banks
        │   └── Agencies.jsx  Invite agency (multi-select banks), list + resend invite
        ├── agent/
        │   ├── Dashboard.jsx Stat cards + referral code (copyable)
        │   ├── SubmitLead.jsx New lead form (bank dropdown from /api/banks)
        │   └── MyLeads.jsx   Agent's leads with status tags
        └── agency/
            └── Dashboard.jsx Welcome + assigned banks (lead-approval UI to come)
```

### 3.1 Routing

| Path | Access | Renders |
|---|---|---|
| `/login` | public | Single login for all roles |
| `/register` | public | Agent self-registration |
| `/set-password?token=...` | public | Activate invited account |
| `/admin` | admin | AdminDashboard |
| `/admin/banks` | admin | Banks (CRUD) |
| `/admin/agencies` | admin | Agencies (invite + list) |
| `/agent` | agent | AgentDashboard (stats) |
| `/agent/leads/new` | agent | SubmitLead |
| `/agent/leads` | agent | MyLeads |
| `/agency` | agency | AgencyDashboard |
| `/` and `*` | — | redirect to `/login` |

`ProtectedRoute` enforces auth and role. If a user lands on a route not allowed for their role, they're sent to their own home (`/<role>`).

### 3.2 State

Redux Toolkit slice `auth` holds:
- `user` — current user (id, name, email, role, banks, referralCode)
- `status` — `idle` | `loading`
- `error` — last auth error
- `hydrated` — whether `fetchMe` has completed at least once

`localStorage.token` persists the JWT across reloads. On boot, `ProtectedRoute` calls `fetchMe()` if a token exists.

---

## 4. Feature flow

### 4.1 Admin onboarding (manual / one-time)
1. Run `npm run seed` in `backend/`. Creates `admin@bankcrm.local / admin123` (override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars).
2. Admin logs in at `/login` → redirected to `/admin`.

### 4.2 Bank management (admin)
1. Admin → **Banks** → adds banks (name, code, description).
2. Banks become selectable when creating agencies and submitting leads.

### 4.3 Agency creation (admin → email → agency)
1. Admin → **Agencies → Invite Agency**. Enters email, optional name, picks banks to assign.
2. Backend creates a `User` doc with `role=agency`, `isActive=false`, `inviteToken`, `inviteTokenExpires` (24h).
3. Email sent with `<CLIENT_URL>/set-password?token=...`. If SMTP is unconfigured, the link is shown in the modal and logged to the backend console.
4. Recipient opens the link → `SetPassword` page verifies the token, asks for name/phone/password.
5. On submit, account is activated, JWT issued, and the user is redirected to `/agency`.
6. Admin can resend the invite (rotates the token) for any pending agency.

### 4.4 Agent registration (self-serve)
1. New agent → `/register`. Enters name, email, phone, password, optional referral code.
2. Backend validates referral code (must match an existing agent's `referralCode`), generates a unique referral code for the new agent, stores `referredBy`.
3. Account is immediately active; JWT returned; redirected to `/agent`.

### 4.5 Lead submission (agent)
1. Agent → **Submit Lead**. Form: customer name, phone, product type (credit card / loan), bank (from `/api/banks`), notes.
2. Lead saved with `status=submitted`, `agent=<self>`.
3. Visible immediately in **My Leads** with a status tag.

### 4.6 Agent dashboard
Reads `/api/leads/stats` and shows counters: total, active, approved, rejected, pending, disbursed, earnings (sum of `commission` on approved/disbursed leads). Referral code is shown copyable at the top.

### 4.7 Agency dashboard (placeholder for now)
Shows the agency's assigned banks. Agency-side lead approval UI is intentionally not implemented yet — see "Not yet implemented" below.

---

## 5. Auth model

- Single `/login` for all roles. Backend looks up user by email and includes role in the JWT payload.
- JWT stored in `localStorage` and attached via axios request interceptor.
- 401 responses clear the token and bounce to `/login`.
- Role-based authorization enforced by `requireRole(...)` on the backend and `ProtectedRoute roles={[...]}` on the frontend.

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

Default admin: `admin@bankcrm.local / admin123` (change in `backend/.env`).

`MONGO_URI` defaults to `mongodb://localhost:27017/bank_crm` — edit `backend/.env` to point elsewhere.

---

## 7. Not yet implemented (intentionally)

Per the current scope:
- **KYC** for agents.
- **Agent → Agency lead routing** — when agent submits a lead, the agency whose `banks` include the lead's bank should receive it for approval/rejection. Schema (`Lead.agency`) and lifecycle statuses are already in place; the routing logic and agency approval UI are deferred.
- **Admin oversight views** — admin viewing all leads, all agents, all agencies-with-detail. Only agency management is implemented at this stage.
- **Commission rules / payouts** — `commission` field exists on Lead but isn't computed automatically.

---

## 8. Tech stack reference

| Layer | Lib |
|---|---|
| Frontend framework | React 19 + Vite |
| State | Redux Toolkit + react-redux |
| Routing | react-router-dom v6 |
| UI | Ant Design + @ant-design/icons |
| HTTP | axios |
| Backend | Express 5 |
| ODM | Mongoose |
| Auth | jsonwebtoken + bcryptjs |
| Email | nodemailer (optional; console fallback in dev) |
