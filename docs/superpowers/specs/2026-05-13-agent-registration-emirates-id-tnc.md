# Agent Registration — Emirates ID + Terms & Conditions

**Date:** 2026-05-13  
**Status:** Approved

## Summary

Add Emirates ID (optional) field and mandatory Terms & Conditions acceptance checkbox to agent registration flow.

## Data Model

**File:** `backend/models/User.js`

Add one optional field to User schema:
```js
emiratesId: { type: String, default: null }
```
- No uniqueness constraint
- No format validation
- Stored if provided, null if omitted

## Backend

**File:** `backend/controllers/auth.controller.js` — `registerAgent`

- Destructure `emiratesId` from `req.body`
- Pass to `User.create()` alongside existing fields
- No additional validation (field is optional)

## Frontend

### Register.jsx

- Add `emiratesId` text input field (label: "Emirates ID", optional)
- Add T&C checkbox: `I agree to the Terms and Conditions` with link to `/terms`
- Checkbox is required — submit button disabled until checked
- If `emiratesId` filled, include in API payload to `POST /api/auth/register-agent`

### TermsAndConditions.jsx (new file)

- Static page at route `/terms`
- Standard T&C content (placeholder, to be updated with real legal text)
- Accessible without authentication

### Router

- Add `/terms` route pointing to `TermsAndConditions` component
- Public route (no auth guard)

## Out of Scope

- Admin UI display of emiratesId (future work)
- Emirates ID format validation (future work)
- Storing T&C acceptance timestamp in DB
- Any changes to JWT/auth flow
