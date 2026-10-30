const { sendTemplateMessage } = require('./waba.service');
const { firstName, displayName } = require('../utils/coinsShape');
const { sendPartnerWelcomeEmail } = require('../utils/email');

const TEMPLATE_NAME = process.env.WABA_WELCOME_TEMPLATE || 'mysilah_partner_welcome';

// WhatsApp: the welcome template with their first name and referral code, through Voycell.
async function sendWelcomeWhatsApp(user, name) {
  try {
    if (!user.phone) return { skipped: true, reason: 'no phone' };

    const result = await sendTemplateMessage({
      phone: user.phone,
      contactName: displayName(user.name),
      templateName: TEMPLATE_NAME,
      body: [name, user.referralCode],
    });
    if (result.error || result.skipped || result.status >= 400) console.log('[WABA welcome]', user._id, result);
    return result;
  } catch (err) {
    console.error('[WABA welcome]', user._id, err.message);
    return { error: err.message };
  }
}

async function sendWelcomeEmail(user, name) {
  try {
    if (!user.email) return { skipped: true, reason: 'no email' };
    return await sendPartnerWelcomeEmail({ to: user.email, name, code: user.referralCode });
  } catch (err) {
    console.error('[Welcome email]', user._id, err.message);
    return { error: err.message };
  }
}

// Welcome for a newly onboarded agent / super agent, on WhatsApp and by email.
// Each channel fails on its own without stopping the other. Never rejects.
async function sendPartnerWelcome(user) {
  if (!user?.referralCode) return { skipped: true, reason: 'no referral code' };
  const name = firstName(user.name) || 'Partner';
  const [whatsapp, email] = await Promise.all([sendWelcomeWhatsApp(user, name), sendWelcomeEmail(user, name)]);
  return { whatsapp, email };
}

module.exports = { sendPartnerWelcome };
