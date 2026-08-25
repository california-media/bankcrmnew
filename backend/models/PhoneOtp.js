const mongoose = require('mongoose');

const phoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    otp: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete once the OTP has been expired for 1 hour — keeps the
// collection from accumulating abandoned registration attempts.
phoneOtpSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('PhoneOtp', phoneOtpSchema);
