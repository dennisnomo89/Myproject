const nodemailer = require('nodemailer');
const { mail, env } = require('../config');
const { EmailLog } = require('../models');

// Tests never send real email, even if SMTP is configured in .env.
const transport = mail.host && env !== 'test'
  ? nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  })
  : null;

// Sends one email and records it in the email log. Never throws: failures are logged with status "failed".
async function sendEmail({ to, user, event, subject, text, html }) {
  const entry = { to, UserId: user ? user.id : null, event, subject, text, html };
  if (!transport) return EmailLog.create({ ...entry, status: 'logged' });
  try {
    await transport.sendMail({ from: mail.from, to, subject, text, html });
    return EmailLog.create({ ...entry, status: 'sent' });
  } catch (err) {
    console.error(`Email to ${to} failed:`, err.message);
    return EmailLog.create({ ...entry, status: 'failed', error: err.message });
  }
}

module.exports = { sendEmail, isLive: Boolean(transport) };
