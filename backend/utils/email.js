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

module.exports = { sendInviteEmail, sendInquiryNotification, sendPasswordResetEmail };
