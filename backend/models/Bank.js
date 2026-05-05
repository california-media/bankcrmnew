const mongoose = require('mongoose');

/**
 * Banks are scoped to the agency that created them. Two agencies may both
 * have a bank named "Emirates NBD" — they are independent records.
 */
const bankSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String, trim: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bank', bankSchema);
