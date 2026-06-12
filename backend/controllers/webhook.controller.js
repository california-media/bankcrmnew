const Lead           = require('../models/Lead');
const EmployeeStatus = require('../models/EmployeeStatus');

exports.wabaConsent = async (req, res) => {
  console.log('[WABA webhook] >>> HIT POST /api/webhooks/waba-consent');
  console.log('[WABA webhook] body:', JSON.stringify(req.body));

  try {
    const { externalLeadId, consent, phone, consentId, respondedAt } = req.body;

    if (!externalLeadId) {
      console.warn('[WABA webhook] Missing externalLeadId — rejected');
      return res.status(400).json({ ok: false, message: 'externalLeadId required' });
    }

    if (String(consent).toLowerCase() !== 'yes') {
      console.log(`[WABA webhook] consent="${consent}" — no action taken`);
      return res.json({ ok: true, message: 'consent not yes — no action taken' });
    }

    console.log(`[WABA webhook] consent=yes for externalLeadId=${externalLeadId}`);

    // Find confirmed whatsapp_consent status — match label containing "confirm"
    const confirmedStatus = await EmployeeStatus.findOne({
      statusType: 'whatsapp_consent',
      label: { $regex: /confirm/i },
    }).lean();

    if (!confirmedStatus) {
      console.error('[WABA webhook] No "confirmed" whatsapp_consent status in EmployeeStatus — add one in admin panel');
      return res.status(500).json({ ok: false, message: 'Confirmed consent status not configured' });
    }

    console.log(`[WABA webhook] Found confirmed status: "${confirmedStatus.label}" (${confirmedStatus._id})`);

    const lead = await Lead.findOne({ leadNumber: externalLeadId });

    if (!lead) {
      console.warn(`[WABA webhook] Lead not found: ${externalLeadId}`);
      return res.status(404).json({ ok: false, message: `Lead not found: ${externalLeadId}` });
    }

    console.log(`[WABA webhook] Found lead: ${lead._id} — updating consentStatus`);
    lead.consentStatus = confirmedStatus._id;
    await lead.save();

    console.log(`[WABA webhook] ✓ Lead ${externalLeadId} consentStatus → "${confirmedStatus.label}"`);
    res.json({ ok: true, leadId: lead._id, consentStatus: confirmedStatus.label });
  } catch (err) {
    console.error('[WABA webhook] ERROR:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
