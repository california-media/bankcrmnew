const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    phone: { type: String, trim: true },
    role: { type: String, enum: ['admin', 'agency', 'agent'], required: true },

    // Agency-only
    banks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bank' }],

    // Agent-only
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

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
