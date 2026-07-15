// Seed roles sesuai PRD 3.1 Persona Pengguna dan Hak Akses
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ROLES = ['designer', 'cashier', 'production', 'inventory', 'finance', 'marketing', 'hrd', 'manager'];

async function main() {
  for (const roleName of ROLES) {
    await prisma.role.upsert({
      where: { roleName },
      update: {},
      create: { roleName },
    });
  }
  console.log('Seed roles done.');

  const managerRole = await prisma.role.findUnique({ where: { roleName: 'manager' } });
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@pixelso.com' },
    update: {},
    create: {
      name: 'Admin Pixelso',
      email: 'admin@pixelso.com',
      password: adminPassword,
      roleId: managerRole.roleId,
    },
  });
  console.log('Seed admin user done.');

  // User sistem: placeholder designer/cashier untuk order yang dibuat lewat checkout storefront
  // (bukan staf manusia). Status 'system' (bukan 'active') supaya tidak bisa login - lihat auth.service.js.
  const systemRole = await prisma.role.upsert({
    where: { roleName: 'system' },
    update: {},
    create: { roleName: 'system' },
  });
  await prisma.user.upsert({
    where: { email: 'storefront-system@pixelso.internal' },
    update: {},
    create: {
      name: 'Storefront System',
      email: 'storefront-system@pixelso.internal',
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
      roleId: systemRole.roleId,
      status: 'system',
      isSystem: true,
    },
  });
  console.log('Seed storefront system user done.');

  await prisma.pricingSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      designFee: 35000,
      materialFactors: { standard: 1, premium: 1.22, super: 1.45 },
      finishingRates: { none: 0, basic: 0.08, premium: 0.18 },
    },
  });

  // Master Kategori - satu-satunya sumber kategori, dipakai bareng oleh Master Produk
  // (internal) dan katalog storefront (PrintProduct) - lihat modul category.
  const CATEGORY_NAMES = ['Banner & Spanduk', 'Stiker', 'Apparel & DTF', 'Cetak Dokumen', 'Laser Cutting', 'Merchandise'];
  const categoryMap = {};
  for (const name of CATEGORY_NAMES) {
    const category = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    categoryMap[name] = category.categoryId;
  }
  console.log('Seed kategori done.');

  const PRINT_PRODUCTS = [
    { key: 'banner', name: 'Banner / MMT Outdoor', pricingMode: 'area', categoryName: 'Banner & Spanduk', baseRate: 28000, minimumArea: 0.5, setupFee: 0 },
    { key: 'sticker', name: 'Stiker Indoor', pricingMode: 'area', categoryName: 'Stiker', baseRate: 85000, minimumArea: 0.25, setupFee: 0 },
    { key: 'dtf', name: 'DTF Kaos', pricingMode: 'area', categoryName: 'Apparel & DTF', baseRate: 155000, minimumArea: 0.05, setupFee: 10000 },
    { key: 'a3', name: 'Cetak A3+', pricingMode: 'unit', categoryName: 'Cetak Dokumen', baseRate: 4500, minimumArea: 0, setupFee: 0 },
    { key: 'laser', name: 'Laser Cutting', pricingMode: 'area', categoryName: 'Laser Cutting', baseRate: 180000, minimumArea: 0.02, setupFee: 25000 },
    { key: 'lanyard', name: 'Lanyard Custom', pricingMode: 'unit', categoryName: 'Merchandise', baseRate: 18000, minimumArea: 0, setupFee: 15000 },
    { key: 'mug', name: 'Mug Custom', pricingMode: 'unit', categoryName: 'Merchandise', baseRate: 28000, minimumArea: 0, setupFee: 10000 },
  ];
  for (let i = 0; i < PRINT_PRODUCTS.length; i += 1) {
    const { categoryName, ...p } = PRINT_PRODUCTS[i];
    const categoryId = categoryMap[categoryName];
    const printProduct = await prisma.printProduct.upsert({
      where: { key: p.key },
      update: {},
      create: { ...p, categoryId, isActive: true, sortOrder: i },
    });
    // Product operasional yang ter-link, dipakai PoDetail.productId saat checkout storefront
    // (PoDetail masih FK ke Product, bukan PrintProduct - lihat catatan di schema.prisma).
    // basePrice di sini cuma fallback datar, bukan hitungan area/qty/setup penuh - lihat plan.
    // categoryId ikut PrintProduct yang sama - keduanya merepresentasikan produk yang sama.
    await prisma.product.upsert({
      where: { printProductId: printProduct.printProductId },
      update: {},
      create: {
        name: p.name,
        categoryId,
        basePrice: p.baseRate,
        unit: p.pricingMode === 'area' ? 'm2' : 'pcs',
        printProductId: printProduct.printProductId,
      },
    });
  }
  console.log('Seed pricing settings + print products + linked products done.');

  // Contoh Form Order per-produk (grup opsi) - CUMA template untuk produk Stiker, harga
  // Laminasi/Cutting di bawah ini PLACEHOLDER, bukan harga bisnis riil - ganti lewat ERP
  // (halaman Harga Website > Edit Produk). Baseline "Stiker Chromo" pakai baseRate lama
  // supaya harga default produk tidak berubah dari sebelum fitur ini ada.
  const stickerProduct = await prisma.printProduct.findUnique({ where: { key: 'sticker' } });
  const stickerHasOptions = await prisma.productOptionGroup.count({ where: { printProductId: stickerProduct.printProductId } });
  if (stickerHasOptions === 0) {
    await prisma.productOptionGroup.create({
      data: {
        printProductId: stickerProduct.printProductId,
        label: 'Bahan',
        required: true,
        sortOrder: 0,
        choices: {
          create: [
            { label: 'Stiker Chromo', priceMode: 'replace_base', priceValue: stickerProduct.baseRate, isDefault: true, sortOrder: 0 },
          ],
        },
      },
    });
    await prisma.productOptionGroup.create({
      data: {
        printProductId: stickerProduct.printProductId,
        label: 'Laminasi',
        required: true,
        sortOrder: 1,
        choices: {
          create: [
            { label: 'Tanpa Laminasi', priceMode: 'add', priceValue: 0, isDefault: true, sortOrder: 0 },
            { label: 'Laminasi Doff', priceMode: 'add', priceValue: 5000, perUnit: false, sortOrder: 1 },
          ],
        },
      },
    });
    await prisma.productOptionGroup.create({
      data: {
        printProductId: stickerProduct.printProductId,
        label: 'Cutting Stiker',
        required: true,
        sortOrder: 2,
        choices: {
          create: [
            { label: 'Tanpa Cutting', priceMode: 'add', priceValue: 0, isDefault: true, sortOrder: 0 },
            { label: 'Custom Cutting', priceMode: 'add', priceValue: 10000, perUnit: false, sortOrder: 1 },
          ],
        },
      },
    });
    console.log('Seed contoh opsi produk Stiker done (harga Laminasi/Cutting placeholder, ganti lewat ERP).');
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Pixelso Gemolong',
      tagline: 'Print • Design • Create',
      description:
        'Percetakan lengkap satu atap untuk banner, stiker, apparel, offset, merchandise, laser cutting, dan branding.',
      address: 'Jl. Raya Solo–Purwodadi Km. 20 Gemolong, sekitar 100 m selatan perempatan',
      openingHours: 'Senin–Sabtu • Konsultasi desain & cetak',
      whatsapp: '08156609299',
      instagram: 'cetakpixelso',
      tiktok: 'kreasi.umkm.solo',
      galleryImages: [],
    },
  });
  console.log('Seed site settings done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
