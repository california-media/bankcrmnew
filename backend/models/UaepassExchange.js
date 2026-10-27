const mongoose = require('mongoose');

// One-time code handed to the mobile app after UAE PASS sign-in (single use, short-lived).
// The app swaps it via POST /api/auth/uaepass/exchange, proving it holds the PKCE verifier
// for `challenge`. Each row carries exactly one secret: a login `token` or a register `prefill`.
const uaepassExchangeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    challenge: { type: String, required: true },
    token: {
      type: String,
      required: [function () { return !this.prefill; }, 'token or prefill is required'],
    },
    prefill: {
      type: String,
      required: [function () { return !this.token; }, 'token or prefill is required'],
      validate: {
        validator: function () { return !this.token; },
        message: 'token and prefill are mutually exclusive',
      },
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

uaepassExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UaepassExchange', uaepassExchangeSchema);
