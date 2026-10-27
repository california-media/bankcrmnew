const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    terms: { type: String, trim: true, default: '' },
    valueLabel: { type: String, trim: true, default: '' },
    coinCost: { type: Number, required: true, min: 1 },
    logo: { type: String, default: null }, // S3 filename
    theme: { type: String, enum: ['shop', 'dine', 'cine', 'trav', 'coff', 'fuel'], default: 'shop' },
    validUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);
