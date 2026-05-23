const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['admin', 'agency', 'agent', 'employee'], required: true },

    // Employee-only: link back to the agency that created this employee
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeId: { type: String, unique: true, sparse: true },
    employeeType: { type: String, enum: ['cpv', 'sales'] },

    // Agent-only
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leadCount: { type: Number, default: 0 },
    emiratesId: { type: String, default: null },
    uaepassSub: { type: String, sparse: true, default: null },

    // Agency-only: overpayment credit pool
    bucketBalance: { type: Number, default: 0 },

    // Invitation flow (agencies created by admin)
    inviteToken: { type: String },
    inviteTokenExpires: { type: Date },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
