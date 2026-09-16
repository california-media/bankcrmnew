const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    hasSpend: { type: Boolean, default: false },
    logo: { type: String },
    // Product Admin: "assign to agency products and banks". Empty/absent =
    // visible to every agency (today's default, unchanged) — only agencies
    // listed here can see the bank once it's non-empty.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bank', bankSchema);
