const mongoose = require('mongoose');

// Predefined list of lead companies maintained by the super admin. Lead.companyName stays free text.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    nameKey: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
