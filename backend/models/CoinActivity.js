const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../utils/coins');

// Challenge progress pings from the app: at most one row per user, type and Dubai day ('YYYY-MM-DD').
const coinActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    dayKey: { type: String, required: true },
  },
  { timestamps: true }
);

coinActivitySchema.index({ user: 1, type: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('CoinActivity', coinActivitySchema);
