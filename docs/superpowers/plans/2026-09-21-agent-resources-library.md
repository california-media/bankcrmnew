# Agent Resources Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin upload and manage a library of images/PDFs (bank flyers, policy documents, training decks), optionally restricted to specific agencies, and let agents browse/view/download them from a new "Resources" tab.

**Architecture:** New `Resource` model + CRUD controller/routes on the backend, following the exact `CardProduct`/`Bank` conventions already established in this codebase (`assignedAgencies` visibility filter, multer-s3 upload, `FormData`-based admin CRUD page). Two new frontend pages — an admin management page (modeled on `FeaturedProducts.jsx`) and a read-only agent browsing page (modeled on `agent/Products.jsx`) — wired into the existing sidebar/route structure.

**Tech Stack:** Node/Express/Mongoose (backend), React/Ant Design (frontend), multer-s3 for file storage. No automated test framework in this repo — verify via `node -c` syntax checks, direct-script functional calls against the real controller functions (mirrors every other plan executed in this session), and manual UI verification against the running dev servers.

**Spec:** `docs/superpowers/specs/2026-09-21-agent-resources-library-design.md`

## Global Constraints

- File types: **images and PDFs only** (`.jpg`, `.jpeg`, `.png`, `.pdf`) — no video, no Office documents.
- Grouping: by **bank** (optional, nullable) and by **type** — a fixed enum `flyer` / `policy` / `training` / `other`, not a separate manageable category model.
- Visibility: **`assignedAgencies`** array — empty/absent = visible to every agency (default); non-empty = only the listed agencies. Copy this filter pattern verbatim from `backend/controllers/cardProduct.controller.js:20-38`.
- Upload/manage: **admin only**. Agents are read-only (view/download).
- New "Resources" tab appears **only in the Agent portal** sidebar, directly after "Promotion". The admin management page is reached from the admin sidebar grouped with the other catalog-style pages (Card Products, Loan Products, Account Products, Featured Products) — placed directly after "Featured Products", not after "Promotions" (this refines the spec's deferred placement decision; the spec explicitly left exact admin placement as an implementation detail).

---

### Task 1: Backend — `Resource` model + upload subdir

**Files:**
- Create: `backend/models/Resource.js`
- Modify: `backend/middleware/upload.middleware.js:66-67`

**Interfaces:**
- Produces: `Resource` Mongoose model with fields `title, description, bank, type, file, fileType, assignedAgencies, isActive, createdAt, updatedAt`. `upload.resources` — a multer-s3 instance (subdir `'resources'`, accepts `jpeg/jpg/png/pdf`) — consumed by Task 2's routes.

- [ ] **Step 1: Create the model**

Create `backend/models/Resource.js`:
```js
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
    type: { type: String, enum: ['flyer', 'policy', 'training', 'other'], required: true },
    file: { type: String, required: true },
    fileType: { type: String, enum: ['image', 'pdf'], required: true },
    // Same convention as CardProduct.assignedAgencies / Bank.assignedAgencies
    // (backend/models/CardProduct.js:23, backend/models/Bank.js:14): empty
    // or absent = visible to every agency; non-empty = only these.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
```

- [ ] **Step 2: Add the upload subdir**

In `backend/middleware/upload.middleware.js`, line 66-67 currently read:
```js
module.exports.featuredProductImages = makeUpload('featured-products', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.avatars            = makeUpload('avatars',              ['jpeg', 'jpg', 'png', 'webp']);
```
Change to:
```js
module.exports.featuredProductImages = makeUpload('featured-products', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.avatars            = makeUpload('avatars',              ['jpeg', 'jpg', 'png', 'webp']);
module.exports.resources          = makeUpload('resources',            ['jpeg', 'jpg', 'png', 'pdf']);
```

- [ ] **Step 3: Verify — models load cleanly**

Run:
```bash
cd backend && node -e "const Resource = require('./models/Resource'); const upload = require('./middleware/upload.middleware'); console.log('Resource model OK:', !!Resource.schema.path('assignedAgencies')); console.log('upload.resources OK:', typeof upload.resources.single === 'function');"
```
Expected:
```
Resource model OK: true
upload.resources OK: true
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/Resource.js backend/middleware/upload.middleware.js
git commit -m "Add Resource model and resources upload subdir

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — controller, routes, server mount

**Files:**
- Create: `backend/controllers/resource.controller.js`
- Create: `backend/routes/resource.routes.js`
- Modify: `backend/server.js` (after line 89)

**Interfaces:**
- Consumes: `Resource` model and `upload.resources` (Task 1).
- Produces: `GET/POST /api/resources`, `PUT/DELETE /api/resources/:id` — consumed by Task 3 (admin page) and Task 4 (agent page).

- [ ] **Step 1: Write the controller**

Create `backend/controllers/resource.controller.js`:
```js
const path = require('path');
const Resource = require('../models/Resource');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');
const { resolveAgencyId } = require('../middleware/auth.middleware');

const POPULATE = [
  { path: 'bank', select: 'name code logo' },
];

const deleteResourceFile = (filename) => deleteFromS3('resources', filename);

const parseJsonField = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
};

const fileTypeFor = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png'].includes(ext) ? 'image' : 'pdf';
};

// GET /api/resources  (all authenticated roles)
exports.list = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    // Same visibility filter as cardProduct.controller.js:20-38 /
    // bank.controller.js:16-34 — empty/absent assignedAgencies stays
    // visible to everyone; admin always sees all (incl. inactive).
    if (req.user.role !== 'admin') {
      const agencyId = req.user.role === 'employee' ? resolveAgencyId(req.user) : (req.user.role === 'agency' ? req.user._id : req.user.agency);
      filter.$or = [
        { assignedAgencies: { $exists: false } },
        { assignedAgencies: { $size: 0 } },
        ...(agencyId ? [{ assignedAgencies: agencyId }] : []),
      ];
    }
    const resources = await Resource.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/resources  (admin only)
exports.create = async (req, res) => {
  try {
    const { title, description, bank, type } = req.body;
    if (!title || !type) {
      if (req.file) deleteResourceFile(getFilename(req.file));
      return res.status(400).json({ message: 'title and type are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'A file (image or PDF) is required' });
    }
    const resource = await Resource.create({
      title,
      description: description || '',
      bank: bank || null,
      type,
      assignedAgencies: parseJsonField(req.body.assignedAgencies),
      file: getFilename(req.file),
      fileType: fileTypeFor(req.file),
      isActive: req.body.isActive === undefined ? true : req.body.isActive !== 'false' && req.body.isActive !== false,
    });
    const populated = await resource.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (req.file) deleteResourceFile(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/resources/:id  (admin only)
exports.update = async (req, res) => {
  try {
    const { title, description, bank, type } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description || '';
    if (bank !== undefined) update.bank = bank || null;
    if (type !== undefined) update.type = type;
    if (req.body.assignedAgencies !== undefined) update.assignedAgencies = parseJsonField(req.body.assignedAgencies);
    if (req.body.isActive !== undefined) update.isActive = req.body.isActive !== 'false' && req.body.isActive !== false;

    if (req.file) {
      const existing = await Resource.findById(req.params.id, 'file');
      if (existing?.file) deleteResourceFile(existing.file);
      update.file = getFilename(req.file);
      update.fileType = fileTypeFor(req.file);
    }

    const resource = await Resource.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!resource) {
      if (req.file) deleteResourceFile(getFilename(req.file));
      return res.status(404).json({ message: 'Resource not found' });
    }
    res.json(resource);
  } catch (err) {
    if (req.file) deleteResourceFile(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/resources/:id  (admin only)
exports.remove = async (req, res) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    if (resource.file) deleteResourceFile(resource.file);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Write the routes**

Create `backend/routes/resource.routes.js`:
```js
const router = require('express').Router();
const ctrl = require('../controllers/resource.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// All authenticated roles can read (filtered by role inside the controller)
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), upload.resources.single('file'), ctrl.create);
router.put('/:id', requireRole('admin'), upload.resources.single('file'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
```

- [ ] **Step 3: Mount the route**

In `backend/server.js`, line 89 currently reads:
```js
app.use('/api/promotions',        require('./routes/promotion.routes'));
```
Change to:
```js
app.use('/api/promotions',        require('./routes/promotion.routes'));
app.use('/api/resources',         require('./routes/resource.routes'));
```

- [ ] **Step 4: Verify — syntax**

Run:
```bash
cd backend && node -c controllers/resource.controller.js && node -c routes/resource.routes.js && node -c server.js && echo OK
```
Expected: `OK` with no errors.

- [ ] **Step 5: Verify — functional walk via direct controller calls**

Write `backend/verify-resources.js`:
```js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Bank = require('./models/Bank');
const Resource = require('./models/Resource');
const ctrl = require('./controllers/resource.controller');

let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}${extra && !cond ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ role: 'admin' });
  const agency = await User.findOne({ role: 'agency' });
  const otherAgency = await User.findOne({ role: 'agency', _id: { $ne: agency._id } }) || agency;
  const bank = await Bank.findOne({ isActive: true });

  // Create an unrestricted PDF resource as admin.
  const createRes = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.create(
    { user: admin, body: { title: 'TEST Policy Doc', type: 'policy', bank: String(bank._id) }, file: { key: 'resources/abc123.pdf', originalname: 'policy.pdf' } },
    createRes,
  );
  check('Admin can create a resource', createRes._code === 201, `got ${createRes._code}: ${JSON.stringify(createRes._body)}`);
  check('fileType derived as pdf', createRes._body?.fileType === 'pdf', createRes._body?.fileType);
  const unrestrictedId = createRes._body._id;

  // Create a restricted image resource, visible only to `agency`.
  const createRes2 = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.create(
    { user: admin, body: { title: 'TEST Restricted Flyer', type: 'flyer', assignedAgencies: JSON.stringify([String(agency._id)]) }, file: { key: 'resources/def456.jpg', originalname: 'flyer.jpg' } },
    createRes2,
  );
  check('Admin can create a restricted resource', createRes2._code === 201, JSON.stringify(createRes2._body));
  check('fileType derived as image', createRes2._body?.fileType === 'image', createRes2._body?.fileType);
  const restrictedId = createRes2._body._id;

  // Agency in the allow-list sees both.
  const listRes1 = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.list({ user: agency }, listRes1);
  const ids1 = (listRes1._body || []).map((r) => String(r._id));
  check('Allow-listed agency sees the unrestricted resource', ids1.includes(String(unrestrictedId)));
  check('Allow-listed agency sees the restricted resource', ids1.includes(String(restrictedId)));

  // A different agency sees only the unrestricted one.
  const listRes2 = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.list({ user: otherAgency }, listRes2);
  const ids2 = (listRes2._body || []).map((r) => String(r._id));
  check('Other agency sees the unrestricted resource', ids2.includes(String(unrestrictedId)));
  check('Other agency does NOT see the restricted resource', !ids2.includes(String(restrictedId)), `otherAgency=${otherAgency._id}, agency=${agency._id}`);

  // Update: replace the file on the unrestricted resource.
  const updateRes = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.update(
    { params: { id: unrestrictedId }, user: admin, body: { title: 'TEST Policy Doc Updated' }, file: { key: 'resources/ghi789.png', originalname: 'newimg.png' } },
    updateRes,
  );
  check('Update replaces file and title', !updateRes._code && updateRes._body?.title === 'TEST Policy Doc Updated' && updateRes._body?.fileType === 'image', JSON.stringify(updateRes._body));

  // Delete both.
  const delRes1 = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.remove({ params: { id: unrestrictedId } }, delRes1);
  check('Delete unrestricted resource succeeds', delRes1._body?.ok === true);

  const delRes2 = { status(c) { this._code = c; return this; }, json(b) { this._body = b; } };
  await ctrl.remove({ params: { id: restrictedId } }, delRes2);
  check('Delete restricted resource succeeds', delRes2._body?.ok === true);

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `cd backend && node verify-resources.js`
Expected: every line prints `PASS: ...`, ending with `ALL PASSED`.

Then delete the scratch file: `rm backend/verify-resources.js`.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/resource.controller.js backend/routes/resource.routes.js backend/server.js
git commit -m "Add Resources CRUD API (admin-managed, agency-restricted)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — Admin Resources page + nav/route

**Files:**
- Create: `frontend/src/pages/admin/Resources.jsx`
- Modify: `frontend/src/components/AppLayout.jsx` (icon import line 11, admin menu after line 55)
- Modify: `frontend/src/App.jsx` (import after line 19, route after line 140)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/resources`, `GET /banks`, `GET /agencies` (Task 2 + existing endpoints).
- Produces: `/admin/resources` page, reachable from the admin sidebar.

- [ ] **Step 1: Write the admin page**

Create `frontend/src/pages/admin/Resources.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, Space, Popconfirm, Typography, message, Switch, Tag, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, FilePdfOutlined } from '@ant-design/icons';
import api from '../../api/client';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const TYPE_OPTIONS = [
  { value: 'flyer', label: 'Flyer' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'training', label: 'Training Deck' },
  { value: 'other', label: 'Other' },
];
const TYPE_COLORS = { flyer: 'blue', policy: 'gold', training: 'purple', other: 'default' };

function Resources() {
  const [resources, setResources] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [resRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/resources'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setResources(resRes.data);
      setBanks(banksRes.data);
      setAgencies(agenciesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setFileList([]);
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      title: r.title,
      description: r.description || '',
      bank: r.bank?._id || r.bank || undefined,
      type: r.type,
      assignedAgencies: (r.assignedAgencies || []).map((a) => a?._id || a),
      isActive: r.isActive !== false,
    });
    setFileList(r.file ? [{
      uid: '-1', name: r.file, status: 'done',
      url: `${UPLOADS_BASE}/resources/${r.file}`,
      thumbUrl: r.fileType === 'image' ? `${UPLOADS_BASE}/resources/${r.file}` : undefined,
    }] : []);
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const newFile = fileList.find((f) => f.originFileObj);
    if (!editing && !newFile) {
      message.error('A file is required');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', values.title);
      fd.append('description', values.description || '');
      if (values.bank) fd.append('bank', values.bank);
      fd.append('type', values.type);
      fd.append('assignedAgencies', JSON.stringify(values.assignedAgencies || []));
      fd.append('isActive', values.isActive !== false ? 'true' : 'false');
      if (newFile) fd.append('file', newFile.originFileObj);

      if (editing) {
        await api.put(`/resources/${editing._id}`, fd);
        message.success('Resource updated');
      } else {
        await api.post('/resources', fd);
        message.success('Resource created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/resources/${id}`);
      message.success('Resource deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (row) => {
    try {
      const fd = new FormData();
      fd.append('isActive', row.isActive !== false ? 'false' : 'true');
      await api.put(`/resources/${row._id}`, fd);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const columns = [
    {
      title: 'File',
      width: 70,
      render: (_, row) => row.fileType === 'image'
        ? <img src={`${UPLOADS_BASE}/resources/${row.file}`} alt="" style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
        : <div style={{ width: 52, height: 40, borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#dc2626', fontSize: 18 }}><FilePdfOutlined /></div>,
    },
    { title: 'Title', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Bank', render: (_, row) => row.bank?.name || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Type', dataIndex: 'type', render: (v) => <Tag color={TYPE_COLORS[v]}>{TYPE_OPTIONS.find((t) => t.value === v)?.label || v}</Tag> },
    {
      title: 'Restricted To',
      render: (_, row) => row.assignedAgencies?.length
        ? <Tag>{row.assignedAgencies.length} agenc{row.assignedAgencies.length === 1 ? 'y' : 'ies'}</Tag>
        : <Typography.Text type="secondary">All agencies</Typography.Text>,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      render: (v, row) => <Switch checked={v !== false} checkedChildren="On" unCheckedChildren="Off" onChange={() => toggleActive(row)} />,
    },
    {
      title: 'Actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this resource?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Resources</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Resource</Button>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Flyers, policy documents, and training decks available for agents to view or download.
      </Typography.Text>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={resources} columns={columns} scroll={{ x: 'max-content' }} />
      </div>

      <Modal
        title={editing ? 'Edit Resource' : 'Add Resource'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. FAB Titanium Card Flyer" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item name="bank" label="Bank (optional)">
            <Select allowClear showSearch placeholder="Select bank" options={bankOptions} filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Select a type' }]}>
            <Select placeholder="Select type" options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>
          <Form.Item label="File (image or PDF)">
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                return false;
              }}
              onRemove={() => { setFileList([]); return false; }}
              accept=".jpg,.jpeg,.png,.pdf"
              maxCount={1}
            >
              {fileList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8, fontSize: 12 }}>Upload</div>
                </div>
              )}
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>JPG, PNG, or PDF — max 10 MB</Typography.Text>
          </Form.Item>
          <Form.Item
            name="assignedAgencies"
            label="Assign to Agencies"
            tooltip="Leave empty to keep this resource visible to every agency (default). Pick specific agencies to restrict it to only them."
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="All agencies (default) — pick to restrict"
              options={agencyOptions}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Resources;
```

- [ ] **Step 2: Add the sidebar icon import**

In `frontend/src/components/AppLayout.jsx`, the icon import block (lines 3-12) currently ends:
```jsx
  BarChartOutlined, StarOutlined, RiseOutlined, LockOutlined, GiftOutlined,
} from '@ant-design/icons';
```
Change to:
```jsx
  BarChartOutlined, StarOutlined, RiseOutlined, LockOutlined, GiftOutlined, FolderOutlined,
} from '@ant-design/icons';
```

- [ ] **Step 3: Add the admin sidebar entry**

In the same file, the admin menu array (line 55) currently reads:
```jsx
    { key: '/admin/featured-products', icon: <StarOutlined />,         label: <Link to="/admin/featured-products">Featured Products</Link> },
    { key: '/admin/payouts',           icon: <DollarOutlined />,       label: <Link to="/admin/payouts">Payouts</Link> },
```
Change to:
```jsx
    { key: '/admin/featured-products', icon: <StarOutlined />,         label: <Link to="/admin/featured-products">Featured Products</Link> },
    { key: '/admin/resources',         icon: <FolderOutlined />,       label: <Link to="/admin/resources">Resources</Link> },
    { key: '/admin/payouts',           icon: <DollarOutlined />,       label: <Link to="/admin/payouts">Payouts</Link> },
```

- [ ] **Step 4: Add the import and route**

In `frontend/src/App.jsx`, line 19-20 currently read:
```jsx
import FeaturedProducts from './pages/admin/FeaturedProducts';
import LoanProducts from './pages/admin/LoanProducts';
```
Change to:
```jsx
import FeaturedProducts from './pages/admin/FeaturedProducts';
import AdminResources from './pages/admin/Resources';
import LoanProducts from './pages/admin/LoanProducts';
```

Then, lines 140-141 currently read:
```jsx
          <Route path="featured-products" element={<FeaturedProducts />} />
          <Route path="loan-products" element={<LoanProducts />} />
```
Change to:
```jsx
          <Route path="featured-products" element={<FeaturedProducts />} />
          <Route path="resources" element={<AdminResources />} />
          <Route path="loan-products" element={<LoanProducts />} />
```

- [ ] **Step 5: Verify — lint and build**

Run:
```bash
cd frontend && npx eslint src/pages/admin/Resources.jsx src/components/AppLayout.jsx src/App.jsx
```
Expected: no new errors (pre-existing errors/warnings in `AppLayout.jsx`/`App.jsx`, if any, are unrelated and unchanged).

Run: `cd frontend && npx vite build`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 6: Verify — manual walkthrough**

Against the running dev servers: log in as admin, confirm "Resources" appears in the sidebar directly after "Featured Products", click it, click "Add Resource", fill in a title, pick a type, upload a PDF, save — confirm it appears in the table with a PDF-icon thumbnail. Add a second one as an image with one agency selected in "Assign to Agencies" — confirm it shows "1 agency" in the Restricted To column. Edit one, replace its file, confirm the old S3 file no longer 404s-safely (can't visually confirm S3 deletion, but confirm the new file displays correctly). Delete one.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/admin/Resources.jsx frontend/src/components/AppLayout.jsx frontend/src/App.jsx
git commit -m "Add admin Resources management page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — Agent Resources page + nav/route

**Files:**
- Create: `frontend/src/pages/agent/Resources.jsx`
- Modify: `frontend/src/components/AppLayout.jsx` (agent menu after line 86)
- Modify: `frontend/src/App.jsx` (import after line 29, route after line 183)

**Interfaces:**
- Consumes: `GET /api/resources` (Task 2, already agency-filtered server-side for the `agent` role).
- Produces: `/agent/resources` page, reachable from the agent sidebar directly below "Promotion".

- [ ] **Step 1: Write the agent page**

Create `frontend/src/pages/agent/Resources.jsx`:
```jsx
import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Select, Empty, Skeleton, Tag, Button } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../api/client';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const TYPE_OPTIONS = [
  { value: 'flyer', label: 'Flyer' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'training', label: 'Training Deck' },
  { value: 'other', label: 'Other' },
];
const TYPE_COLORS = { flyer: 'blue', policy: 'gold', training: 'purple', other: 'default' };

function ResourceCard({ resource }) {
  const url = `${UPLOADS_BASE}/resources/${resource.file}`;
  return (
    <Card
      size="small"
      style={{ borderRadius: 12, border: '1px solid #ede9fe', height: '100%', boxShadow: '0 2px 12px rgba(124,58,237,0.07)' }}
      styles={{ body: { padding: 14 } }}
    >
      {resource.fileType === 'image' ? (
        <img src={url} alt={resource.title} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
      ) : (
        <div style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 10, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          <FilePdfOutlined />
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{resource.title}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag color={TYPE_COLORS[resource.type]}>{TYPE_OPTIONS.find((t) => t.value === resource.type)?.label || resource.type}</Tag>
        {resource.bank?.name && <span style={{ fontSize: 12, color: '#64748b' }}>{resource.bank.name}</span>}
      </div>
      {resource.description && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{resource.description}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" icon={<EyeOutlined />} href={url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>View</Button>
        <Button size="small" icon={<DownloadOutlined />} href={url} download style={{ flex: 1 }}>Download</Button>
      </div>
    </Card>
  );
}

function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankFilter, setBankFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/resources')
      .then((res) => setResources(res.data))
      .finally(() => setLoading(false));
  }, []);

  const bankOptions = useMemo(() => {
    const seen = new Set();
    return resources
      .filter((r) => r.bank?._id && !seen.has(r.bank._id) && seen.add(r.bank._id))
      .map((r) => ({ value: r.bank._id, label: r.bank.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [resources]);

  const filtered = useMemo(() => resources.filter((r) => {
    if (bankFilter && r.bank?._id !== bankFilter) return false;
    if (typeFilter && r.type !== typeFilter) return false;
    return true;
  }), [resources, bankFilter, typeFilter]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Resources</Typography.Title>
        <Typography.Text type="secondary">Flyers, policy documents, and training material from your banks.</Typography.Text>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select allowClear placeholder="All Banks" value={bankFilter} onChange={setBankFilter} options={bankOptions} style={{ width: 200 }} />
        <Select allowClear placeholder="All Types" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} style={{ width: 200 }} />
      </div>

      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card style={{ borderRadius: 12 }}><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : filtered.length === 0 ? (
        <Empty description="No resources found" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((r) => (
            <Col key={r._id} xs={24} sm={12} lg={8}>
              <ResourceCard resource={r} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

export default Resources;
```

- [ ] **Step 2: Add the agent sidebar entry**

In `frontend/src/components/AppLayout.jsx`, the agent menu array (line 86) currently reads:
```jsx
    { key: '/agent/promotions',       icon: <GiftOutlined />,         label: <Link to="/agent/promotions">Promotion</Link> },
  ],
```
Change to:
```jsx
    { key: '/agent/promotions',       icon: <GiftOutlined />,         label: <Link to="/agent/promotions">Promotion</Link> },
    { key: '/agent/resources',        icon: <FolderOutlined />,       label: <Link to="/agent/resources">Resources</Link> },
  ],
```
(`FolderOutlined` is already imported by Task 3, Step 2.)

- [ ] **Step 3: Add the import and route**

In `frontend/src/App.jsx`, line 29 currently reads:
```jsx
import AgentPromotions from './pages/agent/Promotions';
import AgencyDashboard from './pages/agency/Dashboard';
```
Change to:
```jsx
import AgentPromotions from './pages/agent/Promotions';
import AgentResources from './pages/agent/Resources';
import AgencyDashboard from './pages/agency/Dashboard';
```

Then, lines 183-184 currently read:
```jsx
          <Route path="promotions" element={<AgentPromotions />} />
        </Route>
```
Change to:
```jsx
          <Route path="promotions" element={<AgentPromotions />} />
          <Route path="resources" element={<AgentResources />} />
        </Route>
```

- [ ] **Step 4: Verify — lint and build**

Run:
```bash
cd frontend && npx eslint src/pages/agent/Resources.jsx src/components/AppLayout.jsx src/App.jsx
```
Expected: no new errors.

Run: `cd frontend && npx vite build`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 5: Verify — manual walkthrough**

Against the running dev servers: log in as an agent whose agency is either unrestricted or on the allow-list of at least one resource created in Task 3's walkthrough — confirm "Resources" appears in the sidebar directly below "Promotion", confirm the resources created earlier show up (with correct thumbnail/PDF icon, bank, type), confirm the bank/type filters narrow the grid, confirm View opens the file in a new tab and Download downloads it. Log in as an agent from a *different* agency and confirm the agency-restricted resource from Task 3's walkthrough does **not** appear, while the unrestricted one still does.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/agent/Resources.jsx frontend/src/components/AppLayout.jsx frontend/src/App.jsx
git commit -m "Add agent Resources browsing page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
