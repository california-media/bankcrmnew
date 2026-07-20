// backend/models/Notice.js
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    message:     { type: String, required: true, trim: true },
    targetRoles: {
      type: [{ type: String, enum: ['admin', 'agency', 'agent', 'employee'] }],
      required: true,
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'At least one role required' },
    },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

noticeSchema.path('endDate').validate(function (v) {
  return !this.startDate || v > this.startDate;
}, 'endDate must be after startDate');

noticeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
