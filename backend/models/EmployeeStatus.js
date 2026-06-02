const mongoose = require('mongoose');

const employeeStatusSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    color: { type: String, default: 'default', trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    statusType: { type: String, enum: ['lead_label', 'whatsapp_consent', 'loan_status'], default: 'lead_label' },
    isDefault: { type: Boolean, default: false },
    isFixed: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeStatus', employeeStatusSchema);
