const Lead = require('../models/Lead');
const AgencyPayout = require('../models/AgencyPayout');
const BucketRequest = require('../models/BucketRequest');
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

    const request = await BucketRequest.create({
      agency: req.user._id,
      amount: Number(amount),
      note: note || undefined,
      receiptFile,
    });

    try {
      const agency = await User.findById(req.user._id).select('name email');
      const adminIds = await getAdminIds();
      await createAndEmit(
        adminIds,
        {
          type: 'bucket_request',
          title: 'Bucket Top-Up Request',
          body: `${agency.name || agency.email} requested AED ${Number(amount).toLocaleString()} wallet top-up`,
        },
        req.user._id,
      );
    } catch (_) {}

    res.status(201).json({ request, message: 'Request submitted — pending admin approval' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyBucketRequests = async (req, res) => {
  try {
    const requests = await BucketRequest.find({ agency: req.user._id })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.adminGetBucketRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const requests = await BucketRequest.find(filter)
      .populate('agency', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveBucketRequest = async (req, res) => {
  try {
    const request = await BucketRequest.findById(req.params.id).populate('agency', 'name email');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Already reviewed' });

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    await User.findByIdAndUpdate(request.agency._id, {
      $inc: { bucketBalance: request.amount },
    });

    try {
      await createAndEmit(
        [String(request.agency._id)],
        {
          type: 'bucket_request',
          title: 'Wallet Top-Up Approved',
          body: `AED ${Number(request.amount).toLocaleString()} added to your wallet`,
        },
        req.user._id,
      );
    } catch (_) {}

    res.json({ message: 'Approved', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rejectBucketRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await BucketRequest.findById(req.params.id).populate('agency', 'name email');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Already reviewed' });

    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.rejectionReason = reason || undefined;
    await request.save();

    try {
      await createAndEmit(
        [String(request.agency._id)],
        {
          type: 'bucket_request',
          title: 'Wallet Top-Up Rejected',
          body: `AED ${Number(request.amount).toLocaleString()} request rejected${reason ? ` — ${reason}` : ''}`,
        },
        req.user._id,
      );
    } catch (_) {}

    res.json({ message: 'Rejected', request });
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
    if (Number(amountPaid) < 0)
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

    // Bucket-only payment → auto-mark received (no admin confirmation needed)
    const isBucketOnly = Number(amountPaid) === 0 && bucketUsed >= totalSelected;
    const newStatus = isBucketOnly ? 'received' : 'agency_paid';

    await Lead.updateMany(
      { _id: { $in: leadIds } },
      {
        agencyPaymentStatus: newStatus,
        agencyPaymentNote: receiptNote || undefined,
        ...(isBucketOnly ? { agencyPaymentReceivedAt: new Date() } : {}),
      }
    );

    // If auto-received, flip commissionStatus to payable so agent payout queue updates
    if (isBucketOnly) {
      await Lead.updateMany(
        { _id: { $in: leadIds }, commissionStatus: { $in: ['pending', 'none'] }, commission: { $gt: 0 } },
        { commissionStatus: 'payable' }
      );
    }

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
      if (isBucketOnly) {
        // Notify admin that bucket payment auto-cleared
        await createAndEmit(
          adminIds,
          {
            type: 'agency_payout_submitted',
            title: 'Agency Paid via Bucket',
            body: `${agency.name || agency.email} settled ${leads.length} lead(s) (${`AED ${totalSelected.toLocaleString()}`}) via bucket — auto marked received`,
          },
          req.user._id,
        );
        // Notify agency + agents that commission is now payable
        const fullLeads = await Lead.find({ _id: { $in: leadIds } })
          .select('customerName agency agent commission').lean();
        await Promise.all(
          fullLeads.map((l) =>
            createAndEmit(
              [String(l.agency), String(l.agent)],
              {
                type: 'commission_payable',
                title: 'Commission Ready',
                body: `${l.customerName} — AED ${Number(l.commission || 0).toLocaleString()} now payable`,
                lead: l._id,
              },
              req.user._id,
            )
          )
        );
      } else {
        await createAndEmit(
          adminIds,
          {
            type: 'agency_payout_submitted',
            title: 'Agency Payout Submitted',
            body: `${agency.name || agency.email} submitted payout of AED ${Number(amountPaid).toLocaleString()} for ${leads.length} lead(s)`,
          },
          req.user._id,
        );
      }
    } catch (_) {}

    res.status(201).json({ payout, bucketBalance: agency.bucketBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
