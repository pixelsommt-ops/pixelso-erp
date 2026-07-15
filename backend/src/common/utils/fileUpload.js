const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../errors/ApiError');
const config = require('../../config');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

// Aturan berbeda per kind, dipakai lintas modul (storefront checkout & pricing katalog):
// - proof: bukti transfer pelanggan (gambar, dikompres client-side dulu)
// - design: file desain cetak pelanggan (TIDAK direkompresi - jaga kualitas cetak). Divalidasi
//   pakai EKSTENSI nama file, bukan MIME type dari browser - untuk format desain profesional
//   (AI/CDR/PSD/STL) browser sering melaporkan MIME kosong atau "application/octet-stream" jadi
//   whitelist MIME tidak bisa diandalkan. genericDataUrlRegex cuma memastikan strukturnya data
//   URL base64 yang valid, apapun MIME-nya.
// - photo: foto produk yang diupload staf lewat Pricing Settings (gambar, tidak direkompresi)
const KIND_RULES = {
  proof: {
    regex: /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
    get maxBytes() { return config.storefrontUploadMaxProofBytes; },
  },
  design: {
    genericDataUrlRegex: /^data:([^;]*);base64,([A-Za-z0-9+/=]+)$/,
    allowedExtensions: ['pdf', 'ai', 'cdr', 'psd', 'jpg', 'jpeg', 'png', 'zip', 'rar', 'stl'],
    get maxBytes() { return config.storefrontUploadMaxDesignBytes; },
  },
  photo: {
    regex: /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
    get maxBytes() { return config.pricingUploadMaxPhotoBytes; },
  },
};

async function saveUpload({ dataUrl, filename, kind }) {
  const rule = KIND_RULES[kind] || KIND_RULES.design;
  let base64;
  let ext;

  if (rule.allowedExtensions) {
    const match = String(dataUrl || '').match(rule.genericDataUrlRegex);
    if (!match) {
      throw new ApiError(422, 'Unsupported file format');
    }
    base64 = match[2];
    ext = path.extname(String(filename || '')).slice(1).toLowerCase();
    if (!rule.allowedExtensions.includes(ext)) {
      throw new ApiError(422, `Format file tidak didukung. Format yang diterima: ${rule.allowedExtensions.join(', ').toUpperCase()}`);
    }
    if (ext === 'jpeg') ext = 'jpg';
  } else {
    const match = String(dataUrl || '').match(rule.regex);
    if (!match) {
      throw new ApiError(422, 'Unsupported file format');
    }
    base64 = match[match.length - 1];
    const mimeSubtype = match[1].includes('/') ? match[1].split('/')[1] : match[1];
    ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype === 'pdf' ? 'pdf' : mimeSubtype;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > rule.maxBytes) {
    throw new ApiError(413, 'File too large');
  }
  const safeStem = path
    .basename(String(filename || kind), path.extname(String(filename || '')))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || kind;
  const fileName = `${kind}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeStem}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer, { mode: 0o640 });
  return `/uploads/${fileName}`;
}

module.exports = { saveUpload };
