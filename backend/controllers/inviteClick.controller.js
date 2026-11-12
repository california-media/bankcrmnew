const { normalizeCode, normalizeProbe, isPublicIp, pickInviteClick, networkKey } = require('../utils/inviteMatch');
const { makeRateLimiter } = require('../utils/rateLimit');

// Agent invite links without a paid link service (mobile app spec 2026-11-12):
//  - POST /api/public/invite-clicks: the app.mysilah.ae/join/<code> page reports a tap and gets the store URLs.
//  - POST /api/public/invite-clicks/match: the app's first launch after install asks which link it came from.
// Matching is same public IP + platform + device details, within 24 hours; each tap is handed out once.

const DAY_MS = 24 * 3600 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const CLICK_MAX = 30;
const MATCH_MAX = 10;
const MAX_CANDIDATES = 20;

function makeInviteClickController({ InviteClick, User, env, now }) {
  // Per-network limits (IPv6 by /64, so rotating addresses inside one network share a bucket).
  const limits = {
    click: makeRateLimiter({ windowMs: WINDOW_MS, max: CLICK_MAX, now }),
    match: makeRateLimiter({ windowMs: WINDOW_MS, max: MATCH_MAX, now }),
  };

  // Local testing only (emulator / LAN, where every address is private): INVITE_MATCH_ALLOW_PRIVATE=true lets
  // private addresses record and match. Never set it on the live server.
  const reachable = (ip) => env.INVITE_MATCH_ALLOW_PRIVATE === 'true' || isPublicIp(ip);

  const storeUrls = () => ({
    iosStoreUrl: env.IOS_APP_STORE_URL || null,
    androidStoreUrl: env.ANDROID_PLAY_STORE_URL || null,
  });

  async function click(req, res) {
    try {
      const code = normalizeCode(req.body?.code);
      const probe = normalizeProbe(req.body);
      const net = networkKey(req.ip);
      if (code && probe.platform !== 'other' && reachable(req.ip) && !limits.click.hit(net)) {
        const inviter = await User.findOne({ referralCode: code, role: 'agent', isActive: true }).select('_id').lean();
        if (inviter) {
          // `ip` holds the network (utils/inviteMatch networkKey), not necessarily the full address.
          await InviteClick.create({ code, inviter: inviter._id, ip: net, ...probe });
        }
      }
    } catch (err) {
      console.error('invite click failed', err);
    }
    // Always answer: the landing page redirects either way.
    res.json(storeUrls());
  }

  async function match(req, res) {
    try {
      const probe = normalizeProbe(req.body);
      const net = networkKey(req.ip);
      if (probe.platform === 'other' || !reachable(req.ip) || limits.match.hit(net)) {
        return res.json({ code: null });
      }
      const t = now();
      let candidates = await InviteClick.find({
        ip: net, platform: probe.platform, claimedAt: null, createdAt: { $gte: new Date(t - DAY_MS) },
      }).sort({ createdAt: -1 }).limit(MAX_CANDIDATES).lean();
      for (;;) {
        const pick = pickInviteClick(candidates, probe);
        if (!pick) return res.json({ code: null });
        const claimed = await InviteClick.findOneAndUpdate(
          { _id: pick._id, claimedAt: null },
          { $set: { claimedAt: new Date(t) } },
        ).lean();
        if (claimed) {
          // The same friend tapping the same link twice leaves duplicates: retire them so a later install on this
          // network can't pick one up.
          await InviteClick.updateMany(
            { ip: net, platform: probe.platform, code: pick.code, claimedAt: null },
            { $set: { claimedAt: new Date(t) } },
          ).catch((e) => console.error('invite duplicate retire failed', e));
          return res.json({ code: pick.code });
        }
        // Another launch claimed it first: try the next one.
        candidates = candidates.filter((c) => c !== pick);
      }
    } catch (err) {
      console.error('invite match failed', err);
      return res.json({ code: null });
    }
  }

  return { click, match };
}

module.exports = makeInviteClickController({
  InviteClick: require('../models/InviteClick'),
  User: require('../models/User'),
  env: process.env,
  now: () => Date.now(),
});
module.exports.makeInviteClickController = makeInviteClickController;
