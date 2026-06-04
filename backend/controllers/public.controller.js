const User = require('../models/User');
const Lead = require('../models/Lead');

/**
 * GET /api/public/ref/:code
 */
exports.getRefInfo = async (req, res) => {
  try {
    const agent = await User.findOne({ referralCode: req.params.code.toUpperCase(), role: 'agent', isActive: true }).select('name referralCode');
    if (!agent) return res.status(404).json({ message: 'Invalid referral link' });
    res.json({ agentName: agent.name, referralCode: agent.referralCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/public/ref/:code/submit
 */
exports.submitReferral = async (req, res) => {
  try {
    const agent = await User.findOne({ referralCode: req.params.code.toUpperCase(), role: 'agent', isActive: true });
    if (!agent) return res.status(404).json({ message: 'Invalid referral link' });

    const { customerName, phone, email, nationality, visaType, companyName, jobTitle, yearsOfExperience, notes } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    await Lead.create({
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email?.trim() || undefined,
      nationality: nationality || undefined,
      visaType: visaType || undefined,
      companyName: companyName?.trim() || undefined,
      jobTitle: jobTitle?.trim() || undefined,
      yearsOfExperience: yearsOfExperience != null ? Number(yearsOfExperience) : undefined,
      notes: notes?.trim() || undefined,
      agent: agent._id,
      isReferral: true,
      status: 'submitted',
      commissionStatus: 'none',
    });

    res.status(201).json({ message: 'Lead submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
