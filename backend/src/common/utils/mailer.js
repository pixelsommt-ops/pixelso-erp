const nodemailer = require('nodemailer');
const config = require('../../config');

// Lazy singleton - transport cuma dibuat kalau kredensial ada, biar dev tanpa
// GMAIL_USER/GMAIL_APP_PASSWORD tidak crash saat boot (cuma gagal saat benar-benar kirim).
let transporter = null;
function getTransporter() {
  if (!config.gmailUser || !config.gmailAppPassword) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.gmailUser, pass: config.gmailAppPassword },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    throw new Error('Email belum dikonfigurasi (GMAIL_USER/GMAIL_APP_PASSWORD kosong)');
  }
  await t.sendMail({ from: `Pixelso <${config.gmailUser}>`, to, subject, html });
}

module.exports = { sendMail };
