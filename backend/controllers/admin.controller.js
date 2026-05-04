const User = require('../models/User');
const Lead = require('../models/Lead');

/**
 * GET /api/admin/agents  (admin)
 * Response: agents with summary counts (total leads, approved leads, paid commission).
 */
exports.listAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('referredBy', 'name email referralCode')
      .sort({ createdAt: -1 });

    const ids = agents.map((a) => a._id);
    const stats = await Lead.aggregate([
      { $match: { agent: { $in: ids } } },
      {
        $group: {
          _id: '$agent',
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          paidCommission: {
            $sum: { $cond: [{ $eq: ['$commissionStatus', 'paid'] }, '$commission', 0] },
          },
        },
      },
    ]);
    const byAgent = Object.fromEntries(stats.map((s) => [String(s._id), s]));

    const enriched = agents.map((a) => ({
      ...a.toObject(),
      stats: byAgent[String(a._id)] || { total: 0, approved: 0, paidCommission: 0 },
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/overview  (admin)
 * Top-level counts for the admin landing page.
 */
exports.overview = async (req, res) => {
  try {
    const [agents, agencies, banks, totalLeads, approvedLeads, pendingLeads, paidAgg, payableAgg] = await Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'agency' }),
      require('../models/Bank').countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'approved' }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Lead.aggregate([{ $match: { commissionStatus: 'paid' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $match: { commissionStatus: 'payable' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
    ]);
    res.json({
      agents,
      agencies,
      banks,
      totalLeads,
      approvedLeads,
      pendingLeads,
      paidCommission: paidAgg[0]?.sum || 0,
      payableCommission: payableAgg[0]?.sum || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
