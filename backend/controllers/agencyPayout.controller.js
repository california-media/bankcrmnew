const Lead = require('../models/Lead');
const AgencyPayout = require('../models/AgencyPayout');
const User = require('../models/User');
const { createAndEmit, getAdminIds } = require('../utils/notify');

exports.getPending = async (req, res) => {
  try {
    const leads = await Lead.find({
      agency: req.user._id,
      status: 'disbursed',
      agencyPaymentStatus: { $in: ['pending', 'agency_paid'] },
    })
      .populate('bank', 'name')
      .populate('cardProduct', 'name cardType')
      .populate('loanProduct', 'name loanCategory')
      .populate('agent', 'name email')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const payouts = await AgencyPayout.find({ agency: req.user._id })
      .populate('leads', 'leadNumber customerName grossCommission')
      .sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBucket = async (req, res) => {
  try {
    const agency = await User.findById(req.user._id).select('bucketBalance');
    res.json({ bucketBalance: agency.bucketBalance || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addToWallet = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const receiptFile = req.file ? req.file.filename : undefined;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: 'Valid amount required' });

    const agency = await User.findById(req.user._id);
    agency.bucketBalance = (agency.bucketBalance || 0) + Number(amount);
    await agency.save();

    res.json({ bucketBalance: agency.bucketBalance, message: 'Wallet topped up successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitPayout = async (req, res) => {
  try {
    const rawIds = req.body.leadIds;
    const leadIds = Array.isArray(rawIds) ? rawIds : JSON.parse(rawIds || '[]');
    const { amountPaid, bucketUsedAmount, receiptNote } = req.body;
    const receiptFile = req.file ? req.file.filename : undefined;

    if (!Array.isArray(leadIds) || !leadIds.length)
      return res.status(400).json({ message: 'Select at least one lead' });
    if (!amountPaid || Number(amountPaid) < 0)
      return res.status(400).json({ message: 'Valid amount required' });

    const leads = await Lead.find({
      _id: { $in: leadIds },
      agency: req.user._id,
      agencyPaymentStatus: { $in: ['pending', 'agency_paid'] },
    });

    if (leads.length !== leadIds.length)
      return res.status(400).json({ message: 'Some leads not found or already confirmed received' });

    const totalSelected = leads.reduce((sum, l) => sum + (l.grossCommission || 0), 0);

    const agency = await User.findById(req.user._id);
    const bucketAvailable = agency.bucketBalance || 0;
    const bucketUsed = Math.min(Number(bucketUsedAmount) || 0, bucketAvailable);
    const effectiveTotal = Number(amountPaid) + bucketUsed;

    if (effectiveTotal < totalSelected) {
      return res.status(400).json({
        message: `Insufficient payment. Required AED ${totalSelected.toLocaleString()}, effective AED ${effectiveTotal.toLocaleString()}.`,
      });
    }

    const overage = effectiveTotal - totalSelected;

    await Lead.updateMany(
      { _id: { $in: leadIds } },
      { agencyPaymentStatus: 'agency_paid', agencyPaymentNote: receiptNote || undefined }
    );

    agency.bucketBalance = bucketAvailable - bucketUsed + overage;
    await agency.save();

    const payout = await AgencyPayout.create({
      agency: req.user._id,
      leads: leadIds,
      totalSelected,
      amountPaid: Number(amountPaid),
      bucketUsed,
      bucketAdded: overage,
      receiptNote,
      receiptFile,
    });
    try {
      const adminIds = await getAdminIds();
      await createAndEmit(
        adminIds,
        {
          type: 'agency_payout_submitted',
          title: 'Agency Payout Submitted',
          body: `${agency.name || agency.email} submitted payout of AED ${Number(amountPaid).toLocaleString()} for ${leads.length} lead(s)`,
        },
        req.user._id,
      );
    } catch (_) {}
    res.status(201).json({ payout, bucketBalance: agency.bucketBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
