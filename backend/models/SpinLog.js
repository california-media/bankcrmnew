const mongoose = require('mongoose');

// One spin per user per Dubai day (dayKey 'YYYY-MM-DD').
const spinLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dayKey: { type: String, required: true },
    segmentIndex: { type: Number, required: true },
    coins: { type: Number, required: true },
    segmentsSnapshot: [
      new mongoose.Schema({ coins: Number, weight: Number }, { _id: false }),
    ],
  },
  { timestamps: true }
);

spinLogSchema.index({ user: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('SpinLog', spinLogSchema);
