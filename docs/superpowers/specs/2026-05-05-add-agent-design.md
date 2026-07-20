# Add Agent Feature — Design Spec
Date: 2026-05-05

## Overview
Admin can create agent accounts directly from the Agents page. No email invite. Admin sets name, email, password, and optional phone. Agent account is active immediately.

## Backend

### New endpoint
`POST /api/admin/agents` — protected by `protect` + `requireRole('admin')` (inherited from `router.use(...)` in `admin.routes.js`).

### Request body
| Field | Type | Required |
|-------|------|----------|
| name | string | yes |
| email | string | yes |
| password | string | yes |
| phone | string | no |

### Controller: `createAgent` in `admin.controller.js`
1. Validate `name`, `email`, `password` present — 400 if missing
2. Check email not already taken — 409 if duplicate
3. `User.create({ name, email, password, phone, role: 'agent', isActive: true })`
4. Return 201 `{ user: sanitize(newUser) }` — `sanitize()` is local to `auth.controller.js` (not exported), so define inline in `admin.controller.js`: strips `password`, `inviteToken`, `inviteTokenExpires`

### Error responses
- `400` — missing required fields
- `409` — email already registered
- `500` — server error

## Frontend

### File: `src/pages/admin/Agents.jsx`
Extend existing read-only list page.

**Add:**
- `useState` for `modalOpen`, `form` (Ant Design `Form.useForm()`)
- "Add Agent" button top-right (same layout as `Banks.jsx` header)
- Ant Design `Modal` with `Form` inside
- Fields: Name (text), Email (text), Password (password input), Phone (text, optional)
- On submit: `api.post('/admin/agents', values)` → on success close modal + re-fetch agents list
- On error: show error message in form

### Pattern reference
Follows `Banks.jsx` exactly: button → modal → form → api.post → reload list.

## Data flow
```
Admin clicks "Add Agent"
  → Modal opens
  → Fills name/email/password/phone
  → Submit → POST /api/admin/agents (Bearer token)
  → 201 → modal closes, agents list refetches
  → 409/400 → error shown in form
```

## Out of scope
- Email notification to new agent
- Assigning banks at creation time
- Edit/delete agent
