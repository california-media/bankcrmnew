const mongoose = require('mongoose');

const redemptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
    voucherCode: { type: mongoose.Schema.Types.ObjectId, ref: 'VoucherCode', default: null },
    code: { type: String, default: '' },
    coinCost: { type: Number, required: true },
    scratchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

redemptionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Redemption', redemptionSchema);
