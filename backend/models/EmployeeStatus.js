const mongoose = require('mongoose');

const employeeStatusSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    color: { type: String, default: 'default', trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeStatus', employeeStatusSchema);
