# WhatsApp OTP Verification (Agent Registration)

## Problem

`Register.jsx` (agent signup) accepts a phone number today but never verifies it —
it's optional and unchecked. We want phone number verification via WhatsApp OTP,
modeled on the working implementation in
`/Users/developer/Documents/GitHub/voycellcallcenter`
(`companyAdminAuthController.js` → `verifyRealPhoneNumber`, Meta WhatsApp Cloud API,
`ProfileCompletionModal.jsx` for the UI/timer).

Voycell's version verifies the phone of an **already-authenticated** user (fields
`otp`/`otpExpiresAt` live on the `User` document). mysilah needs this **during
registration**, before any account exists. mysilah's `User` schema requires
`email` (required + unique), so a half-populated User row can't be created at
"send OTP" time without a schema change to a field the rest of the app (login,
uniqueness checks) depends on. This spec stores OTP state in a separate
short-lived collection instead, and carries proof of verification into the
final registration call via a signed token — everything else (OTP generation,
Meta API call, template, timer UX, expiry, cooldown) mirrors voycell as
closely as the pre-account context allows.

## Scope

- `frontend/src/pages/Register.jsx` (agent signup) only. `RegisterAgency.jsx` is
  explicitly out of scope.
- Phone becomes a **required** field, verified via WhatsApp OTP before the
  account can be created.

## Credentials (explicit decision)

mysilah has no Meta WhatsApp Cloud API credentials of its own yet. Per explicit
user decision, this reuses **voycell's live** `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, and the approved `"otp"` template — copied
verbatim from `voycellcallcenter-backend/.env` into
`bankcrmnew/backend/.env`. OTP messages will be sent from voycell's WhatsApp
Business sender identity on behalf of mysilah. This is a conscious, explicitly
approved choice (not a default), not something to silently redo if credentials
change later.

## Backend

### New model — `backend/models/PhoneOtp.js`

Dedicated collection (not the `User` model) because no `User` document exists
yet during registration and `User.email` is `required + unique`.

```js
{
  phone: { type: String, required: true, unique: true, trim: true }, // e.g. "971501234567"
  otp: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
}
```
- `timestamps: true`.
- TTL index on `otpExpiresAt` (or a fixed `createdAt` TTL, e.g. 1 hour) so stale
  rows self-clean.

### New config — `backend/config/whatsapp.js`

Copied from voycell as-is:
```js
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";
module.exports = {
  META_GRAPH_URL: `https://graph.facebook.com/${META_GRAPH_VERSION}`,
  META_GRAPH_VERSION,
};
```

### `backend/controllers/auth.controller.js` additions

- `sendWhatsAppOtp(toPhoneNumber, otp)` — copied from voycell's
  `companyAdminAuthController.js:519-560` (same template name `"otp"`, same
  body/button param shape, same axios POST to
  `${META_GRAPH_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages` with
  `Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}`).

- `exports.sendOtp` — `POST /api/auth/send-otp`, public.
  - Body: `{ phone }` (already normalized to `971XXXXXXXXX` by the frontend,
    same as the rest of Register.jsx's phone handling).
  - Find `PhoneOtp` by phone. If found and `lastSentAt` is within 60s of now →
    `429 { message: 'Please wait before requesting another OTP' }`.
  - Generate 6-digit numeric OTP (`Math.floor(100000 + Math.random()*900000)`,
    same as voycell).
  - Upsert `PhoneOtp`: `otp`, `otpExpiresAt = now + 10min`, `lastSentAt = now`.
  - Call `sendWhatsAppOtp(phone, otp)`.
  - Respond `200 { status: 'pending' }` (mirrors voycell's response shape).
  - If the Meta API call throws, respond `502 { message: 'Failed to send OTP, please try again' }` (don't leak the raw axios error).

- `exports.verifyOtp` — `POST /api/auth/verify-otp`, public.
  - Body: `{ phone, otp }`.
  - Find `PhoneOtp` by phone. Missing → `400 { message: 'No OTP requested for this number' }`.
  - `otp` mismatch → `400 { message: 'Invalid OTP' }`.
  - `otpExpiresAt < now` → `400 { message: 'OTP expired, please resend' }`.
  - On success: delete the `PhoneOtp` doc, sign
    `phoneVerifyToken = jwt.sign({ phone }, process.env.JWT_SECRET, { expiresIn: '15m' })`,
    respond `200 { status: 'verified', phoneVerifyToken }`.

- `exports.registerAgent` — add a gate before `User.create`:
  - Require `phone` and `phoneVerifyToken` in the body.
  - `jwt.verify(phoneVerifyToken, process.env.JWT_SECRET)`; on failure/expiry →
    `400 { message: 'Phone verification expired, please verify your number again' }`.
  - Decoded `phone` must match the submitted `phone` (normalized) → otherwise
    `400 { message: 'Phone verification does not match' }`.
  - Proceed with existing creation logic unchanged otherwise.

### `backend/routes/auth.routes.js`

```js
router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
```
Placed alongside `register-agent`, no `protect` middleware (registration is
necessarily pre-auth).

### `backend/.env`

Add (values copied from voycell's `.env`, not placeholders):
```
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
META_GRAPH_VERSION=v24.0
```

## Frontend

### `frontend/src/store/slices/authSlice.js`

Two new thunks following the existing `createAsyncThunk` + `api.post` +
`rejectWithValue` pattern:
- `sendOtp({ phone })` → `POST /auth/send-otp`.
- `verifyOtp({ phone, otp })` → `POST /auth/verify-otp`, stores
  `phoneVerifyToken` and `phoneVerified: true` in slice state on success.

Both are local to the registration UI's needs — no new reducer state beyond
what Register.jsx reads (`otpStatus`, `phoneVerifyToken`, `phoneVerified`,
`otpError`).

### `frontend/src/pages/Register.jsx`

- `phone` field rules become `required: true` (in addition to the existing
  `validateUAELocalPhone` validator).
- Next to the phone field: a **Send OTP** button (disabled until the phone
  field passes validation). Click → `dispatch(sendOtp({ phone: toFullUAEPhone(value) }))`.
- On success: reveal a 6-digit OTP input (six single-digit boxes, auto-advance
  focus — same pattern as voycell's `ProfileCompletionModal.jsx:152-162`) plus
  a **Verify** button, and a resend row:
  ```
  canResend ? <Button onClick={handleResendOtp}>Resend OTP</Button>
             : <Text>Resend OTP in {timer}s</Text>
  ```
  `timer` starts at 60 and counts down via `setInterval`, identical to
  voycell's countdown effect (`ProfileCompletionModal.jsx:24-55`).
- **Verify** → `dispatch(verifyOtp({ phone, otp: joinedDigits }))`. On success,
  mark phone verified in local state, collapse the OTP boxes, show a
  verified checkmark/badge next to the phone field.
- **Resend** → same `sendOtp` dispatch, resets `timer` to 60 on success; if the
  backend returns 429 (cooldown not elapsed), surface that message instead of
  resetting the timer.
- The main **Create account** submit button is disabled until phone is
  verified (`phoneVerified` true) — this is a UX guard only; the real
  enforcement is server-side in `registerAgent` via `phoneVerifyToken`.
- `onFinish` payload gains `phoneVerifyToken` alongside the existing fields.

## Error handling

- Wrong OTP, expired OTP, resend-too-soon, and Meta send failures all surface
  as inline `Alert`/form errors — no silent failures.
- If `phoneVerifyToken` expires between verify and final submit (15 min
  window), `registerAgent` rejects with a clear message telling the user to
  re-verify; frontend resets the verified state so they can restart that step
  without re-filling the whole form (other field values stay in the `Form`
  instance).

## Testing

No existing automated test suite covers `Register.jsx` or `auth.controller.js`
today (manual QA is the existing project pattern for this area — see prior
specs in this directory). Manual test plan:
1. Enter valid UAE phone → Send OTP → real WhatsApp message arrives with a
   6-digit code.
2. Enter correct code → verifies, submit enabled, registration succeeds with
   phone stored.
3. Enter wrong code → inline error, doesn't consume the OTP (can retry until
   expiry).
4. Wait 10+ min → old code → `OTP expired` error.
5. Click Resend before 60s (e.g. via direct API call) → `429` surfaced.
6. Click Resend after 60s → new WhatsApp message arrives, timer resets.
7. Attempt to submit registration with a stale/expired `phoneVerifyToken`
   (e.g. wait 15+ min after verifying) → server rejects, clear error shown.
