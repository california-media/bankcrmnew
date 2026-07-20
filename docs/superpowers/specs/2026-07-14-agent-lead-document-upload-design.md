# Agent Lead Document Upload

## Problem

Agents have no way to attach supporting documents (KYC files, etc.) to a lead. Lead submission and Lead Detail have zero document-upload capability today — the only existing file upload on `Lead` is `disbursementReceiptFile`, which is agency/admin-only and unrelated.

## Scope

- Generic multi-file attachment — no fixed document types/labels, agent just attaches files.
- Optional — lead can be submitted with zero files.
- Files can be attached both at lead-submission time and later from the Lead Detail page.
- Visible to every role that can already view the lead (admin, agency, employee, agent).
- Only the owning agent can upload; other roles are read-only viewers.
- Limits: up to 5 files per upload call, jpg/jpeg/png/pdf, 10MB each — matches the existing receipt-upload pattern (`backend/middleware/upload.middleware.js`).
- No delete/replace capability (not requested — can be added later if needed).

## Data model

`backend/models/Lead.js` — new field:

```js
documents: [{
  filename: { type: String, trim: true },      // S3 object key basename, from getFilename()
  originalName: { type: String, trim: true },   // original upload filename, for display
  uploadedAt: { type: Date, default: Date.now },
}]
```

No `uploadedBy` — only the owning agent ever uploads, so it's implicit.

## Backend

- `backend/middleware/upload.middleware.js`: add `module.exports.leadDocuments = makeUpload('lead-documents', ['jpeg', 'jpg', 'png', 'pdf'])`, following the exact pattern of `cardImages`/`bankLogos`.
- `backend/controllers/lead.controller.js`: new `exports.addDocuments`:
  - Find `Lead.findOne({ _id: req.params.id, agent: req.user._id })` (any lead status — no restriction).
  - 404 if not found (covers "not yours" and "doesn't exist").
  - 400 if no files in `req.files`.
  - Push `{ filename: getFilename(f), originalName: f.originalname }` for each file, save, respond with the updated lead's `documents` array.
- `backend/routes/lead.routes.js`: add in the Agent section:
  ```js
  router.post('/:id/documents', requireRole('agent'), upload.leadDocuments.array('documents', 5), ctrl.addDocuments);
  ```
  One endpoint serves both "attach at submit" and "add later" — no need to make the `POST /leads` creation endpoint multipart.

No changes needed to `getOne` / `listForAgency` / `listAll` — they already `.toObject()`/return the full lead document, so `documents` rides along automatically once it's a schema field.

## Frontend

- `frontend/src/pages/agent/SubmitLead.jsx`:
  - Add an optional multi-file `Upload` control (antd, `beforeUpload={() => false}`, `maxCount={5}`, `accept=".jpg,.jpeg,.png,.pdf"`) in the Client Information section.
  - On submit: create the lead (JSON, as today) → `send-to-agency` (as today) → if files were selected, `POST` them as `FormData` to `/leads/:id/documents`. A failure at this last step should not block navigation — show a toast warning but still navigate to `/agent/leads` (the lead itself was already created successfully).
- `frontend/src/pages/leads/LeadDetail.jsx`:
  - New "Documents" card: lists `originalName` with a view/download link built from `UPLOADS_BASE` + `lead-documents/` + `filename`, for all roles.
  - If `role === 'agent'` and the lead belongs to the logged-in agent, also render an "Add Document" upload button in this card, posting to the same endpoint and refreshing local lead state on success.

## Error handling

- Wrong role / not the owning agent → 404 (consistent with other agent-scoped lead endpoints in this file, e.g. `updateEngagementStatus`).
- No files attached to the request → 400 `"At least one document is required"`.
- Upload middleware's existing `fileFilter` already rejects disallowed extensions/mimetypes with a 400-ish multer error — no new validation needed beyond that.

## Testing

- Manual: submit a lead as agent with 0, 1, and 5 files attached; confirm Lead Detail shows them for agent, agency, admin, and employee views.
- Manual: from Lead Detail as the owning agent, add a document after submission; confirm it appears without a page reload.
- Manual: confirm a different agent (not the lead's owner) gets 404 hitting the endpoint directly.
