# WhatsApp OTP Verification (Agent Registration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents registering via `Register.jsx` must verify their phone number over WhatsApp OTP before the account is created.

**Architecture:** A new `PhoneOtp` collection holds OTP state before any `User` exists (the `User` schema requires `email`, so a pre-account placeholder row isn't viable). `send-otp`/`verify-otp` are public endpoints; verification issues a short-lived signed `phoneVerifyToken` (JWT) that `registerAgent` validates before creating the account — enforcement is server-side, not just a UI gate. OTP delivery goes through the Meta WhatsApp Cloud API, reusing voycell's live credentials and its exact request/template shape, sent via Node's built-in `https` (matching this repo's existing `waba.service.js` pattern) rather than adding an `axios` dependency.

**Tech Stack:** Express + Mongoose (backend), native `https` for the WhatsApp call, `jsonwebtoken` (already a dependency) for the verify token, React + antd + Redux Toolkit (frontend).

**Spec:** `docs/superpowers/specs/2026-08-25-whatsapp-otp-verification-design.md`

## Global Constraints

- Scope is `frontend/src/pages/Register.jsx` (agent signup) only — `RegisterAgency.jsx` is explicitly out of scope.
- Phone becomes a **required** field in Register.jsx, verified before account creation.
- OTP messages are sent using voycell's **actual live** `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / template `"otp"` — an explicit, approved decision (not a placeholder to fill in later). Copy the values from `/Users/developer/Documents/GitHub/voycellcallcenter/voycellcallcenter-backend/.env` into `/Users/developer/Documents/GitHub/bankcrmnew/backend/.env`. Both files are gitignored (`backend/.gitignore:2` and `voycellcallcenter-backend/.gitignore:81`) — no secret ever touches git.
- OTP: 6-digit numeric, 10-minute expiry, 60-second resend cooldown enforced **server-side** (in addition to a frontend countdown), matching the spec.
- `phoneVerifyToken`: JWT signed with the existing `process.env.JWT_SECRET`, 15-minute expiry, payload `{ phone }`.
- No test framework exists anywhere in this repo (`backend/package.json` / `frontend/package.json` have no `test` script, no `*.test.js`/`*.spec.js` files). Do not introduce one — verify each backend task with `node -e` / `curl` and each frontend task by running the dev app, consistent with how the rest of this codebase is verified (see prior plans in `docs/superpowers/plans/`).

---

## File Structure

- Create: `backend/models/PhoneOtp.js` — OTP state (phone, otp, otpExpiresAt, lastSentAt).
- Create: `backend/config/whatsapp.js` — Meta Graph API URL/version, copied from voycell.
- Create: `backend/services/whatsappOtp.service.js` — `sendWhatsAppOtp(phone, otp)`, native `https` call to Meta, mirrors `backend/services/waba.service.js` style.
- Modify: `backend/controllers/auth.controller.js` — add `sendOtp`, `verifyOtp`; gate `registerAgent` on `phoneVerifyToken`.
- Modify: `backend/routes/auth.routes.js` — wire `/send-otp`, `/verify-otp`.
- Modify: `backend/.env` — add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_GRAPH_VERSION` (values copied from voycell).
- Modify: `frontend/src/store/slices/authSlice.js` — add `sendOtp`, `verifyOtp` thunks + OTP-scoped state.
- Modify: `frontend/src/pages/Register.jsx` — required phone, Send/Resend OTP UI, 6-digit input, gated submit.

---

### Task 1: `PhoneOtp` model

**Files:**
- Create: `backend/models/PhoneOtp.js`

**Interfaces:**
- Produces: `PhoneOtp` Mongoose model — `{ phone: String (unique), otp: String, otpExpiresAt: Date, lastSentAt: Date }`, `timestamps: true`, TTL index on `otpExpiresAt`.

- [ ] **Step 1: Create the model**

```js
// backend/models/PhoneOtp.js
const mongoose = require('mongoose');

const phoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    otp: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete once the OTP has been expired for 1 hour — keeps the
// collection from accumulating abandoned registration attempts.
phoneOtpSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('PhoneOtp', phoneOtpSchema);
```

- [ ] **Step 2: Verify the model loads**

Run: `cd "backend" && node -e "require('./models/PhoneOtp'); console.log('OK')"`
Expected: `OK` printed, no exceptions.

- [ ] **Step 3: Commit**

```bash
git add backend/models/PhoneOtp.js
git commit -m "$(cat <<'EOF'
Add PhoneOtp model for pre-registration phone verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: WhatsApp config, send service, and env vars

**Files:**
- Create: `backend/config/whatsapp.js`
- Create: `backend/services/whatsappOtp.service.js`
- Modify: `backend/.env` (not committed — gitignored)

**Interfaces:**
- Produces: `META_GRAPH_URL`, `META_GRAPH_VERSION` from `backend/config/whatsapp.js`.
- Produces: `sendWhatsAppOtp({ phone, otp })` from `backend/services/whatsappOtp.service.js` — returns a `Promise` resolving to `{ status, body }` on a completed HTTP response or `{ error }` on a network/timeout failure. Never rejects/throws (same contract as `waba.service.js`'s `sendConsentMessage`).

- [ ] **Step 1: Create the config file**

```js
// backend/config/whatsapp.js
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';

module.exports = {
  META_GRAPH_URL: `https://graph.facebook.com/${META_GRAPH_VERSION}`,
  META_GRAPH_VERSION,
};
```

- [ ] **Step 2: Create the send service**

```js
// backend/services/whatsappOtp.service.js
const https = require('https');
const { META_GRAPH_URL } = require('../config/whatsapp');

function sendWhatsAppOtp({ phone, otp }) {
  return new Promise((resolve) => {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !accessToken) {
      return resolve({ error: 'WhatsApp credentials not configured' });
    }

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'otp',
        language: { code: 'en_US' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: otp }] },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [{ type: 'text', text: otp }],
          },
        ],
      },
    });

    const url = new URL(`${META_GRAPH_URL}/${phoneNumberId}/messages`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log(`[WhatsApp OTP] Sending OTP to phone=${phone}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[WhatsApp OTP] Response status=${res.statusCode} body=${JSON.stringify(parsed)}`);
          resolve({ status: res.statusCode, body: parsed });
        } catch (_) {
          console.log(`[WhatsApp OTP] Response status=${res.statusCode} body=${data}`);
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp OTP] request error:', err.message);
      resolve({ error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { sendWhatsAppOtp };
```

- [ ] **Step 3: Copy the real credentials from voycell into mysilah's `.env`**

Run (reads voycell's actual values and appends them to mysilah's `backend/.env` — both files are gitignored, nothing here touches git):

```bash
VOYCELL_ENV="/Users/developer/Documents/GitHub/voycellcallcenter/voycellcallcenter-backend/.env"
TARGET_ENV="backend/.env"   # relative to repo root — run this from the repo/worktree root

{
  echo ""
  echo "# WhatsApp OTP (Meta Cloud API) — reused from voycellcallcenter, see docs/superpowers/specs/2026-08-25-whatsapp-otp-verification-design.md"
  grep -E '^WHATSAPP_ACCESS_TOKEN=' "$VOYCELL_ENV"
  grep -E '^WHATSAPP_PHONE_NUMBER_ID=' "$VOYCELL_ENV"
  grep -E '^META_GRAPH_VERSION=' "$VOYCELL_ENV" || echo "META_GRAPH_VERSION=v24.0"
} >> "$TARGET_ENV"
```

- [ ] **Step 4: Verify the three vars landed and are non-empty**

Run: `grep -E '^(WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID|META_GRAPH_VERSION)=' backend/.env | sed 's/=.\{4\}.*/=<redacted, present>/'`
Expected: three lines printed, each showing `<redacted, present>` (confirms non-empty without echoing the secret to the terminal transcript).

- [ ] **Step 5: Verify the service and config load**

Run: `cd "backend" && node -e "require('./config/whatsapp'); const s = require('./services/whatsappOtp.service'); console.log(typeof s.sendWhatsAppOtp)"`
Expected: `function` printed.

- [ ] **Step 6: Commit (config/service only — `.env` is gitignored and must not be committed)**

```bash
git add backend/config/whatsapp.js backend/services/whatsappOtp.service.js
git commit -m "$(cat <<'EOF'
Add WhatsApp Cloud API config and OTP send service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `send-otp` / `verify-otp` endpoints

**Files:**
- Modify: `backend/controllers/auth.controller.js` (add after `registerAgent`, before the `/**` comment starting the next exported function around line 100)
- Modify: `backend/routes/auth.routes.js:11` (add after `register-agent`)

**Interfaces:**
- Consumes: `PhoneOtp` model (Task 1), `sendWhatsAppOtp` (Task 2).
- Produces: `exports.sendOtp` — `POST /api/auth/send-otp`, body `{ phone }`, responds `200 { status: 'pending' }`, `429 { message }` on cooldown, `502 { message }` on send failure.
- Produces: `exports.verifyOtp` — `POST /api/auth/verify-otp`, body `{ phone, otp }`, responds `200 { status: 'verified', phoneVerifyToken }` or `400 { message }`.

- [ ] **Step 1: Add imports at the top of `auth.controller.js`**

Change:
```js
const crypto = require('crypto');
const User = require('../models/User');
const { signAuthToken, generateReferralCode } = require('../utils/token');
const { sendPasswordResetEmail, sendEmailVerification } = require('../utils/email');
```
to:
```js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PhoneOtp = require('../models/PhoneOtp');
const { signAuthToken, generateReferralCode } = require('../utils/token');
const { sendPasswordResetEmail, sendEmailVerification } = require('../utils/email');
const { sendWhatsAppOtp } = require('../services/whatsappOtp.service');

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const PHONE_VERIFY_TOKEN_EXPIRES_IN = '15m';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
```

- [ ] **Step 2: Add `sendOtp` and `verifyOtp`, right after the closing `};` of `registerAgent` (currently line 98)**

```js
/**
 * POST /api/auth/send-otp  (public)
 */
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });

    const existing = await PhoneOtp.findOne({ phone });
    if (existing && Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait before requesting another OTP' });
    }

    const otp = generateOtp();
    const now = new Date();
    const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    const sendResult = await sendWhatsAppOtp({ phone, otp });
    if (sendResult.error || (sendResult.status && sendResult.status >= 400)) {
      return res.status(502).json({ message: 'Failed to send OTP, please try again' });
    }

    await PhoneOtp.findOneAndUpdate(
      { phone },
      { otp, otpExpiresAt, lastSentAt: now },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ status: 'pending' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/verify-otp  (public)
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP are required' });

    const record = await PhoneOtp.findOne({ phone });
    if (!record) return res.status(400).json({ message: 'No OTP requested for this number' });
    if (record.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (record.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired, please resend' });
    }

    await PhoneOtp.deleteOne({ _id: record._id });

    const phoneVerifyToken = jwt.sign({ phone }, process.env.JWT_SECRET, {
      expiresIn: PHONE_VERIFY_TOKEN_EXPIRES_IN,
    });

    res.status(200).json({ status: 'verified', phoneVerifyToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
```

- [ ] **Step 3: Wire the routes**

In `backend/routes/auth.routes.js`, change:
```js
router.post('/register-agent', ctrl.registerAgent);
```
to:
```js
router.post('/register-agent', ctrl.registerAgent);
router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
```

- [ ] **Step 4: Verify the controller loads**

Run: `cd "backend" && node -e "const c = require('./controllers/auth.controller'); console.log(typeof c.sendOtp, typeof c.verifyOtp)"`
Expected: `function function`

- [ ] **Step 5: Start the backend and manually verify send/verify/cooldown/expiry with curl**

Run: `cd "backend" && npm run dev` (or however the dev server is normally started — check `package.json` `scripts` if unsure), then in another terminal:

```bash
curl -s -X POST http://localhost:8000/api/auth/send-otp -H 'Content-Type: application/json' -d '{"phone":"971501234567"}'
```
Expected: `{"status":"pending"}` and a real WhatsApp message arrives at that number with a 6-digit code.

```bash
curl -s -X POST http://localhost:8000/api/auth/send-otp -H 'Content-Type: application/json' -d '{"phone":"971501234567"}'
```
Expected (run immediately after): `{"message":"Please wait before requesting another OTP"}`, HTTP 429.

```bash
curl -s -X POST http://localhost:8000/api/auth/verify-otp -H 'Content-Type: application/json' -d '{"phone":"971501234567","otp":"000000"}'
```
Expected: `{"message":"Invalid OTP"}`, HTTP 400 (unless `000000` happens to be the real code).

```bash
curl -s -X POST http://localhost:8000/api/auth/verify-otp -H 'Content-Type: application/json' -d '{"phone":"971501234567","otp":"<the real code from WhatsApp>"}'
```
Expected: `{"status":"verified","phoneVerifyToken":"<jwt>"}`.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/auth.controller.js backend/routes/auth.routes.js
git commit -m "$(cat <<'EOF'
Add send-otp/verify-otp endpoints for WhatsApp phone verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Gate `registerAgent` on `phoneVerifyToken`

**Files:**
- Modify: `backend/controllers/auth.controller.js:50-58` (inside `registerAgent`)

**Interfaces:**
- Consumes: `phoneVerifyToken` (JWT signed in Task 3's `verifyOtp`), `phone` from the request body.

- [ ] **Step 1: Add the verification gate**

Change (currently lines 50-58):
```js
exports.registerAgent = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode, emiratesId, uaepassSub } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
```
to:
```js
exports.registerAgent = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode, emiratesId, uaepassSub, phoneVerifyToken } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (!phone || !phoneVerifyToken) {
      return res.status(400).json({ message: 'Phone verification is required' });
    }

    let decodedPhone;
    try {
      decodedPhone = jwt.verify(phoneVerifyToken, process.env.JWT_SECRET).phone;
    } catch (_) {
      return res.status(400).json({ message: 'Phone verification expired, please verify your number again' });
    }
    if (decodedPhone !== phone) {
      return res.status(400).json({ message: 'Phone verification does not match' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
```

- [ ] **Step 2: Verify the controller still loads**

Run: `cd "backend" && node -e "require('./controllers/auth.controller'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Manually verify the gate end-to-end with curl**

With the dev server running:
```bash
curl -s -X POST http://localhost:8000/api/auth/register-agent -H 'Content-Type: application/json' \
  -d '{"name":"Test Agent","email":"otp-test@example.com","password":"password1","phone":"971501234567","emiratesId":"784-1111-1111111-1"}'
```
Expected: `{"message":"Phone verification is required"}`, HTTP 400 (no `phoneVerifyToken`).

```bash
curl -s -X POST http://localhost:8000/api/auth/register-agent -H 'Content-Type: application/json' \
  -d '{"name":"Test Agent","email":"otp-test@example.com","password":"password1","phone":"971501234567","emiratesId":"784-1111-1111111-1","phoneVerifyToken":"<token from Task 3 curl>"}'
```
Expected: `201`, `{"message":"Registration successful. Please check your email to verify your account."}`.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/auth.controller.js
git commit -m "$(cat <<'EOF'
Require verified phoneVerifyToken before creating an agent account

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Frontend thunks (`authSlice.js`)

**Files:**
- Modify: `frontend/src/store/slices/authSlice.js`

**Interfaces:**
- Produces: `sendOtp({ phone })` — dispatches `POST /auth/send-otp`, fulfilled → `{ status: 'pending' }`.
- Produces: `verifyOtp({ phone, otp })` — dispatches `POST /auth/verify-otp`, fulfilled → `{ phoneVerifyToken }`.
- Produces: slice state `otpStatus: 'idle'|'sending'|'sent'|'verifying'|'verified'`, `otpError: string|null`, `phoneVerifyToken: string|null` — kept separate from the existing `status`/`error` fields so OTP UI state doesn't collide with the registration form's own status/error.

- [ ] **Step 1: Add the two thunks**

Insert after the `registerAgent` thunk (currently ending at line 40):

```js
/**
 * POST /auth/send-otp
 * @param {{ phone: string }} payload
 * @returns {Promise<{ status: string }>}
 */
export const sendOtp = createAsyncThunk('auth/sendOtp', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/send-otp', payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to send OTP');
  }
});

/**
 * POST /auth/verify-otp
 * @param {{ phone: string, otp: string }} payload
 * @returns {Promise<{ phoneVerifyToken: string }>}
 */
export const verifyOtp = createAsyncThunk('auth/verifyOtp', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/verify-otp', payload);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to verify OTP');
  }
});
```

- [ ] **Step 2: Add OTP-scoped state**

Change:
```js
const initialState = {
  user: null,
  status: 'idle',
  error: null,
  hydrated: false,
  registrationPending: false,
};
```
to:
```js
const initialState = {
  user: null,
  status: 'idle',
  error: null,
  hydrated: false,
  registrationPending: false,
  otpStatus: 'idle',
  otpError: null,
  phoneVerifyToken: null,
};
```

- [ ] **Step 3: Add extraReducers for both thunks**

Insert before the final closing `});` of `extraReducers` (after the `verifyEmail` block, currently ending at line 186):

```js
    builder
      .addCase(sendOtp.pending, (state) => { state.otpStatus = 'sending'; state.otpError = null; })
      .addCase(sendOtp.fulfilled, (state) => { state.otpStatus = 'sent'; })
      .addCase(sendOtp.rejected, (state, action) => { state.otpStatus = 'idle'; state.otpError = action.payload; });

    builder
      .addCase(verifyOtp.pending, (state) => { state.otpStatus = 'verifying'; state.otpError = null; })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.otpStatus = 'verified';
        state.phoneVerifyToken = action.payload.phoneVerifyToken;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.otpStatus = 'sent';
        state.otpError = action.payload;
      });
```

- [ ] **Step 4: Add a `resetOtp` reducer so Register.jsx can clear OTP state on unmount/phone edit**

Change:
```js
  reducers: {
    logout(state) {
      localStorage.removeItem('token');
      state.user = null;
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
```
to:
```js
  reducers: {
    logout(state) {
      localStorage.removeItem('token');
      state.user = null;
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
    resetOtp(state) {
      state.otpStatus = 'idle';
      state.otpError = null;
      state.phoneVerifyToken = null;
    },
  },
```
and change:
```js
export const { logout, clearError } = authSlice.actions;
```
to:
```js
export const { logout, clearError, resetOtp } = authSlice.actions;
```

- [ ] **Step 5: Verify the slice compiles**

Run: `cd "frontend" && npm run build`
Expected: build succeeds with no errors referencing `authSlice.js`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/slices/authSlice.js
git commit -m "$(cat <<'EOF'
Add sendOtp/verifyOtp thunks and OTP state to authSlice

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Register.jsx — Send OTP / verify UI / resend timer / gated submit

**Files:**
- Modify: `frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `sendOtp`, `verifyOtp`, `resetOtp` (Task 5), slice state `otpStatus`, `otpError`, `phoneVerifyToken`.
- Produces: updated `onFinish` payload including `phoneVerifyToken`; phone field required; submit disabled until `otpStatus === 'verified'`.

- [ ] **Step 1: Import the new thunks/actions and add local OTP UI state**

Change:
```js
import { registerAgent, clearError } from '../store/slices/authSlice';
import { validateUAELocalPhone, toFullUAEPhone } from '../utils/validatePhone';
```
to:
```js
import { registerAgent, clearError, sendOtp, verifyOtp, resetOtp } from '../store/slices/authSlice';
import { validateUAELocalPhone, toFullUAEPhone } from '../utils/validatePhone';
```

Change:
```js
  const { user, status, error, registrationPending } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [uaepassError, setUaepassError] = useState(null);
```
to:
```js
  const { user, status, error, registrationPending, otpStatus, otpError, phoneVerifyToken } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [uaepassError, setUaepassError] = useState(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
```

- [ ] **Step 2: Add the countdown effect and cleanup, and reset OTP on unmount**

Add alongside the existing `useEffect` hooks (after the `dispatch(clearError())` cleanup effect):
```js
  useEffect(() => {
    if (otpStatus !== 'sent' && otpStatus !== 'verifying') return;
    if (resendTimer <= 0) { setCanResend(true); return; }
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [otpStatus, resendTimer]);

  useEffect(() => () => dispatch(resetOtp()), [dispatch]);
```

- [ ] **Step 3: Add Send OTP / Resend OTP handlers**

Add near `onFinish` (after its definition):
```js
  const handleSendOtp = async () => {
    try {
      await form.validateFields(['phone']);
    } catch {
      return;
    }
    const phone = toFullUAEPhone(form.getFieldValue('phone'));
    setOtpDigits(['', '', '', '', '', '']);
    setResendTimer(60);
    setCanResend(false);
    dispatch(sendOtp({ phone }));
  };

  const handleResendOtp = () => {
    const phone = toFullUAEPhone(form.getFieldValue('phone'));
    setResendTimer(60);
    setCanResend(false);
    dispatch(sendOtp({ phone }));
  };

  const handleOtpDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (clean && index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerifyOtp = () => {
    const phone = toFullUAEPhone(form.getFieldValue('phone'));
    const otp = otpDigits.join('');
    dispatch(verifyOtp({ phone, otp }));
  };
```

- [ ] **Step 4: Make phone required and add the Send OTP / OTP box / resend UI**

Change:
```js
          <Form.Item name="phone" rules={[{ validator: validateUAELocalPhone }]} style={itemStyle}>
            <Input
              addonBefore={<span style={{ userSelect: 'none', pointerEvents: 'none', cursor: 'default' }}>🇦🇪 +971</span>}
              placeholder="501234567"
              style={inputStyle}
            />
          </Form.Item>
```
to:
```js
          <Form.Item
            name="phone"
            rules={[{ required: true, message: 'Phone number is required' }, { validator: validateUAELocalPhone }]}
            style={itemStyle}
          >
            <Input
              addonBefore={<span style={{ userSelect: 'none', pointerEvents: 'none', cursor: 'default' }}>🇦🇪 +971</span>}
              placeholder="501234567"
              style={inputStyle}
              disabled={otpStatus === 'verified'}
              suffix={
                otpStatus === 'verified' ? (
                  <span style={{ color: '#16A34A', fontSize: 12, fontWeight: 600 }}>Verified ✓</span>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={handleSendOtp}
                    loading={otpStatus === 'sending'}
                    style={{ padding: 0 }}
                  >
                    Send OTP
                  </Button>
                )
              }
            />
          </Form.Item>

          {otpError && <Alert type="error" message={otpError} style={{ marginBottom: 8, borderRadius: 10 }} />}

          {(otpStatus === 'sent' || otpStatus === 'verifying') && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {otpDigits.map((digit, i) => (
                  <Input
                    key={i}
                    id={`otp-digit-${i}`}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                    maxLength={1}
                    style={{ width: 38, textAlign: 'center', ...inputStyle }}
                  />
                ))}
                <Button
                  type="primary"
                  onClick={handleVerifyOtp}
                  loading={otpStatus === 'verifying'}
                  disabled={otpDigits.some((d) => !d)}
                >
                  Verify
                </Button>
              </div>
              <div style={{ fontSize: 12, color: '#6B7186' }}>
                {canResend ? (
                  <Button type="link" size="small" onClick={handleResendOtp} style={{ padding: 0 }}>
                    Resend OTP
                  </Button>
                ) : (
                  `Resend OTP in ${resendTimer}s`
                )}
              </div>
            </div>
          )}
```

- [ ] **Step 5: Include `phoneVerifyToken` in the submit payload and gate the submit button**

Change:
```js
  const onFinish = (values) => {
    const payload = {
      name:       values.name,
      email:      values.email,
      password:   values.password,
      phone:      values.phone ? toFullUAEPhone(values.phone) : undefined,
      emiratesId: values.emiratesId,
    };
    if (values._uaepassSub) payload.uaepassSub = values._uaepassSub;
    dispatch(registerAgent(payload));
  };
```
to:
```js
  const onFinish = (values) => {
    const payload = {
      name:       values.name,
      email:      values.email,
      password:   values.password,
      phone:      values.phone ? toFullUAEPhone(values.phone) : undefined,
      emiratesId: values.emiratesId,
      phoneVerifyToken,
    };
    if (values._uaepassSub) payload.uaepassSub = values._uaepassSub;
    dispatch(registerAgent(payload));
  };
```

Change:
```js
          <Button
            type="primary" htmlType="submit" loading={status === 'loading'} block size="large"
```
to:
```js
          <Button
            type="primary" htmlType="submit" loading={status === 'loading'}
            disabled={otpStatus !== 'verified'} block size="large"
```

- [ ] **Step 6: Manually verify in the running app**

Run: `cd "frontend" && npm run dev` (backend from Task 3 must also be running), then in a browser at the Register page:
1. Fill name/email/password/Emirates ID, leave phone empty, submit → blocked by the new "Phone number is required" validation.
2. Enter a valid UAE phone, click **Send OTP** → button shows loading, then the 6-digit boxes + "Resend OTP in 60s" appear; a real WhatsApp message arrives.
3. Type the wrong code, click **Verify** → inline error shown, boxes stay editable.
4. Type the correct code, click **Verify** → boxes area collapses, phone field shows "Verified ✓", **Create account** button becomes enabled.
5. Submit the full form → account created successfully (existing "Check your email" screen appears).
6. Repeat from step 2, click **Resend OTP** before 60s elapses (not applicable via UI since the button is hidden until `canResend` — confirm the timer counts down and the button only appears at 0).

Expected: all six checks match, no console errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Register.jsx
git commit -m "$(cat <<'EOF'
Add WhatsApp OTP verification UI to agent registration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
