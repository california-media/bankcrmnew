const mongoose = require('mongoose');

// Pool of single-use codes per voucher; assigned atomically on redeem.
const voucherCodeSchema = new mongoose.Schema(
  {
    voucher: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
    code: { type: String, required: true, trim: true },
    status: { type: String, enum: ['available', 'assigned'], default: 'available' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    redemption: { type: mongoose.Schema.Types.ObjectId, ref: 'Redemption', default: null },
  },
  { timestamps: true }
);

voucherCodeSchema.index({ voucher: 1, code: 1 }, { unique: true });
voucherCodeSchema.index({ voucher: 1, status: 1 });

module.exports = mongoose.model('VoucherCode', voucherCodeSchema);
