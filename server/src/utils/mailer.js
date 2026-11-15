const nodemailer = require('nodemailer');
const { smtp } = require('../config/env');
const logger = require('./logger');

let transporter = null;
if (smtp.host) {
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
}

// If SMTP is not configured we just log the mail (handy for local development).
async function sendMail({ to, subject, text }) {
  if (!transporter) {
    logger.info(`[MAIL not sent - SMTP not configured] To: ${to} | Subject: ${subject}\n${text}`);
    return { logged: true };
  }
  return transporter.sendMail({ from: smtp.from, to, subject, text });
}

module.exports = { sendMail };
