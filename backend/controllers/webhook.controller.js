const Lead           = require('../models/Lead');
const EmployeeStatus = require('../models/EmployeeStatus');

exports.wabaConsent = async (req, res) => {
  console.log('[WABA webhook] >>> HIT POST /api/webhooks/waba-consent');
  console.log('[WABA webhook] body:', JSON.stringify(req.body));

  try {
    // Voycell's actual callback sends `bankLeadId` (see
    // docs/superpowers/plans/2026-06-08-bank-crm-consent-integration.md in
    // the voycellcallcenter repo) — `externalLeadId` was this endpoint's own
    // original naming and never matched what Voycell actually sends. Kept
    // as a fallback in case anything else still calls this with the old name.
    const { bankLeadId, externalLeadId, consent, phone, consentId, respondedAt } = req.body;
    const leadRef = bankLeadId || externalLeadId;

    if (!leadRef) {
      console.warn('[WABA webhook] Missing bankLeadId/externalLeadId — rejected');
      return res.status(400).json({ ok: false, message: 'bankLeadId required' });
    }

    const normalizedConsent = String(consent).toLowerCase();
    // Voycell sends consent="no" both for an explicit "No" button click and
    // for a customer replying STOP (case-insensitive on Voycell's side) —
    // either way it lands here as "no" and gets recorded as declined.
    const statusPattern = normalizedConsent === 'yes' ? /confirm/i
      : normalizedConsent === 'no' ? /declin/i
      : null;

    if (!statusPattern) {
      console.log(`[WABA webhook] consent="${consent}" — no action taken`);
      return res.json({ ok: true, message: 'consent not yes/no — no action taken' });
    }

    console.log(`[WABA webhook] consent=${normalizedConsent} for bankLeadId=${leadRef}`);

    const targetStatus = await EmployeeStatus.findOne({
      statusType: 'whatsapp_consent',
      label: { $regex: statusPattern },
    }).lean();

    if (!targetStatus) {
      console.error(`[WABA webhook] No whatsapp_consent status matching ${statusPattern} in EmployeeStatus — add one in admin panel`);
      return res.status(500).json({ ok: false, message: 'Matching consent status not configured' });
    }

    console.log(`[WABA webhook] Found status: "${targetStatus.label}" (${targetStatus._id})`);

    // Try leadNumber first, then _id as fallback (sent when leadNumber was null at creation)
    let lead = await Lead.findOne({ leadNumber: leadRef });

    if (!lead && leadRef.match(/^[a-f\d]{24}$/i)) {
      lead = await Lead.findById(leadRef);
    }

    if (!lead) {
      console.warn(`[WABA webhook] Lead not found by leadNumber or _id: "${leadRef}" — ID format unrecognised, may be external test`);
      return res.status(404).json({ ok: false, message: `Lead not found: ${leadRef}` });
    }

    console.log(`[WABA webhook] Found lead: ${lead._id} — updating consentStatus`);
    lead.consentStatus = targetStatus._id;
    await lead.save();

    console.log(`[WABA webhook] ✓ Lead ${leadRef} consentStatus → "${targetStatus.label}"`);
    res.json({ ok: true, leadId: lead._id, consentStatus: targetStatus.label });
  } catch (err) {
    console.error('[WABA webhook] ERROR:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
};
