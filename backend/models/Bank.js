const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    logo: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bank', bankSchema);
