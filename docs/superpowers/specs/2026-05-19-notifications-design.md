# Notifications Module — Design Spec

## Goal

Real-time, persistent activity notifications across all four panels (admin, agency, agent, employee). Bell icon in nav shows unread count. Dedicated Notifications page shows full feed. Powered by Socket.io + MongoDB.

## Architecture

### Transport

Socket.io attached to the same Express HTTP server. On connect, JWT is verified from `socket.handshake.auth.token`. Authenticated socket joins a room named after the user's MongoDB `_id` string. Disconnect is automatic. No extra HTTP port needed.

### Persistence

One `Notification` document per recipient per event. Stored in MongoDB. Survives page refresh, session end, reconnect. Unread count derived from `isRead: false` count in DB.

---

## Backend

### New Files

#### `backend/models/Notification.js`

```
recipient:  ObjectId → User      (required)
type:       String enum           (see Event Types below)
title:      String                (short headline, e.g. "Lead Approved")
body:       String                (detail line, e.g. "Ahmed Ali — FAB Credit Card approved")
lead:       ObjectId → Lead       (optional — for deep-link navigation)
isRead:     Boolean, default false
createdAt:  Date (auto via timestamps)
```

Index: `{ recipient: 1, isRead: 1, createdAt: -1 }` for fast unread queries.

#### `backend/utils/notify.js`

Single exported function:

```js
createAndEmit(io, recipientIds[], { type, title, body, lead })
```

1. Bulk-inserts one Notification doc per recipientId
2. Emits `'notification'` socket event to each `userId` room with the saved doc

All controllers import this helper — no duplication.

#### `backend/routes/notification.routes.js`

```
GET  /api/notifications          — list for req.user, newest first, limit 50
PATCH /api/notifications/read    — body: { ids: [] } OR { all: true }
```

Both routes require auth middleware.

#### `backend/controllers/notification.controller.js`

- `list`: `Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50)`
- `markRead`: if `all`, update `{ recipient, isRead: false }` → `isRead: true`; else update `{ _id: { $in: ids }, recipient }` → `isRead: true`

### Modified Files

#### `backend/server.js`

- Create `http.createServer(app)` and pass to `new Server(httpServer, { cors })` from socket.io
- Export `io` instance for use in controllers
- Listen on `httpServer` instead of `app`
- Mount `notification.routes.js` at `/api/notifications`

#### Lead controllers — emit on these events:

| Controller action | Event type | Recipients |
|---|---|---|
| `createLead` | `lead_created` | admin users, lead.agency |
| `updateStatus` (any change) | `status_changed` | admin, lead.agency, lead.agent |
| `assignEmployee` (CPV or Sales) | `lead_assigned` | admin, lead.agency, assigned employee |
| `setOnLead` (employee status) | `employee_status_updated` | admin, lead.agency, lead.agent |
| `addNote` | `note_added` | admin, lead.agency, lead.agent, assignedCpvEmployee, assignedSalesEmployee |
| `bulkMarkReceived` | `commission_payable` | lead.agency, lead.agent (per lead) |

Admin recipients = all users with `role: 'admin'` — queried once per event, cached for the request.

### Event Types Enum

```
lead_created
lead_assigned
status_changed
employee_status_updated
note_added
commission_payable
```

---

## Frontend

### New Files

#### `frontend/src/socket.js`

Singleton socket.io-client instance. `autoConnect: false`. Connects on login (token injected into `auth`), disconnects on logout.

```js
export function connectSocket(token) { ... }
export function disconnectSocket() { ... }
export default socket;
```

#### `frontend/src/hooks/useNotifications.js`

Used by AppLayout (shared across all roles). Returns:

```js
{ notifications, unreadCount, markRead, markAllRead, loading }
```

- On mount: fetches `GET /api/notifications` to hydrate list + count
- Socket `'notification'` event → prepend to list, increment unreadCount
- `markRead(ids[])` → `PATCH /api/notifications/read { ids }` → update local state
- `markAllRead()` → `PATCH /api/notifications/read { all: true }` → zero unread count

#### `frontend/src/pages/Notifications.jsx`

Single shared page, rendered for all roles at their respective route. Props: none (reads from `useNotifications` hook).

- Header: "Notifications" title + live dot (green when socket connected, grey when not)
- "Mark all read" button (disabled if unreadCount === 0)
- Filter tabs: All | Unread
- Table/list rows:
  - Left: colored icon by type (see mapping below)
  - Middle: bold title + body text + time-ago (e.g. "3m ago")
  - Right: unread dot (blue) if not read
  - Click: navigate to `/[role]/leads/[lead._id]` + mark as read
- Pagination: 50 per page

### Modified Files

#### `frontend/src/components/AppLayout.jsx`

1. Call `useNotifications()` hook at top level
2. Add bell icon to top-right header:
   - `<Badge count={unreadCount} overflowCount={99}>`
   - `<BellOutlined />` wrapped in Ant Design `Dropdown`
   - Dropdown shows last 5 notifications (title + body + time-ago + type icon)
   - Footer: "Mark all read" + "View all →" link to `/[role]/notifications`
3. Add "Notifications" nav item to sidebar for all roles (with unread badge dot)

#### `frontend/src/App.jsx`

Add `/notifications` route under each role's protected block:
```
/admin/notifications    → Notifications
/agent/notifications    → Notifications
/agency/notifications   → Notifications
/employee/notifications → Notifications
```

### Event → UI Mapping

| Type | Icon | Accent color |
|---|---|---|
| `lead_created` | `PlusCircleOutlined` | `#4f46e5` (indigo) |
| `status_changed` | `CheckCircleOutlined` | `#16a34a` (green) or `#dc2626` (red) for rejected |
| `lead_assigned` | `UserAddOutlined` | `#2563eb` (blue) |
| `employee_status_updated` | `SyncOutlined` | `#0891b2` (cyan) |
| `note_added` | `MessageOutlined` | `#d97706` (amber) |
| `commission_payable` | `DollarOutlined` | `#16a34a` (green) |

---

## Notification Body Copy

| Type | Title | Body template |
|---|---|---|
| `lead_created` | "New Lead Submitted" | "{customerName} — {bank} {productType} submitted by {agent.name}" |
| `status_changed` | "Lead {newStatus}" | "{customerName} — {bank} {productType} moved to {newStatus}" (newStatus formatted: `under_review` → "Under Review") |
| `lead_assigned` | "Lead Assigned" | "{customerName} assigned to {employee.name} ({type})" |
| `employee_status_updated` | "Status Updated" | "{customerName} — {employeeStatus.label} by {employee.name}" |
| `note_added` | "Note Added" | "{customerName} — note by {author.name}: "{truncated note}"" |
| `commission_payable` | "Commission Ready" | "{customerName} — AED {commission} now payable" |

---

## Packages Required

**Backend:** `socket.io` (compatible with existing express ^5)
**Frontend:** `socket.io-client`

---

## Out of Scope

- Push notifications (browser/mobile)
- Email notifications
- Admin ability to broadcast custom notifications
- Notification preferences / mute settings
- Deleting notifications
