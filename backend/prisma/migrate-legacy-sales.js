// Migrasi riwayat penjualan (tb_jual/tb_djual) dari POS lama -> ProductionOrder/SalesPos/
// Payment/PoDetail. Terpisah dari migrate-legacy-data.js (master data) karena skalanya beda jauh
// (45rb+112rb baris) - pakai batch createMany, bukan upsert satu-satu.
//
// Prasyarat: sama seperti migrate-legacy-data.js, dump sudah di-import ke `pixelso_legacy_import`,
// dan migrate-legacy-data.js SUDAH dijalankan duluan (Customer.legacyId/Product.legacyId dipakai
// buat resolve customerId/productId). Aman dijalankan ulang (createMany skipDuplicates by poNumber).
// Jalankan: node prisma/migrate-legacy-sales.js

const { execSync } = require('child_process');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = new PrismaClient();

const LEGACY_DB = 'pixelso_legacy_import';
const BATCH_SIZE = 2000;
const FALLBACK_CUSTOMER_NAME = 'Pelanggan Migrasi (Data Tidak Lengkap)';
const SYSTEM_USER_EMAIL = 'legacy-import-system@pixelso.internal';

function mysqlConnFromDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  return { user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), host: url.hostname, port: url.port || '3306' };
}
const MYSQL_CONN = mysqlConnFromDatabaseUrl();

// NDJSON (satu JSON per baris) - lebih aman buat tabel besar (45rb/112rb baris) daripada satu
// JSON_ARRAYAGG raksasa. --raw penting: mode --batch bawaan MySQL escape ulang backslash yang
// merusak escaping JSON (lihat catatan sama di migrate-legacy-data.js).
function* queryLegacyNDJSON(sql) {
  const out = execSync(
    `mysql -u ${MYSQL_CONN.user} -h ${MYSQL_CONN.host} -P ${MYSQL_CONN.port} ${LEGACY_DB} -N -B --raw -e "${sql.replace(/"/g, '\\"')}"`,
    { maxBuffer: 500 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, MYSQL_PWD: MYSQL_CONN.password } }
  );
  for (const line of out.split('\n')) {
    if (line.trim()) yield JSON.parse(line);
  }
}

function nullIfEmpty(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Sama persis dengan pos.service.js#paidStatusFor - jangan re-implement beda logic.
function paidStatusFor(total, paidSoFar) {
  if (paidSoFar <= 0) return 'unpaid';
  if (paidSoFar >= total) return 'paid';
  return 'partial';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function ensurePlaceholders() {
  const systemRole = await prisma.role.upsert({ where: { roleName: 'system' }, update: {}, create: { roleName: 'system' } });
  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      name: 'Migrasi POS Lama',
      email: SYSTEM_USER_EMAIL,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
      roleId: systemRole.roleId,
      status: 'system',
      isSystem: true,
    },
  });

  let fallbackCustomer = await prisma.customer.findFirst({ where: { name: FALLBACK_CUSTOMER_NAME, legacyId: null } });
  if (!fallbackCustomer) {
    fallbackCustomer = await prisma.customer.create({
      data: { name: FALLBACK_CUSTOMER_NAME, source: 'Migrasi POS Lama' },
    });
  }

  return { systemUserId: systemUser.userId, fallbackCustomerId: fallbackCustomer.customerId };
}

async function main() {
  console.log('Mulai migrasi riwayat penjualan POS lama -> ERP...\n');
  const { systemUserId, fallbackCustomerId } = await ensurePlaceholders();

  const customerMap = new Map(
    (await prisma.customer.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true, customerId: true } }))
      .map((c) => [c.legacyId, c.customerId])
  );
  const productMap = new Map(
    (await prisma.product.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true, productId: true } }))
      .map((p) => [p.legacyId, p.productId])
  );
  console.log(`Peta referensi: ${customerMap.size} customer, ${productMap.size} produk.`);

  // ---------- tb_jual -> ProductionOrder ----------
  const jualRows = [...queryLegacyNDJSON(
    `SELECT JSON_OBJECT('idjual', idjual, 'tanggal', tanggal, 'jam', jam, 'idpelanggan', idpelanggan, 'jumlah', jumlah, 'jenis', jenis, 'bayar', bayar, 'ket', ket) FROM tb_jual`
  )];
  console.log(`tb_jual dibaca: ${jualRows.length} baris.`);

  let orphanCustomerCount = 0;
  const poCreateData = jualRows.map((r) => {
    const customerId = customerMap.get(nullIfEmpty(r.idpelanggan)) || (() => { orphanCustomerCount += 1; return fallbackCustomerId; })();
    const createdAt = new Date(`${r.tanggal}T${r.jam || '00:00:00'}`);
    return {
      poNumber: r.idjual,
      customerId,
      designerId: systemUserId,
      status: 'done',
      notes: nullIfEmpty(r.ket),
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date(r.tanggal) : createdAt,
    };
  });

  let poCreated = 0;
  for (const batch of chunk(poCreateData, BATCH_SIZE)) {
    const res = await prisma.productionOrder.createMany({ data: batch, skipDuplicates: true });
    poCreated += res.count;
  }
  console.log(`ProductionOrder: ${poCreated} baru dibuat (dari ${poCreateData.length} diproses, sisanya sudah ada). Customer fallback dipakai: ${orphanCustomerCount}x.`);

  // Peta poNumber -> poId (buat semua idjual yang barusan diproses, termasuk yang sudah ada dari run sebelumnya)
  const poNumberToId = new Map();
  for (const batch of chunk(jualRows.map((r) => r.idjual), BATCH_SIZE)) {
    const rows = await prisma.productionOrder.findMany({ where: { poNumber: { in: batch } }, select: { poId: true, poNumber: true } });
    for (const row of rows) poNumberToId.set(row.poNumber, row.poId);
  }

  // ---------- tb_jual -> SalesPos ----------
  const salesPosData = jualRows
    .filter((r) => poNumberToId.has(r.idjual))
    .map((r) => {
      const total = Number(r.jumlah) || 0;
      const dp = Math.min(Number(r.bayar) || 0, total);
      const createdAt = new Date(`${r.tanggal}T${r.jam || '00:00:00'}`);
      return {
        poId: poNumberToId.get(r.idjual),
        cashierId: systemUserId,
        total,
        dp,
        paidStatus: paidStatusFor(total, dp),
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date(r.tanggal) : createdAt,
      };
    });
  let salesPosCreated = 0;
  for (const batch of chunk(salesPosData, BATCH_SIZE)) {
    const res = await prisma.salesPos.createMany({ data: batch, skipDuplicates: true });
    salesPosCreated += res.count;
  }
  console.log(`SalesPos: ${salesPosCreated} baru dibuat.`);

  // Peta poId -> saleId
  const poIdToSaleId = new Map();
  for (const batch of chunk([...poNumberToId.values()], BATCH_SIZE)) {
    const rows = await prisma.salesPos.findMany({ where: { poId: { in: batch } }, select: { saleId: true, poId: true } });
    for (const row of rows) poIdToSaleId.set(row.poId, row.saleId);
  }

  // ---------- tb_jual -> Payment (skip yang belum dibayar sama sekali) ----------
  const paymentData = jualRows
    .filter((r) => poNumberToId.has(r.idjual) && poIdToSaleId.has(poNumberToId.get(r.idjual)) && Number(r.bayar) > 0)
    .map((r) => {
      const createdAt = new Date(`${r.tanggal}T${r.jam || '00:00:00'}`);
      const paidAt = Number.isNaN(createdAt.getTime()) ? new Date(r.tanggal) : createdAt;
      return {
        saleId: poIdToSaleId.get(poNumberToId.get(r.idjual)),
        method: nullIfEmpty(r.jenis) || 'Tunai',
        amount: Number(r.bayar),
        status: 'confirmed',
        paidAt,
      };
    });
  let paymentCreated = 0;
  for (const batch of chunk(paymentData, BATCH_SIZE)) {
    const res = await prisma.payment.createMany({ data: batch, skipDuplicates: true });
    paymentCreated += res.count;
  }
  console.log(`Payment: ${paymentCreated} baru dibuat.`);

  // ---------- tb_djual -> PoDetail ----------
  // PoDetail tidak punya unique key alami (poDetailId cuma autoincrement) - createMany tidak
  // bisa skipDuplicates di sini. Idempotency dijaga manual: poId yang SUDAH punya PoDetail (dari
  // run sebelumnya) dilewati seluruhnya, supaya run ulang tidak menggandakan baris.
  const poIdsWithExistingDetail = new Set(
    (await prisma.poDetail.findMany({ where: { poId: { in: [...poNumberToId.values()] } }, select: { poId: true }, distinct: ['poId'] }))
      .map((d) => d.poId)
  );

  const djualRows = [...queryLegacyNDJSON(
    `SELECT JSON_OBJECT('idjual', idjual, 'idproduk', idproduk, 'nama', nama, 'jumlah', jumlah, 'jual', jual) FROM tb_djual`
  )];
  console.log(`tb_djual dibaca: ${djualRows.length} baris.`);

  let skippedNoProduk = 0;
  let skippedNoOrder = 0;
  let skippedAlreadyImported = 0;
  const poDetailData = [];
  for (const r of djualRows) {
    const poId = poNumberToId.get(r.idjual);
    if (!poId) { skippedNoOrder += 1; continue; }
    if (poIdsWithExistingDetail.has(poId)) { skippedAlreadyImported += 1; continue; }
    const productId = productMap.get(nullIfEmpty(r.idproduk));
    if (!productId) { skippedNoProduk += 1; continue; }
    const qty = Math.max(1, Math.round(Number(r.jumlah) || 1));
    const unitPrice = Number(r.jual) || 0;
    poDetailData.push({
      poId,
      productId,
      qty,
      unitPrice,
      lineTotal: unitPrice * (Number(r.jumlah) || 0),
      specNote: nullIfEmpty(r.nama),
    });
  }
  let poDetailCreated = 0;
  for (const batch of chunk(poDetailData, BATCH_SIZE)) {
    const res = await prisma.poDetail.createMany({ data: batch });
    poDetailCreated += res.count;
  }
  console.log(`PoDetail: ${poDetailCreated} baru dibuat. Dilewati: ${skippedNoProduk} (produk tidak ketemu), ${skippedNoOrder} (order tidak ketemu - seharusnya 0), ${skippedAlreadyImported} (order sudah pernah diimpor sebelumnya).`);

  const [poCount, salesCount, paymentCount, detailCount] = await Promise.all([
    prisma.productionOrder.count(),
    prisma.salesPos.count(),
    prisma.payment.count(),
    prisma.poDetail.count(),
  ]);
  console.log('\nTotal akhir di ERP:');
  console.log(`  ProductionOrder: ${poCount}`);
  console.log(`  SalesPos: ${salesCount}`);
  console.log(`  Payment: ${paymentCount}`);
  console.log(`  PoDetail: ${detailCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
