const mongoose = require('mongoose');

const legalPageSchema = new mongoose.Schema(
  {
    slug:        { type: String, required: true, unique: true, trim: true },
    title:       { type: String, required: true, trim: true },
    content:     { type: String, default: '' },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LegalPage', legalPageSchema);
