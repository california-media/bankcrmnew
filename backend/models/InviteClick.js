const mongoose = require('mongoose');

// One tap on an agent's invite link (app.mysilah.ae/join/<code>), kept so the app's first launch after install
// can be matched back to it (utils/inviteMatch.js). Short-lived: deleted after 7 days.
const inviteClickSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ip: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    osVersion: { type: String, default: null },
    screenW: { type: Number, default: null },
    screenH: { type: Number, default: null },
    pixelRatio: { type: Number, default: null },
    timezone: { type: String, default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inviteClickSchema.index({ ip: 1, platform: 1, createdAt: -1 });
inviteClickSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = mongoose.model('InviteClick', inviteClickSchema);
