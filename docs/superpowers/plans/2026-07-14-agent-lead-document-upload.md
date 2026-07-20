# Agent Lead Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents attach supporting documents to a lead — at submission time and later from Lead Detail — visible to every role that can view the lead.

**Architecture:** One new S3-backed upload endpoint (`POST /api/leads/:id/documents`, agent-only, scoped to the requesting agent's own lead) appends to a new `documents` array on the `Lead` model. Two frontend touch points call it: the submit-lead form (right after creating the lead) and the Lead Detail page (add-later, agent-only control; read-only list for everyone else).

**Tech Stack:** Express + Mongoose (backend), multer + multer-s3 (existing upload pattern), React + antd (frontend).

## Global Constraints

- Up to 5 files per upload call, `jpeg|jpg|png|pdf` only, 10MB each — reuse `makeUpload()` in `backend/middleware/upload.middleware.js`, same as `cardImages`/`bankLogos`.
- No document types/labels — generic attachment, no delete/replace capability (not in scope).
- Only the owning agent may upload; a request for a lead not owned by `req.user._id` returns 404 (matches existing agent-scoped endpoints like `updateEngagementStatus`).
- No test framework exists anywhere in this repo (`backend/package.json` and `frontend/package.json` have no `test` script; no `*.test.js`/`*.spec.js` files exist). Do not introduce one for this feature — verify each task manually via `curl` (backend) and the running dev app (frontend), consistent with how the rest of this codebase is verified.

---

## File Structure

- Modify: `backend/models/Lead.js` — add `documents` array field.
- Modify: `backend/middleware/upload.middleware.js` — add `leadDocuments` upload config.
- Modify: `backend/controllers/lead.controller.js` — add `exports.addDocuments`.
- Modify: `backend/routes/lead.routes.js` — wire the new route.
- Modify: `frontend/src/pages/agent/SubmitLead.jsx` — add file picker + post-create upload call.
- Modify: `frontend/src/pages/leads/LeadDetail.jsx` — add "Documents" card (list + agent-only add control).

---

### Task 1: Data model + upload middleware

**Files:**
- Modify: `backend/models/Lead.js:82-86` (insert after `disbursementReceiptAt`, before `statusHistory`)
- Modify: `backend/middleware/upload.middleware.js:47-51` (add alongside `cardImages`/`bankLogos`)

**Interfaces:**
- Produces: `Lead.documents` — array of `{ filename: String, originalName: String, uploadedAt: Date }`, each entry `_id: false`.
- Produces: `upload.leadDocuments` — a multer instance (`.array('documents', 5)` used by the route in Task 2), storing to S3 subdir `lead-documents`, allowed ext `jpeg|jpg|png|pdf`, 10MB limit.

- [ ] **Step 1: Add the `documents` field to the Lead schema**

In `backend/models/Lead.js`, insert immediately after the `disbursementReceiptAt` line (currently line 85) and before the `statusHistory:` line (currently line 86):

```js
    documents: [
      {
        filename: { type: String, trim: true },
        originalName: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
```

- [ ] **Step 2: Add the `leadDocuments` upload config**

In `backend/middleware/upload.middleware.js`, change:

```js
module.exports                    = makeUpload('receipts',             ['jpeg', 'jpg', 'png', 'pdf']);
module.exports.cardImages         = makeUpload('card-images',          ['jpeg', 'jpg', 'png', 'webp', 'svg', 'avif']);
module.exports.bankLogos          = makeUpload('bank-logos',           ['jpeg', 'jpg', 'png', 'webp', 'svg']);
module.exports.blogImages         = makeUpload('blog-images',          ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.blogCategoryImages = makeUpload('blog-category-images', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
```

to:

```js
module.exports                    = makeUpload('receipts',             ['jpeg', 'jpg', 'png', 'pdf']);
module.exports.cardImages         = makeUpload('card-images',          ['jpeg', 'jpg', 'png', 'webp', 'svg', 'avif']);
module.exports.bankLogos          = makeUpload('bank-logos',           ['jpeg', 'jpg', 'png', 'webp', 'svg']);
module.exports.blogImages         = makeUpload('blog-images',          ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.blogCategoryImages = makeUpload('blog-category-images', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.leadDocuments      = makeUpload('lead-documents',       ['jpeg', 'jpg', 'png', 'pdf']);
```

- [ ] **Step 3: Verify the model loads without syntax errors**

Run: `cd "backend" && node -e "require('./models/Lead'); console.log('OK')"`
Expected: `OK` printed, no exceptions.

- [ ] **Step 4: Verify the upload middleware loads**

Run: `cd "backend" && node -e "const u = require('./middleware/upload.middleware'); console.log(typeof u.leadDocuments.array)"`
Expected: `function` printed.

- [ ] **Step 5: Commit**

```bash
git add backend/models/Lead.js backend/middleware/upload.middleware.js
git commit -m "$(cat <<'EOF'
Add documents field to Lead model and lead-documents upload config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `addDocuments` controller + route

**Files:**
- Modify: `backend/controllers/lead.controller.js` (add new export; place near `updateEngagementStatus`, e.g. after line 999)
- Modify: `backend/routes/lead.routes.js:15` (add in the Agent section, after `completeReferral`)

**Interfaces:**
- Consumes: `getFilename(file)` from `backend/middleware/upload.middleware.js` (already imported in `lead.controller.js:10`).
- Consumes: `upload.leadDocuments` from Task 1.
- Produces: `exports.addDocuments` — `POST /api/leads/:id/documents`, agent-only, responds `200 { documents: [...] }` (the full updated array) or `404`/`400`.

- [ ] **Step 1: Add the controller function**

In `backend/controllers/lead.controller.js`, add after the `updateEngagementStatus` function (after its closing `};` around line 999):

```js
/**
 * POST /api/leads/:id/documents  (agent, own lead only)
 * Appends uploaded files to the lead's documents array.
 */
exports.addDocuments = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: 'At least one document is required' });
    }

    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const entries = files.map((f) => ({
      filename: getFilename(f),
      originalName: f.originalname,
    }));
    lead.documents.push(...entries);
    await lead.save();

    res.json({ documents: lead.documents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 2: Wire the route**

In `backend/routes/lead.routes.js`, the Agent section currently reads:

```js
// Agent
router.post('/', requireRole('agent'), ctrl.create);
router.get('/mine', requireRole('agent'), ctrl.listMine);
router.get('/stats', requireRole('agent'), ctrl.stats);
router.get('/ledger', requireRole('agent'), ctrl.myLedger);
router.delete('/:id', requireRole('agent'), ctrl.removeDraft);
router.patch('/:id/engagement-status', requireRole('agent'), ctrl.updateEngagementStatus);
router.patch('/:id/complete-referral', requireRole('agent'), ctrl.completeReferral);
```

Add one line after `completeReferral`:

```js
// Agent
router.post('/', requireRole('agent'), ctrl.create);
router.get('/mine', requireRole('agent'), ctrl.listMine);
router.get('/stats', requireRole('agent'), ctrl.stats);
router.get('/ledger', requireRole('agent'), ctrl.myLedger);
router.delete('/:id', requireRole('agent'), ctrl.removeDraft);
router.patch('/:id/engagement-status', requireRole('agent'), ctrl.updateEngagementStatus);
router.patch('/:id/complete-referral', requireRole('agent'), ctrl.completeReferral);
router.post('/:id/documents', requireRole('agent'), upload.leadDocuments.array('documents', 5), ctrl.addDocuments);
```

(`upload` is already imported at the top of this file as `const upload = require('../middleware/upload.middleware');`.)

- [ ] **Step 3: Start the backend**

Run: `cd "backend" && npm run dev`
Expected: server starts on the configured `PORT` with no errors (leave running in this terminal / background it for the next steps).

- [ ] **Step 4: Verify role enforcement — no auth token**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/leads/000000000000000000000000/documents`
Expected: `401` (blocked by `protect` middleware before reaching the route).

- [ ] **Step 5: Verify the endpoint accepts a file for the agent's own lead**

Log in as an agent via the running frontend (or `POST /api/auth/login`) to get a JWT, pick a real lead `_id` that belongs to that agent (e.g. from `GET /api/leads/mine`), then:

```bash
TOKEN="<paste agent JWT>"
LEAD_ID="<paste a lead id owned by that agent>"
curl -s -w "\n%{http_code}\n" -X POST "http://localhost:8000/api/leads/$LEAD_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "documents=@/etc/hosts;type=text/plain;filename=test.pdf"
```

Expected: `200` with a JSON body containing a `documents` array with one new entry (`filename`, `originalName: "test.pdf"`, `uploadedAt`).

- [ ] **Step 6: Verify 404 for a lead not owned by the requesting agent**

Repeat Step 5's request with a `LEAD_ID` belonging to a *different* agent (or an agency/admin account's lead).
Expected: `404 { "message": "Lead not found" }`.

- [ ] **Step 7: Verify 400 when no files are attached**

```bash
curl -s -w "\n%{http_code}\n" -X POST "http://localhost:8000/api/leads/$LEAD_ID/documents" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `400 { "message": "At least one document is required" }`.

- [ ] **Step 8: Commit**

```bash
git add backend/controllers/lead.controller.js backend/routes/lead.routes.js
git commit -m "$(cat <<'EOF'
Add POST /api/leads/:id/documents endpoint for agent uploads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Submit-lead file picker

**Files:**
- Modify: `frontend/src/pages/agent/SubmitLead.jsx` (imports near top; JSX in the Client Information section around line 253; submit handler around lines 213-216)

**Interfaces:**
- Consumes: `api` client from `../../api/client` (already imported).
- Consumes: `POST /leads/:id/documents` from Task 2 — `FormData` with one or more `documents` fields, `Content-Type: multipart/form-data`.

- [ ] **Step 1: Read the current submit handler and imports for exact context**

Run: `grep -n "^import\|useState(\[\]\|api.post('/leads'" "frontend/src/pages/agent/SubmitLead.jsx"`
(Confirms the exact current import list and existing `useState` calls before editing, since line numbers may have drifted from earlier tasks in this session.)

- [ ] **Step 2: Add upload state and the `Upload`/`UploadOutlined` imports**

If `Upload` is not already imported from `antd` in this file, add it to the existing antd import line. If `UploadOutlined` is not already imported from `@ant-design/icons`, add it there too.

Add a new state near the other form state (alongside wherever `receiptFileList`-style state would go, or right after the form's other `useState` declarations):

```js
  const [docFileList, setDocFileList] = useState([]);
```

- [ ] **Step 3: Add the file picker to the Client Information section**

In the Client Information `Row` (the block containing the `customerName` field from the earlier "Full Name (as per Emirates ID)" edit), add a new `Col` after the existing fields in that section:

```jsx
                <Col xs={24}>
                  <Form.Item label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Documents (optional)</span>} style={{ marginBottom: 10 }}>
                    <Upload
                      multiple
                      fileList={docFileList}
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setDocFileList(fileList.slice(-5))}
                      accept=".jpg,.jpeg,.png,.pdf"
                      maxCount={5}
                    >
                      <Button icon={<UploadOutlined />}>Attach Files</Button>
                    </Upload>
                  </Form.Item>
                </Col>
```

- [ ] **Step 4: Upload the files after lead creation in the submit handler**

The current submit handler reads:

```js
      const { data: lead } = await api.post('/leads', payload);
      await api.post(`/leads/${lead._id}/send-to-agency`);

      navigate('/agent/leads');
```

Change it to:

```js
      const { data: lead } = await api.post('/leads', payload);
      await api.post(`/leads/${lead._id}/send-to-agency`);

      if (docFileList.length) {
        try {
          const formData = new FormData();
          docFileList.forEach((f) => {
            if (f.originFileObj) formData.append('documents', f.originFileObj);
          });
          await api.post(`/leads/${lead._id}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (docErr) {
          message.warning('Lead submitted, but documents failed to upload. Add them from the lead detail page.');
        }
      }

      navigate('/agent/leads');
```

(If `message` from `antd` isn't already imported in this file, add it to the antd import line — check with the same grep from Step 1 first.)

- [ ] **Step 5: Manual verification**

Run: `cd "frontend" && npm run dev` (skip if already running)

In the browser: log in as an agent, go to Submit Lead, fill the required fields, attach 2 files (one jpg, one pdf) via "Attach Files", submit.
Expected: navigates to `/agent/leads` with no error toast. Then open the newly created lead's detail page (URL, or via the list) and confirm via `curl` that the documents were saved:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/leads/$LEAD_ID | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).documents))"
```

Expected: an array with 2 entries.

- [ ] **Step 6: Verify submit still works with zero files attached**

Repeat the browser submission without attaching any file.
Expected: lead still creates successfully, no error, `documents` on that lead is `[]`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/agent/SubmitLead.jsx
git commit -m "$(cat <<'EOF'
Let agents attach documents when submitting a lead

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Lead Detail "Documents" card

**Files:**
- Modify: `frontend/src/pages/leads/LeadDetail.jsx` (near the existing Commission `Card` block, around line 821-862; imports near top)

**Interfaces:**
- Consumes: `lead.documents` (array of `{ filename, originalName, uploadedAt }`) from the lead object already loaded on this page.
- Consumes: `UPLOADS_BASE` (already defined in this file, used for the receipt link pattern — same constant used in `agency/Payouts.jsx`).
- Consumes: `role` and `lead.agent` (already available on this page — used by the existing `role === 'agency'` / `role === 'agent'` branches in the Commission card) to decide whether to show the upload control.
- Consumes: `POST /leads/:id/documents` from Task 2.

- [ ] **Step 1: Confirm how `UPLOADS_BASE`, `role`, and the current agent's id are available on this page**

Run: `grep -n "UPLOADS_BASE\|const role\|user\._id\|useSelector" "frontend/src/pages/leads/LeadDetail.jsx"`

Use whatever variable names this grep reveals (they were already established by the existing Commission card logic at lines 821-862 — do not invent new ones).

- [ ] **Step 2: Add a `docUploading` state and a reusable file-select handler**

Near the top of the component (alongside other `useState` calls), add:

```js
  const [docFileList, setDocFileList] = useState([]);
  const [docUploading, setDocUploading] = useState(false);

  const uploadDocuments = async () => {
    if (!docFileList.length) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      docFileList.forEach((f) => { if (f.originFileObj) formData.append('documents', f.originFileObj); });
      const { data } = await api.post(`/leads/${lead._id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLead((prev) => ({ ...prev, documents: data.documents }));
      setDocFileList([]);
      message.success('Document(s) added');
    } catch (err) {
      message.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setDocUploading(false);
    }
  };
```

(Match this to the page's actual state-setter name for the lead object — it may be `setLead` or something else; use whatever `grep -n "useState" frontend/src/pages/leads/LeadDetail.jsx` shows for the lead state. `api` and `message` are already imported on this page, per the existing note/status-update logic.)

- [ ] **Step 3: Add the Documents card**

Immediately after the closing `</Card>` of the Commission section (after line 862, i.e. right before the `</Col>` / `</Row>` at lines 864-865), add:

```jsx
          <Card size="small" style={cardStyle} styles={{ body: cardBodyStyle }}>
            <div style={{ marginBottom: 10 }}>{sectionLabel('Documents')}</div>
            {lead.documents?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {lead.documents.map((d, i) => (
                  <a
                    key={d.filename + i}
                    href={`${UPLOADS_BASE}/lead-documents/${d.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <PaperClipOutlined /> {d.originalName || d.filename}
                  </a>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>No documents attached</Typography.Text>
            )}
            {role === 'agent' && String(lead.agent?._id || lead.agent) === String(user._id) && (
              <div style={{ marginTop: 10 }}>
                <Upload
                  multiple
                  fileList={docFileList}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setDocFileList(fileList.slice(-5))}
                  accept=".jpg,.jpeg,.png,.pdf"
                  maxCount={5}
                >
                  <Button size="small" icon={<UploadOutlined />}>Select Files</Button>
                </Upload>
                {docFileList.length > 0 && (
                  <Button size="small" type="primary" loading={docUploading} onClick={uploadDocuments} style={{ marginTop: 8 }}>
                    Upload {docFileList.length} file{docFileList.length !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            )}
          </Card>
```

(`PaperClipOutlined` must be imported from `@ant-design/icons` — check the existing icon import line with `grep -n "@ant-design/icons" frontend/src/pages/leads/LeadDetail.jsx` first and add it if missing, alongside `Upload`/`UploadOutlined` from `antd`/`@ant-design/icons` as in Task 3. `user` must reference whatever this page already uses to know the logged-in user's id — check via the Step 1 grep; if the page doesn't already have it, pull it from the same redux slice `SubmitLead.jsx`/`Payouts.jsx` use, e.g. `useSelector((s) => s.auth.user)`.)

- [ ] **Step 4: Manual verification — viewer roles**

With the frontend running, open the same lead (the one from Task 3's manual test, which has 2 documents) as:
- The owning agent → Documents card shows both files as clickable links, plus a "Select Files" control.
- Admin → Documents card shows both files as clickable links, no upload control.
- The lead's agency → same as admin.
- A different agent (not the owner, if reachable via a shared/assigned view) → confirm no upload control appears (the `role === 'agent' && lead.agent match` check should exclude them; if this role can't reach this lead's detail at all per existing `getOne` scoping, this check is moot — just confirm no crash).

Click a document link in each case.
Expected: opens the file in a new tab (or downloads it) successfully.

- [ ] **Step 5: Manual verification — add-later flow**

As the owning agent, use "Select Files" to pick one more file, click "Upload 1 file".
Expected: success toast, the new file appears in the list above without a page reload, `docFileList` clears.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/leads/LeadDetail.jsx
git commit -m "$(cat <<'EOF'
Show lead documents on Lead Detail, let owning agent add more

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
