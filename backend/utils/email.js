const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    // console.log(`[SMTP] host=${process.env.SMTP_HOST} port=${process.env.SMTP_PORT} secure=${process.env.SMTP_SECURE} user=${process.env.SMTP_USER}`);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendInviteEmail = async ({ to, inviteUrl }) => {
  const t = getTransporter();
  const subject = 'You have been invited to MySilah';
  const html = `
    <p>You have been invited to join MySilah.</p>
    <p>Click the link below to set your password and activate your account:</p>
    <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — SMTP not configured]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Invite URL: ${inviteUrl}\n`);
    return { dev: true, inviteUrl };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@mysilah.ae',
    to,
    subject,
    html,
  });
  return { dev: false };
};

const sendInquiryNotification = async ({ name, email, phone, companyName, message, queryType }) => {
  const t = getTransporter();
  const to = process.env.INQUIRY_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  const typeLabel = { support: 'Support', other: 'Other' }[queryType] || 'General Query';
  const subject = queryType === 'other' ? `New Request from ${name}` : `New ${typeLabel} Request from ${name}`;
  const html = `
    <h2>New site inquiry</h2>
    <table>
      <tr><td><strong>Name</strong></td><td>${name}</td></tr>
      <tr><td><strong>Email</strong></td><td>${email}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
      <tr><td><strong>Company</strong></td><td>${companyName || '—'}</td></tr>
      <tr><td><strong>Query type</strong></td><td>${typeLabel}</td></tr>
    </table>
    <p><strong>Message:</strong></p>
    <p>${(message || '').replace(/\n/g, '<br>')}</p>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — INQUIRY]');
    console.log(`To: ${to}`);
    console.log(`From: ${name} <${email}>`);
    console.log(`Message: ${message}\n`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@mysilah.ae',
    to,
    subject,
    html,
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl, name }) => {
  const t = getTransporter();
  const subject = 'Reset your MySilah password';
  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your MySilah password.</p>
    <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a></p>
    <p>Or copy this URL: ${resetUrl}</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — PASSWORD RESET]');
    console.log(`To: ${to}`);
    console.log(`Reset URL: ${resetUrl}\n`);
    return { dev: true, resetUrl };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@mysilah.ae',
    to,
    subject,
    html,
  });
  return { dev: false };
};

const sendInquiryConfirmation = async ({ name, email }) => {
  const t = getTransporter();
  const subject = 'Thanks for reaching out — MySilah';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
      <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:32px 36px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">MySilah</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.72);font-size:13px;">UAE Banking Referral Infrastructure</p>
      </div>
      <div style="background:#fff;padding:32px 36px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:16px;font-weight:600;margin:0 0 12px;">Hi ${name},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
          Thank you for getting in touch with us. We've received your inquiry and our team will review it shortly.
        </p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
          We typically respond within <strong>1–2 business days</strong>. If your matter is urgent, feel free to reach out directly.
        </p>
        <div style="background:#f8fafc;border-left:4px solid #6d28d9;border-radius:4px;padding:14px 18px;margin-bottom:28px;">
          <p style="margin:0;font-size:13px;color:#64748b;">Our team will contact you at this email address.</p>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin:0;">— The MySilah Team</p>
      </div>
    </div>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — INQUIRY CONFIRMATION]');
    console.log(`To: ${email}`);
    return;
  }

  await t.sendMail({
    from: `MySilah <${process.env.SMTP_FROM || 'no-reply@mysilah.ae'}>`,
    to: email,
    subject,
    html,
  });
};

const escapeHtml = (str = '') =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const htmlLines = (str = '') => escapeHtml(str).replace(/\r?\n/g, '<br>');

// Reply to a website request (SiteInquiry), sent through the reply-only SMTP
// account saved by the admin (ReplySmtpSettings) — not the env SMTP.
// bodyHtml must already be sanitized (utils/emailHtml.sanitizeEmailHtml);
// bodyText is its plain-text twin. attachments: nodemailer attachment objects.
const sendInquiryReply = async ({ smtp, to, cc, bcc, name, subject, bodyHtml, bodyText, attachments, senderName, original }) => {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: !!smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  const receivedOn = original?.createdAt
    ? new Date(original.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
    : '';
  const html = `
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:600px;margin:0 auto;color:#1e293b;">
        <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:28px 36px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">MySilah</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.72);font-size:13px;">UAE Banking Referral Infrastructure</p>
        </div>
        <div style="background:#fff;padding:32px 36px;border:1px solid #e2e8f0;border-top:none;">
          <p style="font-size:15px;margin:0 0 16px;">${name ? `Dear ${escapeHtml(name)},` : 'Hello,'}</p>
          <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 16px;">Thank you for contacting MySilah. Please find our response to your request below.</p>
          <div style="font-size:14px;color:#1e293b;line-height:1.7;margin:0 0 24px;">${bodyHtml}</div>
          <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 4px;">If you have any further questions, simply reply to this email and we will be happy to help.</p>
          <p style="font-size:14px;color:#334155;line-height:1.7;margin:20px 0 0;">
            Best regards,<br>
            <strong>${escapeHtml(senderName || 'MySilah Team')}</strong><br>
            <span style="color:#64748b;">MySilah Team</span>
          </p>
          ${original?.message ? `
          <div style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:18px;">
            <p style="font-size:12px;color:#64748b;margin:0 0 8px;">Your original message${receivedOn ? ` (${receivedOn})` : ''}:</p>
            <div style="background:#f8fafc;border-left:4px solid #6d28d9;border-radius:4px;padding:12px 16px;font-size:13px;color:#475569;line-height:1.6;">${htmlLines(original.message)}</div>
          </div>` : ''}
        </div>
        <div style="background:#f8fafc;padding:16px 36px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">This email is a reply to your request submitted on <a href="https://mysilah.ae" style="color:#6d28d9;text-decoration:none;">mysilah.ae</a>.</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    name ? `Dear ${name},` : 'Hello,',
    '',
    'Thank you for contacting MySilah. Please find our response to your request below.',
    '',
    bodyText,
    '',
    'If you have any further questions, simply reply to this email and we will be happy to help.',
    '',
    'Best regards,',
    senderName || 'MySilah Team',
    'MySilah Team',
    ...(original?.message ? ['', `--- Your original message${receivedOn ? ` (${receivedOn})` : ''} ---`, original.message] : []),
  ].join('\n');

  const from = smtp.fromEmail || smtp.user;
  await transport.sendMail({
    from: `"${(smtp.fromName || 'MySilah').replace(/"/g, '')}" <${from}>`,
    replyTo: from,
    ...(to?.length ? { to } : {}),
    ...(cc?.length ? { cc } : {}),
    ...(bcc?.length ? { bcc } : {}),
    subject,
    html,
    text,
    attachments: attachments || [],
  });
};

const sendEmailVerification = async ({ to, verifyUrl, name }) => {
  const t = getTransporter();
  const subject = 'Verify your email — MySilah';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
      <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:32px 36px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">MySilah</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.72);font-size:13px;">UAE Banking Referral Infrastructure</p>
      </div>
      <div style="background:#fff;padding:32px 36px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:16px;font-weight:600;margin:0 0 12px;">Hi ${name || 'there'},</p>
        <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
          Thanks for registering. Please verify your email address to activate your agent account.
        </p>
        <p style="text-align:center;margin:0 0 24px;">
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Verify Email Address</a>
        </p>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 8px;">Or copy this link: ${verifyUrl}</p>
        <p style="font-size:12px;color:#cbd5e1;margin:0;">This link expires in <strong>24 hours</strong>. If you did not register, ignore this email.</p>
      </div>
    </div>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — EMAIL VERIFICATION]');
    console.log(`To: ${to}`);
    console.log(`Verify URL: ${verifyUrl}\n`);
    return { dev: true, verifyUrl };
  }

  await t.sendMail({
    from: `MySilah <${process.env.SMTP_FROM || 'no-reply@mysilah.ae'}>`,
    to,
    subject,
    html,
  });
  return { dev: false };
};

module.exports = { sendInviteEmail, sendInquiryNotification, sendInquiryConfirmation, sendPasswordResetEmail, sendEmailVerification, sendInquiryReply };
