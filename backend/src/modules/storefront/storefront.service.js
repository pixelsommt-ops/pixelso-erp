const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../../db/prisma');
const config = require('../../config');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS } = require('../../common/constants');
const pricingService = require('../pricing/pricing.service');
const settingsService = require('../settings/settings.service');
const promoService = require('../promo/promo.service');
const themeService = require('../theme/theme.service');
const { generatePoNumber } = require('../production-orders/production-orders.service');
const { calculatePrintPrice } = require('./storefront.calculator');
const { sendMail } = require('../../common/utils/mailer');

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam

// Status internal PO dipetakan ke label ramah pelanggan - pelanggan tidak pernah lihat status mentah.
const CUSTOMER_STATUS_LABELS = {
  [PO_STATUS.DRAFT]: 'Menunggu Konfirmasi',
  [PO_STATUS.APPROVED]: 'Menunggu Konfirmasi',
  [PO_STATUS.POS]: 'Menunggu Verifikasi Pembayaran',
  [PO_STATUS.MATERIAL]: 'Sedang Diproses',
  [PO_STATUS.HOLD]: 'Ditunda',
  [PO_STATUS.QUEUE]: 'Sedang Diproses',
  [PO_STATUS.PRODUCTION]: 'Sedang Dicetak',
  [PO_STATUS.QC]: 'Sedang Diperiksa',
  [PO_STATUS.REWORK]: 'Sedang Diperiksa',
  [PO_STATUS.READY]: 'Siap Diambil/Dikirim',
  [PO_STATUS.COMPLAINT]: 'Sedang Ditinjau',
  [PO_STATUS.DONE]: 'Selesai',
};

// Ringkasan pilihan opsi produk yang bisa dibaca staff - disuntik ke depan specNote supaya
// tetap terlihat di kolom Catatan halaman Production Order tanpa perlu ubah halaman staff itu.
function buildSpecNote(selectedOptionsSnapshot, customerNote) {
  const optionsSummary = (selectedOptionsSnapshot || [])
    .map((o) => `${o.groupLabel}: ${o.choiceLabel}`)
    .join('; ');
  return [optionsSummary, customerNote].filter(Boolean).join(' | ') || null;
}

let systemUserIdCache = null;
async function getSystemUserId() {
  if (systemUserIdCache) return systemUserIdCache;
  const user = await prisma.user.findFirst({ where: { isSystem: true } });
  if (!user) {
    throw new ApiError(500, 'Storefront system user not seeded - run prisma/seed.js');
  }
  systemUserIdCache = user.userId;
  return systemUserIdCache;
}

function issueToken(customer) {
  const token = jwt.sign(
    { customerId: customer.customerId, kind: 'customer' },
    config.customerJwtSecret,
    { expiresIn: config.customerJwtExpiresIn }
  );
  return { token, customer: { customerId: customer.customerId, name: customer.name, email: customer.email } };
}

async function register({ name, email, phone, password }) {
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'password must be at least 6 characters');
  }
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }
  const hashed = await bcrypt.hash(password, 10);
  const customer = await prisma.customer.create({
    data: { name, email, phone, password: hashed, source: 'storefront' },
  });
  return issueToken(customer);
}

async function login({ email, password }) {
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !customer.password) {
    throw new ApiError(401, 'Invalid credentials');
  }
  const valid = await bcrypt.compare(password, customer.password);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }
  return issueToken(customer);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function requestPasswordReset(email) {
  if (!email) {
    throw new ApiError(400, 'email is required');
  }
  const customer = await prisma.customer.findUnique({ where: { email } });
  // Selalu balas sukses meski email tidak terdaftar/tidak punya password (akun Google-only) -
  // supaya endpoint ini tidak bisa dipakai mengecek email mana yang sudah punya akun customer.
  if (customer && customer.password) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.customer.update({
      where: { customerId: customer.customerId },
      data: {
        resetTokenHash: hashToken(rawToken),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const resetUrl = `${config.storefrontUrl}/reset-password?token=${rawToken}`;
    await sendMail({
      to: customer.email,
      subject: 'Reset Password Akun Pixelso',
      html: `
        <p>Halo ${customer.name},</p>
        <p>Ada permintaan reset password untuk akun Pixelso Anda. Klik link di bawah untuk membuat password baru (berlaku 1 jam):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Kalau Anda tidak merasa meminta ini, abaikan saja email ini.</p>
      `,
    });
  }
  return { message: 'Kalau email terdaftar, link reset password sudah dikirim.' };
}

async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw new ApiError(400, 'token and password are required');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'password must be at least 6 characters');
  }
  const customer = await prisma.customer.findFirst({
    where: { resetTokenHash: hashToken(token), resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!customer) {
    throw new ApiError(400, 'Link reset password tidak valid atau sudah kedaluwarsa');
  }
  const hashed = await bcrypt.hash(password, 10);
  await prisma.customer.update({
    where: { customerId: customer.customerId },
    data: { password: hashed, resetTokenHash: null, resetTokenExpiresAt: null },
  });
  return { message: 'Password berhasil diubah' };
}

async function googleLogin(idToken) {
  if (!googleClient) {
    throw new ApiError(500, 'Login Google belum dikonfigurasi di server');
  }
  if (!idToken) {
    throw new ApiError(400, 'idToken is required');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    throw new ApiError(401, 'Token Google tidak valid');
  }

  const { sub: googleId, email, name } = payload;
  if (!email) {
    throw new ApiError(400, 'Akun Google tidak punya email');
  }

  let customer = await prisma.customer.findFirst({ where: { OR: [{ googleId }, { email }] } });
  if (customer) {
    if (!customer.googleId) {
      // Email sudah terdaftar lewat form biasa - tautkan akun Google ke situ, jangan buat duplikat.
      customer = await prisma.customer.update({ where: { customerId: customer.customerId }, data: { googleId } });
    }
  } else {
    customer = await prisma.customer.create({
      data: { name: name || email, email, googleId, source: 'storefront-google' },
    });
  }

  return issueToken(customer);
}

async function getCatalog() {
  return pricingService.getPublicPricing();
}

// Tema event (kalau ada yang aktif) ikut dikirim di sini, bukan endpoint terpisah - storefront
// sudah panggil ini sekali di setiap load, lebih hemat daripada request tambahan.
async function getSiteSettings() {
  const [settings, activeTheme] = await Promise.all([
    settingsService.getPublicSettings(),
    themeService.getActiveTheme(),
  ]);
  return { ...settings, activeTheme: activeTheme || null };
}

async function getPromos() {
  return promoService.getPublicPromos();
}

async function checkout(customerId, body) {
  const { items, paymentMethod, paymentProofUrl, notes } = body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items must be a non-empty array');
  }
  if (!paymentMethod) {
    throw new ApiError(400, 'paymentMethod is required');
  }
  if (!paymentProofUrl) {
    throw new ApiError(400, 'paymentProofUrl is required (upload payment proof before checkout)');
  }

  const pricingConfig = await pricingService.getPublicPricing();
  const priced = items.map((item) => {
    const result = calculatePrintPrice(pricingConfig, item);
    if (!result.valid) {
      throw new ApiError(400, `Invalid item '${item.productKey}': ${result.message}`);
    }
    return { item, result };
  });

  const productKeys = [...new Set(priced.map(({ item }) => item.productKey))];
  const products = await prisma.product.findMany({
    where: { printProduct: { key: { in: productKeys } } },
    include: { printProduct: true },
  });
  const productByKey = new Map(products.map((p) => [p.printProduct.key, p]));
  for (const key of productKeys) {
    if (!productByKey.has(key)) {
      throw new ApiError(500, `No Product row linked to PrintProduct key '${key}' - reseed required`);
    }
  }

  const total = priced.reduce((sum, { result }) => sum + result.total, 0);
  const [poNumber, systemUserId] = await Promise.all([generatePoNumber(), getSystemUserId()]);

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        poNumber,
        customerId,
        designerId: systemUserId,
        status: PO_STATUS.POS,
        notes,
        poDetails: {
          create: priced.map(({ item, result }) => ({
            productId: productByKey.get(item.productKey).productId,
            qty: result.quantity,
            size: `${result.width}x${result.height}cm`,
            fileUrl: item.fileUrl || null,
            designLink: item.designLink || null,
            specNote: buildSpecNote(result.selectedOptionsSnapshot, item.specNote),
            unitPrice: result.base,
            lineTotal: result.total,
            widthCm: result.width,
            heightCm: result.height,
            selectedOptions: result.selectedOptionsSnapshot,
            needDesign: Boolean(item.needDesign),
          })),
        },
      },
      include: { poDetails: true },
    });

    const sale = await tx.salesPos.create({
      data: {
        poId: order.poId,
        cashierId: systemUserId,
        total,
        dp: 0,
        paidStatus: 'unpaid',
        payments: {
          create: [{ method: paymentMethod, amount: total, status: 'pending', proofUrl: paymentProofUrl }],
        },
      },
      include: { payments: true },
    });

    return { poId: order.poId, poNumber: order.poNumber, status: order.status, total, sale };
  });
}

async function listMyOrders(customerId) {
  const orders = await prisma.productionOrder.findMany({
    where: { customerId },
    include: { salesPos: { include: { payments: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map((o) => ({
    poId: o.poId,
    poNumber: o.poNumber,
    createdAt: o.createdAt,
    statusLabel: CUSTOMER_STATUS_LABELS[o.status] || 'Diproses',
    total: o.salesPos ? Number(o.salesPos.total) : null,
    paidStatus: o.salesPos?.paidStatus || null,
  }));
}

async function getMyOrder(customerId, poId) {
  const order = await prisma.productionOrder.findUnique({
    where: { poId: Number(poId) },
    include: {
      poDetails: { include: { product: { include: { printProduct: true } } } },
      salesPos: { include: { payments: true } },
    },
  });
  if (!order || order.customerId !== customerId) {
    throw new ApiError(404, 'Order not found');
  }
  return { ...order, statusLabel: CUSTOMER_STATUS_LABELS[order.status] || 'Diproses' };
}

module.exports = {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  googleLogin,
  getCatalog,
  getSiteSettings,
  getPromos,
  checkout,
  listMyOrders,
  getMyOrder,
};
