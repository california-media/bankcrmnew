# Agent Resources Library — Design

## Problem

Agents need a place to get bank product materials — card/loan flyers,
policy documents, training decks, benefits & features sheets — without
asking the agency or admin each time. Admin needs a way to upload and
manage this material centrally, optionally restricted to specific
agencies (some material may be agency-specific or under NDA with a
particular partner).

## Scope

- New "Resources" tab in the **Agent portal only**, placed directly
  below "Promotions" in the sidebar. Not added to Admin/Agency/Employee
  portals' own navigation (admin manages resources from a dedicated
  admin page, but that page lives under the existing Admin portal
  structure, not a new agent-facing nav entry elsewhere).
- Content types: **images and PDFs only** (client-confirmed). No video,
  no Office documents (pptx/docx) in this iteration.
- Grouping: by **bank** (optional — not every document is bank-specific)
  and by **type** — a fixed enum (`flyer`, `policy`, `training`,
  `other`) rather than a free-form/manageable category list. This
  folds the client's "category" mention into `type`, since the
  described set ("policy documents etc and cards flyers benefits
  features") is a small, fixed vocabulary, not something that needs
  its own CRUD surface. (Flagged to the user during design; no
  objection raised.)
- Visibility: **restricted to specific agencies**, reusing the
  `assignedAgencies` pattern already used on `Bank`/`CardProduct`/
  `LoanProduct`/`AccountProduct` — empty/absent = visible to every
  agency (default), non-empty = only the listed agencies.
- Upload/manage: **admin only**. Agents are read-only (view/download).

## Data model

New file `backend/models/Resource.js`:

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

`fileType` is derived server-side from the uploaded file's extension at
create/update time (not client-supplied), so the agent-side UI knows
whether to render an image thumbnail or a PDF icon without re-deriving
it from the filename on every render.

## Backend

**Upload middleware** (`backend/middleware/upload.middleware.js`) — one
new line, same pattern as `leadDocuments`
(`backend/middleware/upload.middleware.js:65`):

```js
module.exports.resources = makeUpload('resources', ['jpeg', 'jpg', 'png', 'pdf']);
```

**Controller** (`backend/controllers/resource.controller.js`, new):

- `exports.list` — for `admin`: returns everything. For `agency`/
  `employee`/`agent`: applies the same `assignedAgencies` `$or` filter
  copied verbatim from `backend/controllers/cardProduct.controller.js:20-38`
  (including the `resolveAgencyId`-for-employee / `req.user._id`-for-agency
  / `req.user.agency`-for-agent role branching), plus `isActive: true`
  for non-admin callers (admin sees inactive ones too, for management).
  Populates `bank` with `name code logo`.
- `exports.create` — admin only. Reads `req.file` via
  `upload.resources.single('file')`, derives `fileType` from the
  extension (`/\.(jpe?g|png)$/i` → `'image'`, else `'pdf'`), saves.
- `exports.update` — admin only. Same shape as
  `cardProduct.controller.js`'s `update`: if a new `req.file` is
  present, delete the old file from S3 (`deleteFromS3('resources', ...)`)
  and replace; otherwise only the other fields change.
- `exports.remove` — admin only. Deletes the S3 file, then the
  document.

**Routes** (`backend/routes/resource.routes.js`, new):

```js
router.use(protect);
router.get('/', ctrl.list); // all authenticated roles, filtered inside the controller
router.post('/', requireRole('admin'), upload.resources.single('file'), ctrl.create);
router.put('/:id', requireRole('admin'), upload.resources.single('file'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);
```

Mounted in `backend/server.js` as `app.use('/api/resources', require('./routes/resource.routes'))`.

## Frontend

**Admin page** (`frontend/src/pages/admin/Resources.jsx`, new) — same
skeleton as `frontend/src/pages/admin/FeaturedProducts.jsx` (table +
Add/Edit modal, `FormData`-based multipart submit), minus the drag-to-
reorder (`@dnd-kit`) machinery, which isn't needed here:

- Table columns: title, bank, type (tag), restricted-to-agencies
  indicator (badge/count, or "All agencies" when empty), active toggle,
  edit/delete actions.
- Add/Edit modal fields: title, description, bank `Select` (options
  from `GET /banks`), type `Select` (the 4-value enum), file `Upload`
  (`accept=".jpg,.jpeg,.png,.pdf"`, single file, picture-card style
  like `CardProducts.jsx`), and the agency-restriction multi-select
  copied verbatim from `frontend/src/pages/admin/CardProducts.jsx:500-513`.

**Agent page** (`frontend/src/pages/agent/Resources.jsx`, new):

- Fetches `GET /resources` (already filtered server-side to what this
  agent's agency can see).
- Filter bar: bank `Select`, type `Select` (same 4 values + "All").
- Grid of cards: image thumbnail (if `fileType === 'image'`) or a PDF
  icon tile (if `fileType === 'pdf'`), title, bank name/logo if set,
  type tag, and a "View" (opens in new tab) / "Download" action —
  same `UPLOADS_BASE`/S3-URL pattern used everywhere else in this app
  (e.g. `${UPLOADS_BASE}/resources/${filename}`).

**Nav** (`frontend/src/components/AppLayout.jsx`):
- New entry in `menusByRole.agent`, directly after the Promotions entry
  (line 86): `{ key: '/agent/resources', icon: <FolderOutlined />, label: <Link to="/agent/resources">Resources</Link> }`
  (icon to be confirmed unused at implementation time — `FolderOutlined`
  is the working assumption).
- Admin gets no new *sidebar* entry beyond what already exists for
  managing other catalog-style content (Card Products, Loan Products,
  etc. already live under an existing admin nav section) — the admin
  Resources page is reached the same way those are; exact placement in
  the admin nav tree is an implementation detail to match whatever
  section those other catalog pages already sit under, not a new
  top-level item.

**Routes** (`frontend/src/App.jsx`): `<Route path="resources"
element={<AgentResources />} />` inside the `/agent` route block, and
an equivalent admin route inside the `/admin` block, following the
exact pattern already used for `promotions` (lines ~149, ~183).

## Error handling

| Case | Response |
|---|---|
| Non-admin attempts create/update/delete | 403 (`requireRole('admin')`) |
| Upload a disallowed file type | 400 (multer `fileFilter` rejection, same as `leadDocuments`) |
| Agent requests a resource not visible to their agency | Excluded server-side from `list` — never reaches the agent, not a 403 on a specific item (no single-resource GET endpoint is needed for this feature) |

## Testing

Manual, no automated test suite exists for this area today (consistent
with the rest of this codebase):

- As admin: create a resource with an image, one with a PDF, one
  restricted to a specific agency, one left unrestricted. Edit one
  (replace its file, confirm the old S3 file is deleted). Delete one.
- As an agent in the restricted agency: confirm the restricted resource
  is visible.
- As an agent in a different agency: confirm the restricted resource is
  **not** visible, but unrestricted ones are.
- Confirm the bank/type filters on the agent page narrow the grid
  correctly.
- Confirm image resources render a thumbnail and PDF resources render
  a PDF-style tile, and both "View"/"Download" actually open the
  correct file.
