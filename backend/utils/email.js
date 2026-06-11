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
  const subject = 'You have been invited to Bank CRM';
  const html = `
    <p>You have been invited to join Bank CRM.</p>
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
    from: process.env.SMTP_FROM || 'no-reply@bankcrm.local',
    to,
    subject,
    html,
  });
  return { dev: false };
};

const sendInquiryNotification = async ({ name, email, phone, companyName, message }) => {
  const t = getTransporter();
  const to = process.env.INQUIRY_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  const subject = `New Inquiry from ${name}`;
  const html = `
    <h2>New site inquiry</h2>
    <table>
      <tr><td><strong>Name</strong></td><td>${name}</td></tr>
      <tr><td><strong>Email</strong></td><td>${email}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
      <tr><td><strong>Company</strong></td><td>${companyName || '—'}</td></tr>
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
    from: process.env.SMTP_FROM || 'no-reply@bankcrm.local',
    to,
    subject,
    html,
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl, name }) => {
  const t = getTransporter();
  const subject = 'Reset your Bank CRM password';
  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>We received a request to reset your Bank CRM password.</p>
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
    from: process.env.SMTP_FROM || 'no-reply@bankcrm.local',
    to,
    subject,
    html,
  });
  return { dev: false };
};

const sendInquiryConfirmation = async ({ name, email }) => {
  const t = getTransporter();
  const subject = 'Thanks for reaching out — Inizio Global';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
      <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:32px 36px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Inizio Global</h1>
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
        <p style="font-size:13px;color:#94a3b8;margin:0;">— The Inizio Global Team</p>
      </div>
    </div>
  `;

  if (!t) {
    console.log('\n[DEV EMAIL — INQUIRY CONFIRMATION]');
    console.log(`To: ${email}`);
    return;
  }

  await t.sendMail({
    from: `Inizio Global <${process.env.SMTP_FROM || 'no-reply@inizioglobal.com'}>`,
    to: email,
    subject,
    html,
  });
};

module.exports = { sendInviteEmail, sendInquiryNotification, sendInquiryConfirmation, sendPasswordResetEmail };
