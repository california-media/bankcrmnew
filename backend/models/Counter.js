const mongoose = require('mongoose');

// Named, only-ever-increasing sequences (e.g. "invoice-INV-2026-"), bumped
// atomically with $inc so two concurrent requests never get the same value.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Counter', counterSchema);
