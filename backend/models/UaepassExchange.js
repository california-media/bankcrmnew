const mongoose = require('mongoose');

// One-time code handed to the mobile app after UAE PASS sign-in.
// The app swaps it for the JWT via POST /api/auth/uaepass/exchange (single use, short-lived).
const uaepassExchangeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

uaepassExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UaepassExchange', uaepassExchangeSchema);
