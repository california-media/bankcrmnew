# Lead Notes Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an append-only comment thread to each lead, visible and postable by all four roles (admin, agency, agent, employee), with admin-only delete.

**Architecture:** Add a `leadNotes` subdocument array to the existing `Lead` mongoose schema. Two new controller actions (`addNote`, `deleteNote`) behind two new routes. Frontend renders a Notes card in `LeadDetail.jsx` below the Status History card, with an inline compose box.

**Tech Stack:** Node.js, Express, Mongoose, React, Ant Design (antd), Redux (for `user` from `state.auth`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/models/Lead.js` | Modify | Add `leadNotes` subdoc array |
| `backend/controllers/lead.controller.js` | Modify | Add `addNote`, `deleteNote`; update `getOne` populate |
| `backend/routes/lead.routes.js` | Modify | Register two new routes |
| `frontend/src/pages/leads/LeadDetail.jsx` | Modify | Notes card UI |

---

## Task 1: Add `leadNotes` to Lead schema

**Files:**
- Modify: `backend/models/Lead.js`

### Context

The `Lead` schema lives in `backend/models/Lead.js`. It already has a `statusHistory` array with a similar shape. Add `leadNotes` right after `statusHistory`.

- [ ] **Step 1: Open `backend/models/Lead.js` and add the `leadNotes` array after the `payoutHistory` block (around line 84)**

Replace the closing of the schema object:
```js
    payoutHistory: [
      {
        amount: { type: Number, required: true },
        sentAt: { type: Date, default: Date.now },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        month: { type: String },
        note: { type: String, trim: true },
        _id: false,
      },
    ],
    leadNotes: [
      {
        text: { type: String, required: true, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorRole: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
```

- [ ] **Step 2: Verify the server starts without errors**

```bash
cd backend && node -e "require('./models/Lead'); console.log('Schema OK')"
```

Expected output: `Schema OK`

- [ ] **Step 3: Commit**

```bash
git add backend/models/Lead.js
git commit -m "feat: add leadNotes subdoc array to Lead schema"
```

---

## Task 2: Add `addNote` controller and route

**Files:**
- Modify: `backend/controllers/lead.controller.js`
- Modify: `backend/routes/lead.routes.js`

### Context

`getOne` already applies per-role filters (agent sees own leads, agency sees own, employee sees assigned). The `addNote` handler reuses the same filter pattern so each role can only note leads they can access. After adding the note, return the updated lead populated the same way as `getOne`.

- [ ] **Step 1: Add `addNote` at the bottom of `backend/controllers/lead.controller.js`**

```js
/**
 * POST /api/leads/:id/notes  (all roles)
 */
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'text is required' });
    }

    const filter = { _id: req.params.id };
    if (req.user.role === 'agent')    filter.agent            = req.user._id;
    if (req.user.role === 'agency')   filter.agency           = req.user._id;
    if (req.user.role === 'employee') filter.assignedEmployee = req.user._id;

    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.leadNotes.push({
      text: String(text).trim(),
      author: req.user._id,
      authorRole: req.user.role,
    });
    await lead.save();

    const populated = await lead.populate([
      ...POPULATE_FIELDS,
      { path: 'leadNotes.author', select: 'name email' },
      { path: 'statusHistory.changedBy', select: 'name email' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Register the route in `backend/routes/lead.routes.js`**

Add after the `router.patch('/:id/engagement-status', ...)` line and before the agency section:

```js
// All roles — add note
router.post('/:id/notes', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.addNote);
```

- [ ] **Step 3: Start the backend and test with curl**

```bash
# First get a valid token — replace <TOKEN> and <LEAD_ID> with real values from your DB
curl -s -X POST http://localhost:5000/api/leads/<LEAD_ID>/notes \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test note from plan"}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const p=JSON.parse(d); console.log('notes count:', p.leadNotes?.length, 'last note:', p.leadNotes?.at(-1)?.text)"
```

Expected output: `notes count: 1  last note: Test note from plan`

- [ ] **Step 4: Test empty text is rejected**

```bash
curl -s -X POST http://localhost:5000/api/leads/<LEAD_ID>/notes \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"   "}' | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(JSON.parse(d).message))"
```

Expected output: `text is required`

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/lead.controller.js backend/routes/lead.routes.js
git commit -m "feat: add POST /leads/:id/notes endpoint (all roles)"
```

---

## Task 3: Add `deleteNote` controller and route

**Files:**
- Modify: `backend/controllers/lead.controller.js`
- Modify: `backend/routes/lead.routes.js`

- [ ] **Step 1: Add `deleteNote` at the bottom of `backend/controllers/lead.controller.js`**

```js
/**
 * DELETE /api/leads/:id/notes/:noteId  (admin only)
 */
exports.deleteNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const note = lead.leadNotes.id(req.params.noteId);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.deleteOne();
    await lead.save();

    const populated = await lead.populate([
      ...POPULATE_FIELDS,
      { path: 'leadNotes.author', select: 'name email' },
      { path: 'statusHistory.changedBy', select: 'name email' },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Register the route in `backend/routes/lead.routes.js`**

Add in the Admin section (after `router.patch('/:id/agent-commission', ...)`):

```js
router.delete('/:id/notes/:noteId', requireRole('admin'), ctrl.deleteNote);
```

- [ ] **Step 3: Test delete with curl**

```bash
# First add a note and capture its _id
NOTE_ID=$(curl -s -X POST http://localhost:5000/api/leads/<LEAD_ID>/notes \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"text":"note to delete"}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).leadNotes.at(-1)._id)")

# Now delete it
curl -s -X DELETE "http://localhost:5000/api/leads/<LEAD_ID>/notes/$NOTE_ID" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d);console.log('notes remaining:', p.leadNotes?.length)"
```

Expected: `notes remaining: <previous count>`  (one fewer than before)

- [ ] **Step 4: Verify non-admin cannot delete**

```bash
curl -s -X DELETE "http://localhost:5000/api/leads/<LEAD_ID>/notes/<NOTE_ID>" \
  -H "Authorization: Bearer <AGENT_TOKEN>" | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(JSON.parse(d).message))"
```

Expected output: `Forbidden` (or similar 403 message from `requireRole`)

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/lead.controller.js backend/routes/lead.routes.js
git commit -m "feat: add DELETE /leads/:id/notes/:noteId endpoint (admin only)"
```

---

## Task 4: Update `getOne` to populate `leadNotes.author`

**Files:**
- Modify: `backend/controllers/lead.controller.js`

### Context

`getOne` (line ~504) currently populates `statusHistory.changedBy` and `payoutHistory.sentBy`. Add `leadNotes.author` to the same populate call so the frontend gets author name/email.

- [ ] **Step 1: Find the `getOne` populate call in `backend/controllers/lead.controller.js` (around line 510–518) and add `leadNotes.author`**

```js
    const lead = await Lead.findOne(filter)
      .populate('bank', 'name code')
      .populate('agency', 'name email')
      .populate('agent', 'name email phone')
      .populate('cardProduct', 'name cardType commissionBrackets')
      .populate('loanProduct', 'name loanCategory commissionBrackets')
      .populate('assignedEmployee', 'name email')
      .populate('payoutHistory.sentBy', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .populate('leadNotes.author', 'name email');
```

- [ ] **Step 2: Verify with curl that `getOne` returns notes with author populated**

```bash
curl -s http://localhost:5000/api/leads/<LEAD_ID> \
  -H "Authorization: Bearer <TOKEN>" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d);console.log('notes:', JSON.stringify(p.leadNotes, null, 2))"
```

Expected: each note has `author: { _id, name, email }` not just an ObjectId.

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/lead.controller.js
git commit -m "feat: populate leadNotes.author in getOne"
```

---

## Task 5: Frontend — Notes card in LeadDetail

**Files:**
- Modify: `frontend/src/pages/leads/LeadDetail.jsx`

### Context

`LeadDetail.jsx` already imports: `Card, Col, Row, Typography, Tag, Space, Button, Descriptions, Skeleton, Timeline, Divider, message, Modal, Form, InputNumber, Input` from `antd`. Add `DeleteOutlined` to the icon imports (already has `ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined, FileOutlined`). The `user` from Redux (`useSelector`) is already available as `role = user.role` and `user` itself.

State needed:
- `noteText` — controlled textarea value
- `noteSubmitting` — loading state for submit button

- [ ] **Step 1: Add `DeleteOutlined` to the antd icons import**

Find:
```js
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined, FileOutlined,
} from '@ant-design/icons';
```

Replace with:
```js
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileOutlined,
} from '@ant-design/icons';
```

- [ ] **Step 2: Add note state variables after the existing state declarations (around line 47)**

Find:
```js
  const [statusSaving, setStatusSaving] = useState(false);
```

Add after it:
```js
  const [noteText, setNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
```

- [ ] **Step 3: Add `addNote` and `deleteNote` handler functions after the `saveLoanAmount` function (around line 94)**

```js
  const addNote = async () => {
    if (!noteText.trim()) return;
    setNoteSubmitting(true);
    try {
      const { data } = await api.post(`/leads/${id}/notes`, { text: noteText.trim() });
      setLead(data);
      setNoteText('');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      const { data } = await api.delete(`/leads/${id}/notes/${noteId}`);
      setLead(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete note');
    }
  };
```

- [ ] **Step 4: Add the Notes card to the left column JSX**

Find the closing of the Status History card block:
```js
          )}

          {/* Payout history */}
```

Insert the Notes card between them:
```js
          )}

          {/* Notes */}
          <Card title="Notes" style={{ marginBottom: 16 }}>
            {lead.leadNotes?.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                {lead.leadNotes.map((n) => (
                  <div
                    key={n._id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: '#f9f9f6',
                      marginBottom: 8,
                      position: 'relative',
                    }}
                  >
                    <Space size={6} style={{ marginBottom: 4 }}>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {n.author?.name || n.author?.email || 'Unknown'}
                      </Typography.Text>
                      <Tag style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                        {n.authorRole}
                      </Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </Typography.Text>
                    </Space>
                    <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    {role === 'admin' && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => deleteNote(n._id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                No notes yet.
              </Typography.Text>
            )}
            <Input.TextArea
              rows={3}
              placeholder="Add a note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Button
              type="primary"
              loading={noteSubmitting}
              disabled={!noteText.trim()}
              onClick={addNote}
            >
              Add Note
            </Button>
          </Card>

          {/* Payout history */}
```

- [ ] **Step 5: Start frontend dev server and manually test**

```bash
cd frontend && npm run dev
```

Open a lead detail page as each role and verify:
1. **All roles** — Notes card visible, textarea present, "Add Note" button disabled when empty
2. **Post a note** — note appears immediately with author name, role badge, timestamp
3. **Admin** — trash icon visible per note; clicking removes it instantly
4. **Non-admin** — no trash icon visible
5. **Empty submit** — button stays disabled (no request sent)
6. **Multi-role visibility** — note added by agency is visible when logged in as agent on same lead

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/leads/LeadDetail.jsx
git commit -m "feat: add notes thread card to LeadDetail for all roles"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** all roles can add ✓ | all roles view ✓ | admin delete ✓ | author name + role + timestamp ✓ | append-only ✓
- [x] **Placeholders:** none — all steps have concrete code or commands
- [x] **Type consistency:** `leadNotes`, `addNote`, `deleteNote` naming consistent across all tasks
- [x] **Route order:** `/:id/notes` added before `/:id` catch-all — no shadowing issue
- [x] **`note.deleteOne()`** — Mongoose 7+ subdoc removal API (replaces deprecated `note.remove()`)
