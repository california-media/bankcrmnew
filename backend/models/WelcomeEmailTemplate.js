const mongoose = require('mongoose');

// Singleton — the admin-designed partner welcome email (Admin → Email
// Settings → Welcome Email), sent to new agents and super agents. While
// `enabled` is off the built-in design (utils/partnerWelcomeEmail.js) is sent.
// {{field}} placeholders are filled per partner — see WELCOME_FIELDS.

const DEFAULT_SUBJECT = 'Welcome to MySilah';

// Starting text for the editor (client copy, 2026-10-31).
const DEFAULT_BODY = [
  '<h2>Welcome to MySilah</h2>',
  '<p>Hi {{name}}, welcome aboard! 🎉</p>',
  '<p>You are now a registered <strong>MySilah Referral Partner</strong>. Refer your network for financial products and earn rewards on every successful referral.</p>',
  '<p>Your partner code: <strong>{{referral_code}}</strong></p>',
  '<p><strong>Start earning in 3 steps:</strong></p>',
  '<ol><li>Sign in to MySilah</li>',
  '<li>Submit a lead or share your referral link</li>',
  '<li>Track every lead and see your rewards move from Pending to Paid</li></ol>',
  '<p>MySilah will never ask for your UAE PASS PIN or OTP.</p>',
  '<p><a href="{{sign_in_link}}">Sign in to MySilah</a></p>',
].join('');

const welcomeEmailTemplateSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    subject: { type: String, trim: true, default: DEFAULT_SUBJECT },
    bodyHtml: { type: String, default: DEFAULT_BODY },
    // Files sent with every welcome email (public S3 links, email-attachments/).
    attachments: {
      type: [{
        name: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number, default: 0 },
        contentType: { type: String, default: '' },
        _id: false,
      }],
      default: [],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Until an admin saves the design, it follows the defaults above (nothing is
// written on read) — so changing the default text reaches the editor.
welcomeEmailTemplateSchema.statics.getSingleton = async function () {
  const doc = (await this.findOne()) || new this({});
  if (!doc.updatedBy) {
    doc.subject = DEFAULT_SUBJECT;
    doc.bodyHtml = DEFAULT_BODY;
  }
  return doc;
};

module.exports = mongoose.model('WelcomeEmailTemplate', welcomeEmailTemplateSchema);
