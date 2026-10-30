// Welcome email for a new referral partner (agent / super agent) — the same
// design as the WhatsApp welcome image, as email-safe HTML (tables + inline
// styles). The logo and QR code are inline attachments: cid:logo / cid:qr.

const escapeHtml = (str = '') =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const FONT = "font-family:Helvetica,Arial,sans-serif;";
const SUPPORT_PHONE = '+971 45722603';
const SUPPORT_EMAIL = 'support@mysilah.ae';

const PRODUCTS = [
  ['Credit cards', '#EAF0FF', '#3346C9'],
  ['Personal loans', '#F2EAFF', '#7A3DD6'],
  ['Car loans', '#E6F6FD', '#1E6FA8'],
  ['Mortgages', '#E7F7EE', '#1E7F4F'],
  ['Business loans', '#FFF3E0', '#A15C07'],
  ['Current accounts', '#EAF0FF', '#3346C9'],
  ['Payment solutions', '#F2EAFF', '#7A3DD6'],
  ['Business accounts', '#E7F7EE', '#1E7F4F'],
  ['Personal accounts', '#EAF0FF', '#3346C9'],
  ['POS loans', '#FFF3E0', '#A15C07'],
  ['POS machine', '#F2EAFF', '#7A3DD6'],
];

const STEPS = [
  ['1', '#4F46E5', 'Sign in', 'Sign in to MySilah on the web, securely with UAE PASS.'],
  ['2', '#7C3AED', 'Refer your network', 'Submit a lead yourself or share your link. They confirm consent on WhatsApp.'],
  ['3', '#C026D3', 'Track and earn', 'Follow every lead and see your rewards move from Pending to Paid.'],
];

const partnerWelcomeSubject = ({ name }) => `Welcome aboard, ${name}! Your MySilah partner code`;

const partnerWelcomeHtml = ({ name, code, appUrl }) => {
  const n = escapeHtml(name);
  const c = escapeHtml(code);
  const year = new Date().getFullYear();

  const steps = STEPS.map(([num, color, title, text]) => `
          <td width="33%" valign="top" style="padding:0 5px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FD;border-radius:10px;">
              <tr><td style="padding:14px;">
                <div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${color};color:#ffffff;text-align:center;${FONT}font-size:13px;font-weight:bold;">${num}</div>
                <p style="margin:10px 0 4px;${FONT}font-size:14px;font-weight:bold;color:#0A0C2E;">${title}</p>
                <p style="margin:0;${FONT}font-size:12px;line-height:18px;color:#5B6080;">${text}</p>
              </td></tr>
            </table>
          </td>`).join('');

  const pills = PRODUCTS.map(([label, bg, fg]) =>
    `<span style="display:inline-block;margin:0 6px 8px 0;padding:6px 14px;border-radius:16px;background:${bg};color:${fg};${FONT}font-size:13px;font-weight:bold;">${label}</span>`).join('');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to MySilah</title></head>
<body style="margin:0;padding:0;background:#EEF1F8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;">

  <tr><td style="padding:24px 28px 16px;">
    <img src="cid:logo" width="196" height="45" alt="MySilah" style="display:block;border:0;">
  </td></tr>

  <tr><td style="padding:0 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#EEF0FF" style="background:#EEF0FF;background-image:linear-gradient(135deg,#EAF2FF,#F3EEFF);border-radius:14px;">
      <tr><td style="padding:26px 26px 28px;">
        <p style="margin:0 0 10px;${FONT}font-size:12px;font-weight:bold;letter-spacing:2px;color:#5B4DFF;">REFERRAL PARTNER</p>
        <h1 style="margin:0 0 14px;${FONT}font-size:30px;line-height:36px;font-weight:bold;color:#0A0C2E;">Welcome aboard, ${n}!</h1>
        <p style="margin:0 0 18px;${FONT}font-size:15px;line-height:24px;color:#3D4270;">You are now a registered <strong>MySilah Referral Partner</strong>. Refer your network for financial products, and earn rewards on every successful referral.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px dashed #7A6CFF;">
          <tr><td style="padding:8px 16px 9px 14px;">
            <p style="margin:0 0 2px;${FONT}font-size:10px;font-weight:bold;letter-spacing:1px;color:#6B6E96;">YOUR PARTNER CODE</p>
            <p style="margin:0;${FONT}font-size:19px;font-weight:bold;letter-spacing:1.5px;color:#1B1F7A;">${c}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:26px 23px 8px;">
    <p style="margin:0 0 14px 5px;${FONT}font-size:19px;font-weight:bold;color:#0A0C2E;">Start earning in 3 steps</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${steps}
    </tr></table>
  </td></tr>

  <tr><td style="padding:20px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#5B5BFF" style="background:#5B5BFF;background-image:linear-gradient(90deg,#2E8BFF,#8B3DFF);border-radius:14px;">
      <tr>
        <td style="padding:22px 0 22px 26px;">
          <p style="margin:0 0 4px;${FONT}font-size:20px;font-weight:bold;color:#ffffff;">Ready for your first referral?</p>
          <p style="margin:0;${FONT}font-size:13px;color:#E6E8FF;">It takes about a minute to submit a lead.</p>
        </td>
        <td align="right" style="padding:22px 26px 22px 12px;">
          <a href="${appUrl}" style="display:inline-block;padding:11px 24px;border-radius:22px;background:#ffffff;color:#3B2FD9;${FONT}font-size:15px;font-weight:bold;text-decoration:none;white-space:nowrap;">Sign in &rsaquo;</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F4FC;border:1px solid #DDE3F3;">
      <tr>
        <td valign="top" style="padding:24px 12px 24px 26px;">
          <p style="margin:0 0 8px;${FONT}font-size:12px;font-weight:bold;letter-spacing:2px;color:#5B4DFF;">WELCOME BONUS</p>
          <p style="margin:0 0 12px;${FONT}font-size:21px;line-height:28px;font-weight:bold;color:#0A0C2E;">AED 100 off your next holiday</p>
          <p style="margin:0 0 12px;${FONT}font-size:14px;line-height:22px;color:#3D4270;">Scan the QR code to register and claim your voucher at <strong>holidaymarket.ae</strong>. Redeem it on your next holiday booking.</p>
          <p style="margin:0;${FONT}font-size:12px;line-height:18px;color:#6B6E96;">Voucher is offered by holidaymarket.ae and subject to its terms. One voucher per partner.</p>
        </td>
        <td valign="top" align="center" width="170" style="padding:24px 26px 24px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #DDE3F3;border-radius:6px;">
            <tr><td style="padding:10px;"><img src="cid:qr" width="146" height="146" alt="QR code to claim your voucher" style="display:block;border:0;"></td></tr>
          </table>
          <p style="margin:8px 0 0;${FONT}font-size:12px;color:#6B6E96;">Scan to claim</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:26px 28px 6px;">
    <p style="margin:0 0 14px;${FONT}font-size:19px;font-weight:bold;color:#0A0C2E;">What you can refer</p>
    <div>${pills}</div>
  </td></tr>

  <tr><td style="padding:12px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E6;border:1px solid #F1DFA6;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;${FONT}font-size:13px;font-weight:bold;color:#5B4A12;">Good to know</p>
        <p style="margin:0;${FONT}font-size:13px;line-height:20px;color:#5B4A12;">Always get consent from the person you refer before you submit a referral. Rewards follow the MySilah <a href="${appUrl}/terms" style="color:#5B4A12;font-weight:bold;text-decoration:underline;">Terms and Clawback Policy</a>, including the retention period for each product.</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 28px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:16px;">
        <div style="width:46px;height:46px;line-height:46px;border-radius:23px;background:#EEF0FF;color:#5B4DFF;text-align:center;${FONT}font-size:20px;font-weight:bold;">?</div>
      </td>
      <td valign="top">
        <p style="margin:2px 0 2px;${FONT}font-size:16px;font-weight:bold;color:#5B4DFF;">Need help?</p>
        <p style="margin:0;${FONT}font-size:14px;line-height:21px;color:#0A0C2E;">Call us on <strong>${SUPPORT_PHONE}</strong> or email <a href="mailto:${SUPPORT_EMAIL}" style="color:#5B4DFF;font-weight:bold;">${SUPPORT_EMAIL}</a></p>
      </td>
    </tr></table>
  </td></tr>

  <tr><td bgcolor="#22228A" style="background:#22228A;background-image:linear-gradient(135deg,#1B1B5E,#2A2AA0);border-radius:0 0 16px 16px;padding:28px 36px;">
    <p style="margin:0 0 6px;${FONT}font-size:16px;font-weight:bold;color:#ffffff;">Important updates from MySilah</p>
    <p style="margin:0 0 18px;${FONT}font-size:12px;line-height:19px;color:#D6D8F5;">To make sure you never miss an update, add us to your contacts or mark this email as &ldquo;Primary&rdquo;.</p>
    <div style="border-top:1px solid #4A4AA8;margin:0 0 16px;font-size:0;line-height:0;">&nbsp;</div>
    <p style="margin:0 0 16px;${FONT}font-size:12px;line-height:19px;color:#ffffff;"><strong>Stay safe.</strong> MySilah will never ask for your password, UAE PASS PIN or one-time code by email, phone or WhatsApp.</p>
    <p style="margin:0 0 6px;${FONT}font-size:11px;line-height:17px;color:#B9BCE8;">You received this message because you registered as a Referral Partner with MySilah.</p>
    <p style="margin:0 0 6px;${FONT}font-size:11px;color:#ffffff;"><a href="${appUrl}/privacy" style="color:#ffffff;">Privacy policy</a> &nbsp;|&nbsp; <a href="${appUrl}/terms" style="color:#ffffff;">Terms and conditions</a> &nbsp;|&nbsp; <a href="${appUrl}/agent/settings" style="color:#ffffff;">Email preferences</a></p>
    <p style="margin:0;${FONT}font-size:11px;color:#B9BCE8;">&copy; ${year} Silah L.L.C-FZ. Dubai</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

// Plain-text part — some inboxes show only this, and it helps deliverability.
const partnerWelcomeText = ({ name, code, appUrl }) => `Welcome aboard, ${name}!

You are now a registered MySilah Referral Partner. Refer your network for financial products, and earn rewards on every successful referral.

Your partner code: ${code}

Start earning in 3 steps:
${STEPS.map(([num, , title, text]) => `${num}. ${title}: ${text}`).join('\n')}

Sign in: ${appUrl}

Welcome bonus: AED 100 off your next holiday. Scan the QR code in this email to register and claim your voucher at holidaymarket.ae.

What you can refer: ${PRODUCTS.map(([label]) => label).join(', ')}.

Good to know: always get consent from the person you refer before you submit a referral. Rewards follow the MySilah Terms and Clawback Policy: ${appUrl}/terms

Need help? Call us on ${SUPPORT_PHONE} or email ${SUPPORT_EMAIL}.

MySilah will never ask for your password, UAE PASS PIN or one-time code by email, phone or WhatsApp.
`;

module.exports = { partnerWelcomeSubject, partnerWelcomeHtml, partnerWelcomeText };
