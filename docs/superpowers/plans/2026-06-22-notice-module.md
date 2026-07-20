# Notice Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notice module where admin creates date-ranged, role-targeted broadcast notices that appear as dismissible alert banners on each role's dashboard.

**Architecture:** Backend adds a Notice Mongoose model + REST controller + routes using the existing `protect`/`requireRole` middleware. Frontend adds a Redux slice for fetching active notices and a reusable `NoticeBanner` component that renders Ant Design Alert strips with sessionStorage-based dismiss tracking.

**Tech Stack:** Node.js/Express, Mongoose, React, Redux Toolkit, Ant Design 5, `dayjs`

## Global Constraints

- Backend uses CommonJS (`require` / `module.exports`) — no ES module syntax
- Frontend uses ES modules (`import` / `export default`)
- Ant Design 5 component API throughout — no Ant Design 4 props
- Do NOT push to git remote at any point
- Route `/api/notices/active` must be declared BEFORE `/:id` in the router file to prevent Express treating the string "active" as a param value

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/models/Notice.js` | Mongoose schema |
| Create | `backend/controllers/notice.controller.js` | CRUD + getActive |
| Create | `backend/routes/notice.routes.js` | Route definitions |
| Modify | `backend/server.js:76` | Mount notice routes |
| Create | `frontend/src/store/slices/noticesSlice.js` | Redux slice |
| Modify | `frontend/src/store/index.js` | Register reducer |
| Create | `frontend/src/components/NoticeBanner.jsx` | Alert banner component |
| Create | `frontend/src/pages/admin/Notices.jsx` | Admin CRUD page |
| Modify | `frontend/src/App.jsx:109` | Add `/admin/notices` route |
| Modify | `frontend/src/components/AppLayout.jsx:55` | Add Notices nav item |
| Modify | `frontend/src/pages/admin/Dashboard.jsx` | Insert `<NoticeBanner />` |
| Modify | `frontend/src/pages/agent/Dashboard.jsx` | Insert `<NoticeBanner />` |
| Modify | `frontend/src/pages/agency/Dashboard.jsx` | Insert `<NoticeBanner />` |
| Modify | `frontend/src/pages/employee/Dashboard.jsx` | Insert `<NoticeBanner />` |

---

### Task 1: Notice Mongoose Model

**Files:**
- Create: `backend/models/Notice.js`

**Interfaces:**
- Produces: `Notice` Mongoose model — exported via `module.exports`
- Fields: `title` (String, required), `message` (String, required), `targetRoles` ([String], enum `['admin','agency','agent','employee']`, minlength 1), `startDate` (Date, required), `endDate` (Date, required), `isActive` (Boolean, default true), `createdBy` (ObjectId → User, required), timestamps

- [ ] **Step 1: Create the model file**

```js
// backend/models/Notice.js
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    message:     { type: String, required: true, trim: true },
    targetRoles: {
      type: [{ type: String, enum: ['admin', 'agency', 'agent', 'employee'] }],
      validate: { validator: (v) => v.length > 0, message: 'At least one role required' },
    },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

noticeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
```

- [ ] **Step 2: Verify server still starts**

```bash
cd backend && node -e "require('./models/Notice'); console.log('OK')"
```
Expected: prints `OK` with no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/models/Notice.js
git commit -m "feat: add Notice model"
```

---

### Task 2: Notice Controller

**Files:**
- Create: `backend/controllers/notice.controller.js`

**Interfaces:**
- Consumes: `Notice` from `../models/Notice`
- Produces: exports `createNotice`, `listNotices`, `updateNotice`, `deleteNotice`, `getActiveNotices`

- [ ] **Step 1: Create the controller file**

```js
// backend/controllers/notice.controller.js
const Notice = require('../models/Notice');

exports.createNotice = async (req, res) => {
  try {
    const { title, message, targetRoles, startDate, endDate, isActive } = req.body;
    const notice = await Notice.create({
      title,
      message,
      targetRoles,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });
    res.status(201).json(notice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.listNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ startDate: -1 }).lean();
    res.json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getActiveNotices = async (req, res) => {
  try {
    const now = new Date();
    const notices = await Notice.find({
      isActive: true,
      targetRoles: req.user.role,
      startDate: { $lte: now },
      endDate:   { $gte: now },
    })
      .sort({ startDate: -1 })
      .lean();
    res.json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Verify syntax**

```bash
cd backend && node -e "require('./controllers/notice.controller'); console.log('OK')"
```
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/notice.controller.js
git commit -m "feat: add notice controller"
```

---

### Task 3: Notice Routes + Server Mount

**Files:**
- Create: `backend/routes/notice.routes.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `protect`, `requireRole` from `../middleware/auth.middleware`; all exports from `notice.controller.js`
- Produces: `GET /api/notices/active`, `GET /api/notices`, `POST /api/notices`, `PUT /api/notices/:id`, `DELETE /api/notices/:id`

- [ ] **Step 1: Create route file**

```js
// backend/routes/notice.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/notice.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

// /active MUST come before /:id — otherwise Express matches "active" as an id param
router.get('/active', protect, ctrl.getActiveNotices);

router.use(protect, requireRole('admin'));
router.post('/',    ctrl.createNotice);
router.get('/',     ctrl.listNotices);
router.put('/:id',  ctrl.updateNotice);
router.delete('/:id', ctrl.deleteNotice);

module.exports = router;
```

- [ ] **Step 2: Mount in server.js**

In `backend/server.js`, add this line after line 76 (`app.use('/api/notifications', ...)`):

```js
app.use('/api/notices',          require('./routes/notice.routes'));
```

The `app.use` block should now include:
```js
app.use('/api/notifications',     require('./routes/notification.routes'));
app.use('/api/notices',           require('./routes/notice.routes'));
app.use('/api/inquiries',         require('./routes/inquiry.routes'));
```

- [ ] **Step 3: Start backend and smoke-test**

Start the backend server (or restart if running), then:

```bash
# Should return 401 (not 404)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/notices/active
```
Expected: `401`

```bash
# Should also return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/notices
```
Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/notice.routes.js backend/server.js
git commit -m "feat: add notice routes and mount in server"
```

---

### Task 4: Redux Notices Slice

**Files:**
- Create: `frontend/src/store/slices/noticesSlice.js`
- Modify: `frontend/src/store/index.js`

**Interfaces:**
- Consumes: `api` from `../../api/client`; `GET /api/notices/active` returns `Notice[]`
- Produces:
  - thunk `fetchActiveNotices(): Promise<Notice[]>`
  - selector: `state.notices.items` → `Notice[]`
  - selector: `state.notices.status` → `'idle' | 'loading' | 'failed'`

- [ ] **Step 1: Create the slice**

```js
// frontend/src/store/slices/noticesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/client';

export const fetchActiveNotices = createAsyncThunk(
  'notices/fetchActive',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notices/active');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load notices');
    }
  }
);

const noticesSlice = createSlice({
  name: 'notices',
  initialState: { items: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveNotices.pending,   (state) => { state.status = 'loading'; })
      .addCase(fetchActiveNotices.fulfilled, (state, action) => {
        state.items  = action.payload;
        state.status = 'idle';
      })
      .addCase(fetchActiveNotices.rejected,  (state, action) => {
        state.status = 'failed';
        state.error  = action.payload;
      });
  },
});

export default noticesSlice.reducer;
```

- [ ] **Step 2: Register reducer in store**

Replace the entire contents of `frontend/src/store/index.js` with:

```js
import { configureStore } from '@reduxjs/toolkit';
import authReducer    from './slices/authSlice';
import noticesReducer from './slices/noticesSlice';

export const store = configureStore({
  reducer: {
    auth:    authReducer,
    notices: noticesReducer,
  },
});
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/slices/noticesSlice.js frontend/src/store/index.js
git commit -m "feat: add notices Redux slice"
```

---

### Task 5: NoticeBanner Component

**Files:**
- Create: `frontend/src/components/NoticeBanner.jsx`

**Interfaces:**
- Consumes: `fetchActiveNotices` from `../store/slices/noticesSlice`; `state.notices.items`, `state.notices.status` from Redux
- Produces: `<NoticeBanner />` — zero-prop component, renders nothing when no active notices

- [ ] **Step 1: Create the component**

```jsx
// frontend/src/components/NoticeBanner.jsx
import { useEffect, useState } from 'react';
import { Alert, Space } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchActiveNotices } from '../store/slices/noticesSlice';

const STORAGE_KEY = 'dismissed_notices';

function getDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function addDismissed(id) {
  const current = getDismissed();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id]));
}

function NoticeBanner() {
  const dispatch = useDispatch();
  const { items, status } = useSelector((s) => s.notices);
  const [dismissed, setDismissed] = useState(getDismissed);

  useEffect(() => {
    if (status === 'idle' && items.length === 0) {
      dispatch(fetchActiveNotices());
    }
  }, [dispatch, status, items.length]);

  const visible = items.filter((n) => !dismissed.includes(n._id));

  if (!visible.length) return null;

  const handleClose = (id) => {
    addDismissed(id);
    setDismissed((prev) => [...prev, id]);
  };

  return (
    <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }}>
      {visible.map((n) => (
        <Alert
          key={n._id}
          type="info"
          showIcon
          closable
          message={n.title}
          description={n.message}
          onClose={() => handleClose(n._id)}
        />
      ))}
    </Space>
  );
}

export default NoticeBanner;
```

- [ ] **Step 2: Verify no import errors**

```bash
cd frontend && node --input-type=module <<'EOF'
import('/dev/null').catch(()=>{});
console.log('syntax ok');
EOF
```

Simpler check — just ensure the build passes:
```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NoticeBanner.jsx
git commit -m "feat: add NoticeBanner component"
```

---

### Task 6: Admin Notices Management Page

**Files:**
- Create: `frontend/src/pages/admin/Notices.jsx`

**Interfaces:**
- Consumes: `api` from `../../api/client`; endpoints `GET /notices`, `POST /notices`, `PUT /notices/:id`, `DELETE /notices/:id`
- Produces: `<Notices />` default export — table with create/edit/delete, active toggle

- [ ] **Step 1: Create the page**

```jsx
// frontend/src/pages/admin/Notices.jsx
import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, Popconfirm,
  Tag, Space, Typography, DatePicker, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const ROLE_COLORS = { admin: 'purple', agency: 'blue', agent: 'cyan', employee: 'orange' };
const ROLE_OPTIONS = [
  { label: 'Admin',    value: 'admin' },
  { label: 'Agency',   value: 'agency' },
  { label: 'Agent',    value: 'agent' },
  { label: 'Employee', value: 'employee' },
];

export default function Notices() {
  const [notices,     setNotices]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [form]                        = Form.useForm();

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notices');
      setNotices(data);
    } catch {
      message.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title:       record.title,
      message:     record.message,
      targetRoles: record.targetRoles,
      dateRange:   [dayjs(record.startDate), dayjs(record.endDate)],
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    const [startDate, endDate] = values.dateRange;
    const payload = {
      title:       values.title,
      message:     values.message,
      targetRoles: values.targetRoles,
      startDate:   startDate.toISOString(),
      endDate:     endDate.toISOString(),
    };

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/notices/${editing._id}`, payload);
        message.success('Notice updated');
      } else {
        await api.post('/notices', payload);
        message.success('Notice created');
      }
      setModalOpen(false);
      fetchNotices();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notices/${id}`);
      message.success('Deleted');
      fetchNotices();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await api.put(`/notices/${id}`, { isActive });
      setNotices((prev) => prev.map((n) => n._id === id ? { ...n, isActive } : n));
    } catch {
      message.error('Update failed');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (v) => v.length > 60 ? v.slice(0, 60) + '…' : v,
    },
    {
      title: 'Target Roles',
      dataIndex: 'targetRoles',
      key: 'targetRoles',
      render: (roles) => (
        <Space size={4} wrap>
          {roles.map((r) => <Tag key={r} color={ROLE_COLORS[r]}>{r}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'Start',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
      width: 120,
    },
    {
      title: 'End',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
      width: 120,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (val, record) => (
        <Switch
          checked={val}
          size="small"
          onChange={(checked) => handleToggle(record._id, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text" size="small" icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="Delete this notice?"
            onConfirm={() => handleDelete(record._id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Notices</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Notice
        </Button>
      </div>

      <Table
        dataSource={notices}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        title={editing ? 'Edit Notice' : 'New Notice'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editing ? 'Save' : 'Create'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title required' }]}>
            <Input placeholder="Notice title" />
          </Form.Item>

          <Form.Item name="message" label="Message" rules={[{ required: true, message: 'Message required' }]}>
            <Input.TextArea rows={3} placeholder="Notice message" />
          </Form.Item>

          <Form.Item
            name="targetRoles"
            label="Target Roles"
            rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one role' }]}
          >
            <Select mode="multiple" options={ROLE_OPTIONS} placeholder="Select roles" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Active Date Range"
            rules={[{ required: true, message: 'Date range required' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/Notices.jsx
git commit -m "feat: add admin Notices management page"
```

---

### Task 7: Wire Everything Together

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/AppLayout.jsx`
- Modify: `frontend/src/pages/admin/Dashboard.jsx`
- Modify: `frontend/src/pages/agent/Dashboard.jsx`
- Modify: `frontend/src/pages/agency/Dashboard.jsx`
- Modify: `frontend/src/pages/employee/Dashboard.jsx`

**Interfaces:**
- Consumes: `Notices` from `./pages/admin/Notices`, `NoticeBanner` from `./components/NoticeBanner`

- [ ] **Step 1: Add route in App.jsx**

In `frontend/src/App.jsx`:

1. Add import at top with other admin imports:
```jsx
import AdminNotices from './pages/admin/Notices';
```

2. Add route inside the `/admin` route block, after the `notifications` route (line ~111):
```jsx
<Route path="notices" element={<AdminNotices />} />
```

- [ ] **Step 2: Add Notices nav item in AppLayout.jsx**

In `frontend/src/components/AppLayout.jsx`, add `NotificationOutlined` to the icon imports:
```jsx
import {
  // ...existing imports...
  NotificationOutlined,
} from '@ant-design/icons';
```

Then in the `menusByRole.admin` array (after the `notifications` entry at line ~56), add:
```jsx
{ key: '/admin/notices', icon: <NotificationOutlined />, label: <Link to="/admin/notices">Notices</Link> },
```

- [ ] **Step 3: Add NoticeBanner to admin Dashboard**

In `frontend/src/pages/admin/Dashboard.jsx`:

1. Add import at top:
```jsx
import NoticeBanner from '../../components/NoticeBanner';
```

2. Find the outermost return `<div>` of the dashboard component and insert `<NoticeBanner />` as the first child:
```jsx
return (
  <div>
    <NoticeBanner />
    {/* ...existing content... */}
  </div>
);
```

- [ ] **Step 4: Add NoticeBanner to agent Dashboard**

In `frontend/src/pages/agent/Dashboard.jsx`:

1. Add import:
```jsx
import NoticeBanner from '../../components/NoticeBanner';
```

2. Insert `<NoticeBanner />` as first child of the outermost return `<div>`:
```jsx
return (
  <div>
    <NoticeBanner />
    {/* ...existing content... */}
  </div>
);
```

- [ ] **Step 5: Add NoticeBanner to agency Dashboard**

In `frontend/src/pages/agency/Dashboard.jsx`:

1. Add import:
```jsx
import NoticeBanner from '../../components/NoticeBanner';
```

2. Insert `<NoticeBanner />` as first child of the outermost return `<div>`:
```jsx
return (
  <div>
    <NoticeBanner />
    {/* ...existing content... */}
  </div>
);
```

- [ ] **Step 6: Add NoticeBanner to employee Dashboard**

In `frontend/src/pages/employee/Dashboard.jsx`:

1. Add import:
```jsx
import NoticeBanner from '../../components/NoticeBanner';
```

2. Insert `<NoticeBanner />` as first child of the outermost return `<div>`:
```jsx
return (
  <div>
    <NoticeBanner />
    {/* ...existing content... */}
  </div>
);
```

- [ ] **Step 7: Build and verify**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: build succeeds with no errors.

- [ ] **Step 8: End-to-end smoke test**

1. Start backend and frontend dev servers
2. Log in as admin → navigate to `/admin/notices`
3. Create a notice: title "Test Notice", message "Hello world", roles = Agent, date range = today ± 7 days
4. Log out, log in as agent → verify blue info banner appears at top of dashboard with title "Test Notice"
5. Click the X on the banner → banner disappears
6. Refresh the page → banner reappears (sessionStorage is cleared on new tab/session, but persists within same tab session — so if you refresh without closing the tab, it stays dismissed. Open a new tab/new session to verify it reappears.)
7. Go back to admin → edit the notice, change end date to yesterday → log in as agent again → banner should NOT appear

- [ ] **Step 9: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/AppLayout.jsx \
  frontend/src/pages/admin/Dashboard.jsx frontend/src/pages/agent/Dashboard.jsx \
  frontend/src/pages/agency/Dashboard.jsx frontend/src/pages/employee/Dashboard.jsx
git commit -m "feat: wire NoticeBanner to all dashboards and add admin nav route"
```
