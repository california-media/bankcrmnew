# Notifications Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real-time persistent notifications across all four panels using Socket.io + MongoDB, bell icon in nav with unread badge, and a dedicated Notifications page per role.

**Architecture:** One Notification document per recipient per event stored in MongoDB. Socket.io attaches to the Express HTTP server; authenticated sockets join a room by userId. Controllers call `createAndEmit()` after key lead events. Frontend uses a React context (NotificationsProvider inside AppLayout) so both the bell icon and Notifications page share the same socket connection and state.

**Tech Stack:** socket.io, socket.io-client, Mongoose, React Context API, Ant Design Badge/Popover, dayjs relativeTime

---

## File Map

**Create (backend):**
- `backend/models/Notification.js`
- `backend/utils/io.js`
- `backend/utils/notify.js`
- `backend/controllers/notification.controller.js`
- `backend/routes/notification.routes.js`

**Modify (backend):**
- `backend/server.js`
- `backend/controllers/lead.controller.js`
- `backend/controllers/employeeStatus.controller.js`

**Create (frontend):**
- `frontend/src/contexts/NotificationsContext.jsx`
- `frontend/src/pages/Notifications.jsx`

**Modify (frontend):**
- `frontend/src/components/AppLayout.jsx`
- `frontend/src/App.jsx`

---

### Task 1: Install Packages

**Files:** backend/package.json, frontend/package.json

- [ ] **Step 1: Install socket.io in backend**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/backend"
npm install socket.io
```

Expected: `added N packages` with no errors.

- [ ] **Step 2: Install socket.io-client in frontend**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/frontend"
npm install socket.io-client
```

Expected: `added N packages` with no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "chore: install socket.io and socket.io-client"
```

---

### Task 2: Notification Model + io Singleton + Notify Helper

**Files:**
- Create: `backend/models/Notification.js`
- Create: `backend/utils/io.js`
- Create: `backend/utils/notify.js`

- [ ] **Step 1: Create Notification model**

Create `backend/models/Notification.js`:

```js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable'],
      required: true,
    },
    title:  { type: String, required: true },
    body:   { type: String, required: true },
    lead:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
```

- [ ] **Step 2: Create io singleton**

Create `backend/utils/io.js`:

```js
let _io = null;
module.exports = {
  setIO(io) { _io = io; },
  getIO()    { return _io; },
};
```

- [ ] **Step 3: Create notify helper**

Create `backend/utils/notify.js`:

```js
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('./io');

function formatStatus(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getAdminIds() {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  return admins.map((a) => String(a._id));
}

async function createAndEmit(recipientIds, data, actorId) {
  const { type, title, body, lead } = data;
  const actorStr = actorId ? String(actorId) : null;
  const unique = [
    ...new Set(
      recipientIds
        .filter(Boolean)
        .map(String)
        .filter((id) => id !== actorStr)
    ),
  ];
  if (!unique.length) return;

  const docs = await Notification.insertMany(
    unique.map((recipient) => ({ recipient, type, title, body, lead: lead || undefined }))
  );

  const io = getIO();
  if (io) {
    docs.forEach((doc) => io.to(String(doc.recipient)).emit('notification', doc));
  }
}

module.exports = { createAndEmit, getAdminIds, formatStatus };
```

- [ ] **Step 4: Verify all three load without error**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/backend"
node -e "require('./models/Notification'); require('./utils/io'); require('./utils/notify'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 5: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add backend/models/Notification.js backend/utils/io.js backend/utils/notify.js
git commit -m "feat: Notification model, io singleton, createAndEmit helper"
```

---

### Task 3: Notification API + Socket.io Server Setup

**Files:**
- Create: `backend/controllers/notification.controller.js`
- Create: `backend/routes/notification.routes.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create notification controller**

Create `backend/controllers/notification.controller.js`:

```js
const Notification = require('../models/Notification');

exports.list = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { ids, all } = req.body;
    const filter = { recipient: req.user._id };
    if (all) {
      filter.isRead = false;
    } else {
      if (!Array.isArray(ids) || !ids.length)
        return res.status(400).json({ message: 'ids array required' });
      filter._id = { $in: ids };
    }
    await Notification.updateMany(filter, { isRead: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Create notification routes**

Create `backend/routes/notification.routes.js`:

```js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/',      protect, ctrl.list);
router.patch('/read', protect, ctrl.markRead);

module.exports = router;
```

- [ ] **Step 3: Replace backend/server.js**

Replace the entire contents of `backend/server.js` with:

```js
require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');
const { setIO } = require('./utils/io');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[fatal] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app        = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

setIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join(String(socket.userId));
  socket.on('disconnect', () => {});
});

connectDB();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: 'Bank CRM API' }));

app.use('/api/auth',              require('./routes/auth.routes'));
app.use('/api/banks',             require('./routes/bank.routes'));
app.use('/api/agencies',          require('./routes/agency.routes'));
app.use('/api/leads',             require('./routes/lead.routes'));
app.use('/api/commission-rules',  require('./routes/commissionRule.routes'));
app.use('/api/volume-bonuses',    require('./routes/volumeBonus.routes'));
app.use('/api/admin',             require('./routes/admin.routes'));
app.use('/api/card-products',     require('./routes/cardProduct.routes'));
app.use('/api/loan-products',     require('./routes/loanProduct.routes'));
app.use('/api/employees',         require('./routes/employee.routes'));
app.use('/api/employee-statuses', require('./routes/employeeStatus.routes'));
app.use('/api/agency-payouts',    require('./routes/agencyPayout.routes'));
app.use('/api/notifications',     require('./routes/notification.routes'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

- [ ] **Step 4: Verify server starts and health check passes**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/backend"
node server.js &
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/notifications)
echo "Notifications endpoint status: $STATUS"
curl -s http://localhost:5000/ 
kill %1
```

Expected: `Notifications endpoint status: 401` (protected, needs token) and `{"message":"Bank CRM API"}`

- [ ] **Step 5: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add backend/controllers/notification.controller.js backend/routes/notification.routes.js backend/server.js
git commit -m "feat: notification API, socket.io setup on httpServer"
```

---

### Task 4: Wire Emit Calls into lead.controller.js

**Files:**
- Modify: `backend/controllers/lead.controller.js`

Add one import line at the top, then add try/catch emit blocks in 5 functions. All emit blocks are wrapped in `try {} catch (_) {}` so a notification failure never breaks the API response.

- [ ] **Step 1: Add import at top of lead.controller.js**

After line 6 (`const commissionService = require('../services/commission.service');`), add:

```js
const { createAndEmit, getAdminIds, formatStatus } = require('../utils/notify');
```

- [ ] **Step 2: Emit in `create` — after populate, before res.status(201)**

In the `create` function, find `res.status(201).json(populated);` and insert before it:

```js
    try {
      const adminIds = await getAdminIds();
      const productName = populated.productType === 'credit_card'
        ? (populated.cardProduct?.name || 'Card')
        : (populated.loanProduct?.name || 'Loan');
      await createAndEmit(
        [...adminIds, String(lead.agency)],
        {
          type: 'lead_created',
          title: 'New Lead Submitted',
          body: `${lead.customerName} — ${populated.bank?.name || ''} ${productName} submitted by ${req.user.name || req.user.email}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
```

- [ ] **Step 3: Emit in `updateStatus` — after populate, before res.json**

In `updateStatus`, find `res.json(populated);` and insert before it:

```js
    try {
      const adminIds = await getAdminIds();
      await createAndEmit(
        [...adminIds, String(lead.agency), String(lead.agent)],
        {
          type: 'status_changed',
          title: `Lead ${formatStatus(status)}`,
          body: `${lead.customerName} — ${populated.bank?.name || ''} moved to ${formatStatus(status)}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
```

- [ ] **Step 4: Emit in `assignEmployee` — after populate, before res.json**

In `assignEmployee`, find `res.json(populated);` and insert before it:

```js
    try {
      if (employeeId) {
        const adminIds = await getAdminIds();
        const typeLabel = type === 'cpv' ? 'CPV' : type === 'sales' ? 'Sales' : 'employee';
        const empName = populated.assignedCpvEmployee?.name
          || populated.assignedSalesEmployee?.name
          || 'employee';
        await createAndEmit(
          [...adminIds, String(lead.agency), String(employeeId)],
          {
            type: 'lead_assigned',
            title: 'Lead Assigned',
            body: `${lead.customerName} assigned to ${empName} (${typeLabel})`,
            lead: lead._id,
          },
          req.user._id,
        );
      }
    } catch (_) {}
```

- [ ] **Step 5: Emit in `addNote` — after populate, before res.status(201)**

In `addNote`, find `res.status(201).json(populated);` and insert before it:

```js
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(lead.agency), String(lead.agent)];
      if (lead.assignedCpvEmployee) recipients.push(String(lead.assignedCpvEmployee));
      if (lead.assignedSalesEmployee) recipients.push(String(lead.assignedSalesEmployee));
      const truncated = String(text).trim().slice(0, 60) + (String(text).trim().length > 60 ? '…' : '');
      await createAndEmit(
        recipients,
        {
          type: 'note_added',
          title: 'Note Added',
          body: `${lead.customerName} — note by ${req.user.name || req.user.email}: "${truncated}"`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
```

- [ ] **Step 6: Emit in `bulkMarkReceived` — after commission updateMany, before res.json**

In `bulkMarkReceived`, find `res.json({ count: result.modifiedCount });` and insert before it:

```js
    try {
      const paidLeads = await Lead.find({ _id: { $in: leadIds } })
        .select('customerName agency agent commission')
        .lean();
      await Promise.all(
        paidLeads.map((l) =>
          createAndEmit(
            [String(l.agency), String(l.agent)],
            {
              type: 'commission_payable',
              title: 'Commission Ready',
              body: `${l.customerName} — AED ${Number(l.commission || 0).toLocaleString()} now payable`,
              lead: l._id,
            },
          )
        )
      );
    } catch (_) {}
```

- [ ] **Step 7: Verify syntax**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/backend"
node -e "require('./controllers/lead.controller'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 8: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add backend/controllers/lead.controller.js
git commit -m "feat: emit notifications on lead create, status, assign, note, commission"
```

---

### Task 5: Wire Emit into employeeStatus.controller.js

**Files:**
- Modify: `backend/controllers/employeeStatus.controller.js`

- [ ] **Step 1: Add import at top**

After `const Lead = require('../models/Lead');`, add:

```js
const { createAndEmit, getAdminIds } = require('../utils/notify');
```

- [ ] **Step 2: Emit in `setOnLead` — after populate, before res.json**

In `setOnLead`, find `res.json(lead);` and insert before it:

```js
    try {
      const adminIds = await getAdminIds();
      const statusLabel = employeeStatusId
        ? (lead.employeeStatus?.label || String(employeeStatusId))
        : 'cleared';
      await createAndEmit(
        [...adminIds, String(lead.agency), String(lead.agent)],
        {
          type: 'employee_status_updated',
          title: 'Status Updated',
          body: `${lead.customerName} — ${statusLabel} by ${req.user.name || req.user.email}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
```

Note: `lead.agency` and `lead.agent` are raw ObjectIds here (not populated) — `String()` converts them correctly.

- [ ] **Step 3: Verify syntax**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/backend"
node -e "require('./controllers/employeeStatus.controller'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add backend/controllers/employeeStatus.controller.js
git commit -m "feat: emit notification on employee status update"
```

---

### Task 6: Frontend NotificationsContext

**Files:**
- Create: `frontend/src/contexts/NotificationsContext.jsx`

- [ ] **Step 1: Create the context file**

Create `frontend/src/contexts/NotificationsContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api/client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    setLoading(true);
    api.get('/notifications')
      .then(({ data }) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.isRead).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => { socket.disconnect(); };
  }, []);

  const markRead = useCallback(async (ids) => {
    try {
      await api.patch('/notifications/read', { ids });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(String(n._id)) ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - ids.length));
    } catch (_) {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read', { all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_) {}
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, loading, connected }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used inside NotificationsProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add frontend/src/contexts/NotificationsContext.jsx
git commit -m "feat: NotificationsContext — socket connection and unread state"
```

---

### Task 7: AppLayout — Bell Icon, Nav Items, Provider Wrap

**Files:**
- Modify: `frontend/src/components/AppLayout.jsx`

Replace the entire file. The key changes: split into `AppLayoutInner` (consumes context) + `AppLayout` (wraps with `NotificationsProvider`); add bell icon with Popover in header; add Notifications nav item per role.

- [ ] **Step 1: Replace frontend/src/components/AppLayout.jsx**

```jsx
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Popover, Button, Space, theme, ConfigProvider } from 'antd';
import {
  DashboardOutlined, BankOutlined, TeamOutlined, FileAddOutlined,
  UnorderedListOutlined, LogoutOutlined, UserOutlined, DollarOutlined,
  AuditOutlined, IdcardOutlined, CreditCardOutlined, FundOutlined,
  DownOutlined, InboxOutlined, AppstoreOutlined,
  BellOutlined, PlusCircleOutlined, CheckCircleOutlined,
  UserAddOutlined, SyncOutlined, MessageOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { NotificationsProvider, useNotificationsContext } from '../contexts/NotificationsContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Header, Sider, Content } = Layout;

const TYPE_ICONS = {
  lead_created:            <PlusCircleOutlined />,
  status_changed:          <CheckCircleOutlined />,
  lead_assigned:           <UserAddOutlined />,
  employee_status_updated: <SyncOutlined />,
  note_added:              <MessageOutlined />,
  commission_payable:      <DollarOutlined />,
};

const TYPE_COLORS = {
  lead_created:            '#4f46e5',
  status_changed:          '#16a34a',
  lead_assigned:           '#2563eb',
  employee_status_updated: '#0891b2',
  note_added:              '#d97706',
  commission_payable:      '#16a34a',
};

const menusByRole = {
  admin: [
    { key: '/admin',                   icon: <DashboardOutlined />,    label: <Link to="/admin">Overview</Link> },
    { key: '/admin/leads',             icon: <AuditOutlined />,        label: <Link to="/admin/leads">All Leads</Link> },
    { key: '/admin/agents',            icon: <IdcardOutlined />,       label: <Link to="/admin/agents">Agents</Link> },
    { key: '/admin/agencies',          icon: <TeamOutlined />,         label: <Link to="/admin/agencies">Agencies</Link> },
    { key: '/admin/banks',             icon: <BankOutlined />,         label: <Link to="/admin/banks">Banks</Link> },
    { key: '/admin/card-products',     icon: <CreditCardOutlined />,   label: <Link to="/admin/card-products">Card Products</Link> },
    { key: '/admin/loan-products',     icon: <FundOutlined />,         label: <Link to="/admin/loan-products">Loan Products</Link> },
    { key: '/admin/payouts',           icon: <DollarOutlined />,       label: <Link to="/admin/payouts">Payouts</Link> },
    { key: '/admin/receive',           icon: <InboxOutlined />,        label: <Link to="/admin/receive">Receive</Link> },
    { key: '/admin/employee-statuses', icon: <UnorderedListOutlined />,label: <Link to="/admin/employee-statuses">Lead Status</Link> },
    { key: '/admin/notifications',     icon: <BellOutlined />,         label: <Link to="/admin/notifications">Notifications</Link> },
  ],
  agent: [
    { key: '/agent',                  icon: <DashboardOutlined />,    label: <Link to="/agent">Dashboard</Link> },
    { key: '/agent/leads',            icon: <UnorderedListOutlined />,label: <Link to="/agent/leads">My Leads</Link> },
    { key: '/agent/leads/new',        icon: <FileAddOutlined />,      label: <Link to="/agent/leads/new">New Lead</Link> },
    { key: '/agent/commissions',      icon: <DollarOutlined />,       label: <Link to="/agent/commissions">Payouts</Link> },
    { key: '/agent/products',         icon: <AppstoreOutlined />,     label: <Link to="/agent/products">Products</Link> },
    { key: '/agent/notifications',    icon: <BellOutlined />,         label: <Link to="/agent/notifications">Notifications</Link> },
  ],
  agency: [
    { key: '/agency',                 icon: <DashboardOutlined />,    label: <Link to="/agency">Dashboard</Link> },
    { key: '/agency/leads',           icon: <AuditOutlined />,        label: <Link to="/agency/leads">Lead Queue</Link> },
    { key: '/agency/employees',       icon: <TeamOutlined />,         label: <Link to="/agency/employees">Employees</Link> },
    { key: '/agency/payouts',         icon: <DollarOutlined />,       label: <Link to="/agency/payouts">Payouts</Link> },
    { key: '/agency/notifications',   icon: <BellOutlined />,         label: <Link to="/agency/notifications">Notifications</Link> },
  ],
  employee: [
    { key: '/employee',               icon: <DashboardOutlined />,    label: <Link to="/employee">Dashboard</Link> },
    { key: '/employee/leads',         icon: <UnorderedListOutlined />,label: <Link to="/employee/leads">My Leads</Link> },
    { key: '/employee/notifications', icon: <BellOutlined />,         label: <Link to="/employee/notifications">Notifications</Link> },
  ],
};

const titleByRole = { admin: 'Admin', agency: 'Agency', agent: 'Agent', employee: 'Employee' };

const ROLE_COLORS = { admin: '#7c3aed', agency: '#1e40af', agent: '#0f766e', employee: '#b45309' };

function NotifDropdown({ notifications, role, markRead, markAllRead, navigate }) {
  const recent = notifications.slice(0, 5);
  return (
    <div style={{ width: 320 }}>
      {!recent.length && (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No notifications yet
        </div>
      )}
      {recent.map((n) => (
        <div
          key={n._id}
          onClick={() => {
            if (n.lead) navigate(`/${role}/leads/${n.lead}`);
            if (!n.isRead) markRead([String(n._id)]);
          }}
          style={{
            padding: '10px 14px',
            cursor: n.lead ? 'pointer' : 'default',
            background: n.isRead ? 'transparent' : '#eff6ff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <div style={{ color: TYPE_COLORS[n.type] || '#4f46e5', fontSize: 15, marginTop: 2, flexShrink: 0 }}>
            {TYPE_ICONS[n.type] || <BellOutlined />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 13, color: '#0f172a' }}>{n.title}</div>
            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{dayjs(n.createdAt).fromNow()}</div>
          </div>
          {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', marginTop: 5, flexShrink: 0 }} />}
        </div>
      ))}
      <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
        <Button size="small" type="link" style={{ padding: 0, fontSize: 12 }} onClick={markAllRead}>
          Mark all read
        </Button>
        <Link to={`/${role}/notifications`} style={{ fontSize: 12, color: '#4f46e5' }}>View all →</Link>
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const { user } = useSelector((s) => s.auth);
  const location  = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { token } = theme.useToken();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationsContext();

  const items    = menusByRole[user.role] || [];
  const roleColor = ROLE_COLORS[user.role] || '#1e40af';

  const onMenuAction = ({ key }) => {
    if (key === 'logout')  { dispatch(logout()); navigate('/login'); }
    if (key === 'profile') navigate(`/${user.role}/profile`);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" width={240}
        style={{ background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
      >
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}>BC</div>
            <div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Bank CRM</div>
              <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 2 }}>
                {titleByRole[user.role]} Portal
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#e2e8f0', margin: '0 16px 8px' }} />

        <div style={{ padding: '10px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Avatar size={30} style={{ background: roleColor, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {(user.name || user.email)[0].toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name || user.email}
              </div>
              <div style={{ color: '#64748b', fontSize: 10 }}>{titleByRole[user.role]}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 8px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#94a3b8', padding: '0 8px', marginBottom: 6 }}>
            Navigation
          </div>
          <ConfigProvider theme={{ components: { Menu: {
            itemColor: '#475569', itemHoverColor: '#1e293b', itemHoverBg: '#f1f5f9',
            itemSelectedColor: '#4f46e5', itemSelectedBg: '#ede9fe', itemBorderRadius: 8,
          }}}}>
            <Menu
              theme="light" mode="inline"
              selectedKeys={[location.pathname]}
              items={items}
              style={{ borderInlineEnd: 0, background: 'transparent' }}
            />
          </ConfigProvider>
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(15,23,42,0.05)',
          position: 'sticky', top: 0, zIndex: 100, background: '#ffffff',
        }}>
          <Typography.Text style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            {titleByRole[user.role]} Panel
          </Typography.Text>

          <Space size={16} align="center">
            <Popover
              placement="bottomRight"
              trigger="click"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
                  <span style={{ fontWeight: 700 }}>Notifications</span>
                </div>
              }
              content={
                <NotifDropdown
                  notifications={notifications}
                  role={user.role}
                  markRead={markRead}
                  markAllRead={markAllRead}
                  navigate={navigate}
                />
              }
            >
              <Badge count={unreadCount} overflowCount={99} size="small">
                <div
                  style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <BellOutlined style={{ fontSize: 18, color: '#475569' }} />
                </div>
              </Badge>
            </Popover>

            <Dropdown menu={{ items: [
              { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
            ], onClick: onMenuAction }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar style={{ backgroundColor: roleColor, fontWeight: 700 }}>
                  {(user.name || user.email)[0].toUpperCase()}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{user.name || user.email}</div>
                  <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{titleByRole[user.role]}</div>
                </div>
                <DownOutlined style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }} />
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '12px 16px 16px', padding: '20px 24px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

function AppLayout() {
  return (
    <NotificationsProvider>
      <AppLayoutInner />
    </NotificationsProvider>
  );
}

export default AppLayout;
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/frontend"
npm run build 2>&1 | tail -8
```

Expected: build succeeds (exit 0).

- [ ] **Step 3: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add frontend/src/components/AppLayout.jsx
git commit -m "feat: bell icon with unread badge, notification popover, nav item per role"
```

---

### Task 8: Notifications Page + App Routes

**Files:**
- Create: `frontend/src/pages/Notifications.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create Notifications.jsx**

Create `frontend/src/pages/Notifications.jsx`:

```jsx
import { useState, useMemo } from 'react';
import { Typography, Tabs, Button, Badge, Tag, Empty } from 'antd';
import {
  BellOutlined, PlusCircleOutlined, CheckCircleOutlined,
  UserAddOutlined, SyncOutlined, MessageOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useNotificationsContext } from '../contexts/NotificationsContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const TYPE_ICONS = {
  lead_created:            <PlusCircleOutlined />,
  status_changed:          <CheckCircleOutlined />,
  lead_assigned:           <UserAddOutlined />,
  employee_status_updated: <SyncOutlined />,
  note_added:              <MessageOutlined />,
  commission_payable:      <DollarOutlined />,
};

const TYPE_COLORS = {
  lead_created:            '#4f46e5',
  status_changed:          '#16a34a',
  lead_assigned:           '#2563eb',
  employee_status_updated: '#0891b2',
  note_added:              '#d97706',
  commission_payable:      '#16a34a',
};

const TYPE_LABELS = {
  lead_created:            'New Lead',
  status_changed:          'Status',
  lead_assigned:           'Assigned',
  employee_status_updated: 'Employee Status',
  note_added:              'Note',
  commission_payable:      'Commission',
};

export default function Notifications() {
  const navigate  = useNavigate();
  const { user }  = useSelector((s) => s.auth);
  const { notifications, unreadCount, markRead, markAllRead, connected } = useNotificationsContext();
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, tab]);

  const handleRow = (n) => {
    if (n.lead) navigate(`/${user.role}/leads/${n.lead}`);
    if (!n.isRead) markRead([String(n._id)]);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>Notifications</Typography.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#94a3b8' }} />
              <span style={{ fontSize: 12, color: connected ? '#16a34a' : '#94a3b8' }}>{connected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          <Typography.Text type="secondary">Live activity across your leads</Typography.Text>
        </div>
        <Button size="small" disabled={unreadCount === 0} onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        style={{ marginBottom: 0 }}
        items={[
          { key: 'all',    label: `All (${notifications.length})` },
          { key: 'unread', label: <span>Unread {unreadCount > 0 && <Badge count={unreadCount} size="small" style={{ marginLeft: 4 }} />}</span> },
        ]}
      />

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: 16 }}>
        {filtered.length === 0 && <Empty description="No notifications" style={{ padding: '40px 0' }} />}
        {filtered.map((n, idx) => (
          <div
            key={n._id}
            onClick={() => handleRow(n)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 20px',
              borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: n.isRead ? 'transparent' : '#f8faff',
              cursor: n.lead ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (n.lead) e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : '#f8faff'}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${TYPE_COLORS[n.type] || '#4f46e5'}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: TYPE_COLORS[n.type] || '#4f46e5', fontSize: 16,
            }}>
              {TYPE_ICONS[n.type] || <BellOutlined />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 14, color: '#0f172a' }}>{n.title}</span>
                <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                  {TYPE_LABELS[n.type] || n.type}
                </Tag>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 3 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(n.createdAt).fromNow()}</div>
            </div>

            {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 6, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add import and routes in App.jsx**

Add import after existing imports:

```jsx
import Notifications from './pages/Notifications';
```

Add `<Route path="notifications" element={<Notifications />} />` inside each of the four role Route blocks:

Inside `/admin` block (after `<Route path="profile" element={<Profile />} />`):
```jsx
<Route path="notifications" element={<Notifications />} />
```

Inside `/agent` block:
```jsx
<Route path="notifications" element={<Notifications />} />
```

Inside `/agency` block:
```jsx
<Route path="notifications" element={<Notifications />} />
```

Inside `/employee` block:
```jsx
<Route path="notifications" element={<Notifications />} />
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm/frontend"
npm run build 2>&1 | tail -8
```

Expected: build succeeds.

- [ ] **Step 4: End-to-end manual test**

1. Start backend: `cd backend && node server.js`
2. Start frontend: `cd frontend && npm run dev`
3. Log in as admin — bell icon visible top-right with no badge
4. Open new tab, log in as an agent, submit a lead
5. Admin tab: bell badge shows `1` immediately (real-time via socket)
6. Click bell — dropdown shows "New Lead Submitted" with customer name and bank
7. Click "View all →" — Notifications page loads with LIVE green dot
8. Tab "Unread" — shows only the unread notification
9. Click the row — navigates to lead detail, notification marked read
10. Badge drops to 0

- [ ] **Step 5: Commit**

```bash
cd "/Users/californiamediadubai/Desktop/bank crm/bank_crm"
git add frontend/src/pages/Notifications.jsx frontend/src/App.jsx
git commit -m "feat: Notifications page with live indicator, all/unread tabs, role routes"
```
