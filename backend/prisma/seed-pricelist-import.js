// Import harga asli dari 3 file pricelist Google Drive (folder 02-DATA-PRODUK-HARGA):
// Pricelist Cetak A3 PXL.xlsx, Pricelist Cetak Outdoor PXL.xlsx, Pricelist Cetak Indoor PXL.xlsx.
// One-off, aman dijalankan ulang (upsert PrintProduct+Product by key, replace-whole-tree optionGroups
// seperti pola pricing.service.js#updateProduct). Jalankan: node prisma/seed-pricelist-import.js
//
// Asumsi & keputusan yang perlu direview manual di halaman /pricing setelah import (lihat juga
// ringkasan yang dicetak di akhir skrip):
// - Cetak A3+ Kertas dipecah jadi 2 produk terpisah (1 Sisi / 2 Sisi) karena harga 2 sisi bukan
//   kelipatan tetap dari 1 sisi per bahan - tidak bisa direpresentasikan sebagai satu grup opsi
//   "Sisi Cetak" multiplier yang akurat di skema saat ini.
// - Tier ">6 lembar" pada AP150/AC230/AC260 diasumsikan berlaku 6-249 (sebelum tier ">250 lembar").
// - Banner MMT "Normal" vs "VIP Sehari Jadi" dimodelkan sebagai 2 pilihan bahan terpisah (VIP cuma
//   ada untuk Flexy 280gsm di sumber data).
// - "Paket A banner" di sumber ada 2 baris identik (bahan+ukuran sama) dengan harga beda
//   (185000 vs 197000) - dimasukkan keduanya dengan label "Varian 1/2", tandai untuk diklarifikasi.
// - Baris tanpa harga (Rangka Roll Up Banner 200x80) DILEWATI, bukan ditebak.
// - minimumArea Banner Kain di-default 0.5 m2 (sama seperti Banner MMT) karena tidak ada di sumber.
// - Produk lama 'a3' (placeholder seed awal) di-nonaktifkan (isActive=false), digantikan
//   a3-kertas-1sisi / a3-kertas-2sisi / a3-stiker.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCategoryId(name) {
  const category = await prisma.category.findUnique({ where: { name } });
  if (!category) throw new Error(`Kategori "${name}" tidak ditemukan - jalankan prisma/seed.js dulu`);
  return category.categoryId;
}

// choices: [{ label, price, tiers?: [{minQty, maxQty, price}], priceMode?, perUnit?, isDefault? }]
function buildOptionGroup(label, choices, { required = true } = {}) {
  return {
    label,
    required,
    choices: choices.map((c, i) => ({
      label: c.label,
      priceMode: c.priceMode || 'replace_base',
      priceValue: c.tiers ? c.tiers[0].price : c.price,
      perUnit: Boolean(c.perUnit),
      isDefault: c.isDefault || i === 0,
      qtyTiers: c.tiers || null,
    })),
  };
}

async function upsertPrintProductWithOptions({ key, name, pricingMode, categoryName, baseRate, minimumArea = 0, setupFee = 0, sortOrder, optionGroups }) {
  const categoryId = await getCategoryId(categoryName);

  const printProduct = await prisma.printProduct.upsert({
    where: { key },
    update: { name, pricingMode, categoryId, baseRate, minimumArea, setupFee, isActive: true, sortOrder },
    create: { key, name, pricingMode, categoryId, baseRate, minimumArea, setupFee, isActive: true, sortOrder },
  });

  await prisma.productOptionGroup.deleteMany({ where: { printProductId: printProduct.printProductId } });
  for (let gi = 0; gi < optionGroups.length; gi += 1) {
    const g = optionGroups[gi];
    await prisma.productOptionGroup.create({
      data: {
        printProductId: printProduct.printProductId,
        label: g.label,
        required: g.required,
        sortOrder: gi,
        choices: { create: g.choices.map((c, ci) => ({ ...c, sortOrder: ci })) },
      },
    });
  }

  await prisma.product.upsert({
    where: { printProductId: printProduct.printProductId },
    update: { name, categoryId, basePrice: baseRate },
    create: {
      name,
      categoryId,
      basePrice: baseRate,
      unit: pricingMode === 'area' ? 'm2' : 'pcs',
      printProductId: printProduct.printProductId,
    },
  });

  return printProduct;
}

async function main() {
  // ---------- Cetak A3+ Kertas - 1 Sisi ----------
  await upsertPrintProductWithOptions({
    key: 'a3-kertas-1sisi',
    name: 'Cetak A3+ Kertas (1 Sisi)',
    pricingMode: 'unit',
    categoryName: 'Cetak Dokumen',
    baseRate: 4000,
    sortOrder: 10,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Hvs 80 gr BW', price: 4000 },
        { label: 'Hvs 80 gr CL', tiers: [{ minQty: 1, maxQty: 5, price: 6500 }, { minQty: 6, maxQty: null, price: 6200 }] },
        { label: 'AP 120 gr', tiers: [{ minQty: 1, maxQty: 5, price: 7000 }, { minQty: 6, maxQty: null, price: 6500 }] },
        { label: 'AP 150 gr', tiers: [{ minQty: 1, maxQty: 5, price: 7300 }, { minQty: 6, maxQty: 249, price: 6800 }, { minQty: 250, maxQty: null, price: 6600 }] },
        { label: 'AC 230 gr', tiers: [{ minQty: 1, maxQty: 5, price: 9300 }, { minQty: 6, maxQty: 249, price: 8800 }, { minQty: 250, maxQty: null, price: 8300 }] },
        { label: 'AC 260 gr', tiers: [{ minQty: 1, maxQty: 5, price: 9300 }, { minQty: 6, maxQty: 249, price: 8900 }, { minQty: 250, maxQty: null, price: 8400 }] },
        { label: 'Linen A3', price: 10000 },
      ]),
    ],
  });

  // ---------- Cetak A3+ Kertas - 2 Sisi ----------
  await upsertPrintProductWithOptions({
    key: 'a3-kertas-2sisi',
    name: 'Cetak A3+ Kertas (2 Sisi)',
    pricingMode: 'unit',
    categoryName: 'Cetak Dokumen',
    baseRate: 4500,
    sortOrder: 11,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Hvs 80 gr BW', price: 4500 },
        { label: 'Hvs 80 gr CL', tiers: [{ minQty: 1, maxQty: 5, price: 7800 }, { minQty: 6, maxQty: null, price: 7500 }] },
        { label: 'AP 120 gr', tiers: [{ minQty: 1, maxQty: 5, price: 10000 }, { minQty: 6, maxQty: null, price: 9800 }] },
        { label: 'AP 150 gr', tiers: [{ minQty: 1, maxQty: 5, price: 10200 }, { minQty: 6, maxQty: 249, price: 9900 }, { minQty: 250, maxQty: null, price: 9800 }] },
        { label: 'AC 230 gr', tiers: [{ minQty: 1, maxQty: 5, price: 10400 }, { minQty: 6, maxQty: 249, price: 10100 }, { minQty: 250, maxQty: null, price: 9600 }] },
        { label: 'AC 260 gr', tiers: [{ minQty: 1, maxQty: 5, price: 10500 }, { minQty: 6, maxQty: 249, price: 10200 }, { minQty: 250, maxQty: null, price: 9700 }] },
        { label: 'Linen A3', price: 12000 },
      ]),
    ],
  });

  // ---------- Cetak A3+ Stiker ----------
  await upsertPrintProductWithOptions({
    key: 'a3-stiker',
    name: 'Cetak A3+ Stiker',
    pricingMode: 'unit',
    categoryName: 'Stiker',
    baseRate: 9000,
    sortOrder: 12,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Stiker HVS', tiers: [{ minQty: 1, maxQty: 100, price: 9000 }, { minQty: 101, maxQty: 200, price: 8850 }, { minQty: 201, maxQty: 300, price: 8600 }, { minQty: 301, maxQty: 400, price: 8550 }, { minQty: 401, maxQty: null, price: 8400 }] },
        { label: 'Stiker Mirror/Cromo', tiers: [{ minQty: 1, maxQty: 100, price: 9000 }, { minQty: 101, maxQty: 200, price: 8850 }, { minQty: 201, maxQty: 300, price: 8600 }, { minQty: 301, maxQty: 400, price: 8550 }, { minQty: 401, maxQty: null, price: 8400 }] },
        { label: 'Stiker Vinyl', tiers: [{ minQty: 1, maxQty: 100, price: 11000 }, { minQty: 101, maxQty: 200, price: 9000 }, { minQty: 201, maxQty: null, price: 8000 }] },
        { label: 'Stiker Transparant', tiers: [{ minQty: 1, maxQty: 100, price: 17000 }, { minQty: 101, maxQty: null, price: 15000 }] },
        { label: 'Stiker Gold', price: 22000 },
        { label: 'Stiker Crome', price: 22000 },
        { label: 'Stiker Hologram', price: 25000 },
      ]),
      buildOptionGroup('Finishing', [
        { label: 'Tanpa Finishing', price: 0, priceMode: 'add', isDefault: true },
        { label: 'Laminasi Hot Glossy', price: 5000, priceMode: 'add' },
        { label: 'Laminasi Hot Doff', price: 5000, priceMode: 'add' },
        { label: 'Laminating A4', price: 3500, priceMode: 'add' },
        { label: 'Laminating A3', price: 8000, priceMode: 'add' },
        { label: 'Cutting Halfcut/Gantung', price: 5000, priceMode: 'add' },
        { label: 'Cutting Diecut/Putus', price: 15000, priceMode: 'add' },
      ], { required: false }),
    ],
  });

  // Nonaktifkan produk lama 'a3' (digantikan 3 produk di atas) - biarkan datanya, jangan hapus.
  await prisma.printProduct.updateMany({ where: { key: 'a3' }, data: { isActive: false } });

  // ---------- Banner / MMT Outdoor (update produk existing) ----------
  await upsertPrintProductWithOptions({
    key: 'banner',
    name: 'Banner / MMT Outdoor',
    pricingMode: 'area',
    categoryName: 'Banner & Spanduk',
    baseRate: 20000,
    minimumArea: 0.5,
    sortOrder: 0,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Flexy 280 gsm (Normal)', price: 20000 },
        { label: 'Flexy 280 gsm (VIP Sehari Jadi)', price: 26000 },
        { label: 'Flexy 440 gsm', price: 35000 },
        { label: 'Backlite Jerman', price: 125000 },
        { label: 'Backlite UV', price: 135000 },
      ]),
    ],
  });

  // ---------- Paket Banner (siap pasang, harga per paket) ----------
  await upsertPrintProductWithOptions({
    key: 'banner-paket',
    name: 'Paket Banner (Siap Pasang)',
    pricingMode: 'unit',
    categoryName: 'Banner & Spanduk',
    baseRate: 75000,
    sortOrder: 1,
    optionGroups: [
      buildOptionGroup('Pilih Paket', [
        { label: 'X Banner + Flexy 280gsm (160x60cm)', price: 75000 },
        { label: 'Roll Up Banner + Luster (160x60cm)', price: 350000 },
        { label: 'Roll Up Banner + Luster (200x80cm)', price: 400000 },
        { label: 'T Banner + Impraboard + Stiker (75x50cm)', price: 350000 },
        { label: 'Rangka Kayu + Flexy 280gsm (100x50cm) - Varian 1', price: 185000 },
        { label: 'Rangka Kayu + Flexy 280gsm (100x50cm) - Varian 2', price: 197000 },
      ]),
    ],
  });

  // ---------- Rangka Banner (tanpa bahan) ----------
  await upsertPrintProductWithOptions({
    key: 'rangka-banner',
    name: 'Rangka Banner (Tanpa Bahan)',
    pricingMode: 'unit',
    categoryName: 'Banner & Spanduk',
    baseRate: 55000,
    sortOrder: 2,
    optionGroups: [
      // Rangka Roll Up Banner (200x80) dilewati - harga kosong di sumber data.
      buildOptionGroup('Jenis Rangka', [
        { label: 'Rangka X Banner (160x60)', price: 55000 },
        { label: 'Rangka Roll Up Banner (160x60)', price: 250000 },
        { label: 'Rangka T Banner', price: 250000 },
        { label: 'Rangka A Banner (100x50)', price: 165000 },
        { label: 'Rangka A Banner (100x80)', price: 165000 },
      ]),
    ],
  });

  // ---------- Stiker Indoor (update produk existing, ganti opsi placeholder dgn bahan asli) ----------
  await upsertPrintProductWithOptions({
    key: 'sticker',
    name: 'Stiker Indoor',
    pricingMode: 'area',
    categoryName: 'Stiker',
    baseRate: 85000,
    minimumArea: 0.25,
    sortOrder: 3,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Camel', price: 85000 },
        { label: 'Maxdecal', price: 120000 },
        { label: 'Transparant', price: 125000 },
        { label: 'Onewayvision', price: 100000 },
      ]),
    ],
  });

  // ---------- Banner Kain ----------
  await upsertPrintProductWithOptions({
    key: 'banner-kain',
    name: 'Banner Kain',
    pricingMode: 'area',
    categoryName: 'Banner & Spanduk',
    baseRate: 50000,
    minimumArea: 0.5,
    sortOrder: 4,
    optionGroups: [
      buildOptionGroup('Bahan', [
        { label: 'Polister', price: 50000 },
        { label: 'Satin', price: 70000 },
      ]),
    ],
  });

  console.log('Import pricelist selesai.');
  console.log('Perlu direview manual di /pricing:');
  console.log('- Paket A Banner: 2 varian harga (185000 vs 197000) untuk bahan+ukuran yang sama di sumber data - klarifikasi mana yang benar / apa bedanya.');
  console.log('- Rangka Roll Up Banner (200x80): harga kosong di sumber, TIDAK dimasukkan - isi manual kalau ada.');
  console.log('- Rangka T Banner: ukuran kosong di sumber, label tanpa ukuran.');
  console.log('- Banner Kain: minimumArea di-default 0.5 m2 (tidak ada di sumber data), sesuaikan kalau perlu.');
  console.log('- Produk lama key=a3 dinonaktifkan (isActive=false), digantikan a3-kertas-1sisi/a3-kertas-2sisi/a3-stiker.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
