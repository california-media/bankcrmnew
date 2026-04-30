const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
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

module.exports = { sendInviteEmail };
