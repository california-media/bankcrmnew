# Notice Module Design

**Date:** 2026-06-22  
**Status:** Approved

## Overview

Admin creates broadcast notices targeted at one or more roles with a start/end date range. Notices appear as dismissible alert banners at the top of each role's dashboard only when today's date falls within the notice's active window.

---

## Data Model

**File:** `backend/models/Notice.js`

| Field | Type | Constraints |
|---|---|---|
| `title` | String | required |
| `message` | String | required |
| `targetRoles` | [String] | enum: `['admin','agency','agent','employee']`, min length 1 |
| `startDate` | Date | required |
| `endDate` | Date | required |
| `isActive` | Boolean | default `true` |
| `createdBy` | ObjectId → User | required |
| `createdAt` | Date | auto (timestamps) |
| `updatedAt` | Date | auto (timestamps) |

---

## Backend

### Controller

**File:** `backend/controllers/notice.controller.js`

| Function | Description |
|---|---|
| `createNotice` | Admin creates notice. Validates targetRoles, dates. Sets `createdBy = req.user._id`. |
| `listNotices` | Admin fetches all notices, sorted by `startDate` desc. |
| `updateNotice` | Admin updates any field. |
| `deleteNotice` | Admin deletes by ID. |
| `getActiveNotices` | Any authenticated user. Query: `isActive: true`, `startDate <= today`, `endDate >= today`, `targetRoles` includes `req.user.role`. Returns array. |

### Routes

**File:** `backend/routes/notice.routes.js`

```
POST   /api/notices          protect + requireRole('admin')  → createNotice
GET    /api/notices          protect + requireRole('admin')  → listNotices
PUT    /api/notices/:id      protect + requireRole('admin')  → updateNotice
DELETE /api/notices/:id      protect + requireRole('admin')  → deleteNotice

GET    /api/notices/active   protect (any role)              → getActiveNotices
```

**Mount in `server.js`:**
```js
import noticeRoutes from './routes/notice.routes.js';
app.use('/api/notices', noticeRoutes);
```

---

## Frontend

### Redux Slice

**File:** `frontend/src/store/slices/noticesSlice.js`

```
state: { items: [], status: 'idle', error: null }
thunk: fetchActiveNotices  → GET /api/notices/active
                              populates items on success
```

Register in `frontend/src/store/index.js` under key `notices`.

### NoticeBanner Component

**File:** `frontend/src/components/NoticeBanner.jsx`

- Dispatches `fetchActiveNotices` on mount (only if `status === 'idle'`)
- Reads `items` from Redux state
- Filters out IDs stored in `sessionStorage` key `dismissed_notices` (JSON array)
- Renders one Ant Design `<Alert>` per visible notice:
  - `type="info"`, `showIcon`, `closable`
  - `message` = notice title, `description` = notice message
  - On close: adds notice `_id` to `sessionStorage` dismissed list
- Renders nothing if no visible notices

### Admin Notices Page

**File:** `frontend/src/pages/admin/Notices.jsx`

**Table columns:**
- Title
- Message (truncated to 60 chars)
- Target Roles (Ant Design `<Tag>` per role)
- Start Date
- End Date
- Active (toggle switch — calls `PUT /api/notices/:id` with `{ isActive }`)
- Actions: Edit button, Delete button (with `Popconfirm`)

**Create/Edit modal:**
- Form fields: Title (Input), Message (TextArea), Target Roles (multi-Select, options: admin/agency/agent/employee), Date Range (RangePicker → startDate + endDate)
- Submit calls POST (create) or PUT (edit)
- On success: refetch table data, close modal

### Dashboard Wiring

Add `<NoticeBanner />` at the very top of each dashboard component, above existing content:

| File | Change |
|---|---|
| `frontend/src/pages/admin/Dashboard.jsx` | Import + render `<NoticeBanner />` at top |
| `frontend/src/pages/agent/Dashboard.jsx` | Import + render `<NoticeBanner />` at top |
| `frontend/src/pages/agency/Dashboard.jsx` | Import + render `<NoticeBanner />` at top |
| `frontend/src/pages/employee/Dashboard.jsx` | Import + render `<NoticeBanner />` at top |

### Routing

In `frontend/src/App.jsx`: add protected route `/admin/notices` → `<Notices />` with `requireRole('admin')`.

In `frontend/src/components/AppLayout.jsx`: add "Notices" nav menu item under admin section linking to `/admin/notices`.

---

## Data Flow

```
Admin creates notice (POST /api/notices)
  → stored in MongoDB with targetRoles + date range

User visits dashboard
  → NoticeBanner mounts
  → dispatches fetchActiveNotices
  → GET /api/notices/active filters by role + today's date
  → items stored in Redux
  → NoticeBanner filters out sessionStorage dismissed IDs
  → renders Alert banners

User closes banner
  → notice ID added to sessionStorage['dismissed_notices']
  → banner disappears for rest of session
  → reappears on next login/session
```

---

## Out of Scope

- Rich text / formatting in notices (plain text only)
- Per-user permanent dismiss (dismissed state resets each session)
- Email/push delivery of notices
- Notice preview before publish
