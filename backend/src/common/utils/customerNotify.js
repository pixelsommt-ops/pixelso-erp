// Email notifikasi customer (nota invoice, status PO ready) - lihat pos.service.js dan
// production-orders.service.js untuk titik pemicunya. Gagal kirim TIDAK BOLEH menggagalkan
// operasi utama (buat invoice / ubah status) - cuma dicatat di log, customer tanpa email
// tersimpan dilewati diam-diam (sengaja, sesuai keputusan produk).
const { sendMail } = require('./mailer');

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );
}

async function notifyCustomerByEmail(customer, subject, html) {
  if (!customer?.email) return;
  try {
    await sendMail({ to: customer.email, subject, html });
  } catch (err) {
    console.error(`[customerNotify] Gagal kirim email ke ${customer.email}: ${err.message}`);
  }
}

module.exports = { notifyCustomerByEmail, formatRupiah };
