const mongoose = require('mongoose');

// Ledger of every coin movement. amount is signed (negative for redeem).
const coinTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['spin', 'invite', 'redeem'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    title: { type: String, trim: true, default: '' },
    spin: { type: mongoose.Schema.Types.ObjectId, ref: 'SpinLog', default: null },
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    redemption: { type: mongoose.Schema.Types.ObjectId, ref: 'Redemption', default: null },
  },
  { timestamps: true }
);

coinTransactionSchema.index({ user: 1, createdAt: -1 });
// An invitee can reward their inviter at most once.
coinTransactionSchema.index(
  { invitee: 1 },
  { unique: true, partialFilterExpression: { type: 'invite' } }
);

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
