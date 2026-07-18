// src/utils/mailer.js
const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: '/usr/sbin/sendmail',
});

async function sendDigestEmail(subject, textBody) {
  if (!config.alerting.emailTo) {
    console.warn('ALERT_EMAIL_TO not configured; skipping digest email. Body was:\n', textBody);
    return;
  }
  try {
    await transporter.sendMail({
      from: config.alerting.emailFrom,
      to: config.alerting.emailTo,
      subject,
      text: textBody,
    });
  } catch (err) {
    console.error('Failed to send digest email:', err.message);
  }
}

module.exports = { sendDigestEmail };
