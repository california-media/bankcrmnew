# Lead Notes Thread — Design Spec

**Date:** 2026-05-11  
**Status:** Approved

---

## Summary

Append-only comment thread on each lead. All four roles (admin, agency, agent, employee) can add notes. All roles can read notes. Only admin can delete a note.

---

## Data Model

Add `leadNotes` subdocument array to existing `Lead` schema in `backend/models/Lead.js`:

```js
leadNotes: [
  {
    text:       { type: String, required: true, trim: true },
    author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, required: true },
    createdAt:  { type: Date, default: Date.now },
    // _id kept (default true) so admin can target notes for deletion
  },
]
```

Existing `notes: String` field (agent creation note) is unchanged.

---

## API

### POST `/api/leads/:id/notes`

**Auth:** all roles (admin, agency, agent, employee)  
**Access scope:** same per-role filter as `getOne` — agent can only note their own leads, agency their leads, employee their assigned leads.  
**Body:** `{ text: string }`  
**Action:** push `{ text, author: req.user._id, authorRole: req.user.role, createdAt: now }` into `leadNotes`, save.  
**Response:** updated lead (populated).

### DELETE `/api/leads/:id/notes/:noteId`

**Auth:** admin only  
**Action:** pull subdocument by `_id` from `leadNotes`, save.  
**Response:** updated lead (populated).

---

## Backend Changes

| File | Change |
|------|--------|
| `backend/models/Lead.js` | Add `leadNotes` array |
| `backend/controllers/lead.controller.js` | Add `addNote`, `deleteNote` handlers; populate `leadNotes.author` in `getOne` |
| `backend/routes/lead.routes.js` | Add two routes |

---

## Frontend Changes

**File:** `frontend/src/pages/leads/LeadDetail.jsx`

New "Notes" `<Card>` added in the left column, below the Status History card. Visible to all roles.

**Card layout:**
- If no notes: `<Typography.Text type="secondary">No notes yet.</Typography.Text>`
- Each note renders:
  - Author name + role badge (e.g. `<Tag>Agency</Tag>`)
  - Note text
  - Timestamp (locale string)
  - Trash icon button visible only to admin — calls `DELETE /leads/:id/notes/:noteId`, refreshes lead
- Below the list: `<Input.TextArea>` + "Add Note" `<Button>` for all roles
  - On submit: calls `POST /leads/:id/notes`, clears textarea, refreshes lead

---

## Access Control Summary

| Role | Add note | View notes | Delete note |
|------|----------|------------|-------------|
| admin | ✓ | ✓ | ✓ |
| agency | ✓ | ✓ | ✗ |
| agent | ✓ | ✓ | ✗ |
| employee | ✓ | ✓ | ✗ |

---

## Out of Scope

- Editing posted notes (none — append-only)
- Notifications on new note
- Note pagination (CRM volume doesn't warrant it)
