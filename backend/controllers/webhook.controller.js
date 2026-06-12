const Lead           = require('../models/Lead');
const EmployeeStatus = require('../models/EmployeeStatus');

exports.wabaConsent = async (req, res) => {
  try {
    const { externalLeadId, consent, phone, consentId, respondedAt } = req.body;

    if (!externalLeadId) {
      return res.status(400).json({ ok: false, message: 'externalLeadId required' });
    }

    if (String(consent).toLowerCase() !== 'yes') {
      return res.json({ ok: true, message: 'consent not yes — no action taken' });
    }

    // Find confirmed whatsapp_consent status — match label containing "confirm"
    const confirmedStatus = await EmployeeStatus.findOne({
      statusType: 'whatsapp_consent',
      label: { $regex: /confirm/i },
    }).lean();

    if (!confirmedStatus) {
      console.error('[WABA webhook] No confirmed whatsapp_consent status found in EmployeeStatus');
      return res.status(500).json({ ok: false, message: 'Confirmed consent status not configured' });
    }

    const lead = await Lead.findOne({ leadNumber: externalLeadId });

    if (!lead) {
      return res.status(404).json({ ok: false, message: `Lead not found: ${externalLeadId}` });
    }

    lead.consentStatus = confirmedStatus._id;
    await lead.save();

    console.log(`[WABA webhook] Lead ${externalLeadId} consent → confirmed (consentId: ${consentId || '—'})`);
    res.json({ ok: true, leadId: lead._id, consentStatus: confirmedStatus.label });
  } catch (err) {
    console.error('[WABA webhook] error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
