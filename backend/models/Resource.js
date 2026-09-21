const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
    type: { type: String, enum: ['flyer', 'policy', 'training', 'other'], required: true },
    file: { type: String, required: true },
    fileType: { type: String, enum: ['image', 'pdf'], required: true },
    // Same convention as CardProduct.assignedAgencies / Bank.assignedAgencies
    // (backend/models/CardProduct.js:23, backend/models/Bank.js:14): empty
    // or absent = visible to every agency; non-empty = only these.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
