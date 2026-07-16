// Migrasi master data (kategori, supplier, produk, pelanggan) dari database POS lama
// (dbtoko11_1_1_percetakan, di-dump dari Google Drive "datadita sql.sql") ke ERP baru.
// Sengaja TIDAK termasuk data transaksi (tb_jual/tb_djual/tb_kas/tb_piutang/dst) - keputusan
// eksplisit user, karena model ProductionOrder ERP mewakili alur produksi penuh yang beda dari
// catatan penjualan POS lama yang flat.
//
// Prasyarat: dump sudah di-import ke database staging `pixelso_legacy_import` di server MySQL
// yang sama (lihat langkah di plan) - script ini cuma BACA dari situ via mysql CLI (JSON_ARRAYAGG),
// tidak butuh dependency driver MySQL baru. Aman dijalankan ulang (upsert by legacyId/name).
// Jalankan: node prisma/migrate-legacy-data.js

const { execSync } = require('child_process');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LEGACY_DB = 'pixelso_legacy_import';

// Kredensial MySQL diambil dari DATABASE_URL yang sama dipakai Prisma (backend/.env) - JANGAN
// hardcode di sini (persistent credential leak kalau ke-commit). Server MySQL sama dengan ERP,
// jadi staging DB legacy juga bisa diakses user/host yang sama.
function mysqlConnFromDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  return { user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), host: url.hostname, port: url.port || '3306' };
}
const MYSQL_CONN = mysqlConnFromDatabaseUrl();

function queryLegacyJSON(sql) {
  const wrapped = `SET SESSION group_concat_max_len = 4294967295; SELECT COALESCE((${sql}), JSON_ARRAY());`;
  // --raw penting: mode --batch bawaan MySQL escape ulang backslash ('\' jadi '\\') untuk
  // keamanan TSV, yang merusak escaping JSON kalau ada karakter spesial (kutip dua, dst) di data.
  // Password lewat env MYSQL_PWD, bukan flag -p, biar tidak nongol di daftar proses (ps aux).
  const out = execSync(
    `mysql -u ${MYSQL_CONN.user} -h ${MYSQL_CONN.host} -P ${MYSQL_CONN.port} ${LEGACY_DB} -N -B --raw -e "${wrapped.replace(/"/g, '\\"')}"`,
    { maxBuffer: 200 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, MYSQL_PWD: MYSQL_CONN.password } }
  );
  return JSON.parse(out.trim());
}

// '' -> null, biar tidak nyangkut di constraint/format kosong-tapi-terisi
function nullIfEmpty(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function migrateCategories() {
  const rows = queryLegacyJSON(
    `SELECT JSON_ARRAYAGG(JSON_OBJECT('kategori', kategori)) FROM tb_kategori WHERE kategori IS NOT NULL AND kategori != ''`
  );
  const categoryMap = new Map();
  let created = 0;
  for (const r of rows) {
    const name = nullIfEmpty(r.kategori);
    if (!name) continue;
    const cat = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    categoryMap.set(name, cat.categoryId);
    created += 1;
  }
  console.log(`Kategori: ${created} diproses (upsert, existing tidak diubah).`);
  return categoryMap;
}

async function migrateSuppliers() {
  const rows = queryLegacyJSON(
    `SELECT JSON_ARRAYAGG(JSON_OBJECT('idsupplier', idsupplier, 'nama', nama, 'alamat', alamat, 'telp', telp, 'kontak', kontak)) FROM tb_supplier`
  );
  let created = 0;
  for (const r of rows) {
    const legacyId = nullIfEmpty(r.idsupplier);
    if (!legacyId || !nullIfEmpty(r.nama)) continue;
    await prisma.supplier.upsert({
      where: { legacyId },
      update: {},
      create: {
        legacyId,
        name: r.nama,
        address: nullIfEmpty(r.alamat),
        phone: nullIfEmpty(r.telp),
        contact: nullIfEmpty(r.kontak),
      },
    });
    created += 1;
  }
  console.log(`Supplier: ${created} diproses.`);
}

async function migrateProducts(categoryMap) {
  const rows = queryLegacyJSON(
    `SELECT JSON_ARRAYAGG(JSON_OBJECT('idproduk', idproduk, 'nama', nama, 'kategori', kategori, 'satuan', satuan, 'retail', retail, 'beli', beli, 'grosir1', grosir1, 'grosir2', grosir2)) FROM tb_produk`
  );
  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const legacyId = nullIfEmpty(r.idproduk);
    const name = nullIfEmpty(r.nama);
    if (!legacyId || !name) {
      skipped += 1;
      continue;
    }
    const categoryName = nullIfEmpty(r.kategori);
    let categoryId = categoryName ? categoryMap.get(categoryName) : null;
    if (categoryName && !categoryId) {
      // kategori produk yang tidak ada di tb_kategori (data lama kadang tidak konsisten) - buat baru
      const cat = await prisma.category.upsert({ where: { name: categoryName }, update: {}, create: { name: categoryName } });
      categoryId = cat.categoryId;
      categoryMap.set(categoryName, categoryId);
    }
    const priceGrosir1 = r.grosir1 != null ? Number(r.grosir1) : null;
    const priceGrosir23 = r.grosir2 != null ? Number(r.grosir2) : null; // sistem lama cuma punya grosir1/grosir2 - grosir2 dipakai sebagai tingkat "Grosir 2/3"
    const priceHpp = r.beli != null ? Number(r.beli) : null;
    await prisma.product.upsert({
      where: { legacyId },
      // Backfill tier harga di produk yang sudah ada dari run sebelum field ini ditambahkan -
      // aman ditimpa ulang karena datanya selalu berasal dari sumber yang sama (idproduk ini).
      update: { priceGrosir1, priceGrosir23, priceHpp },
      create: {
        legacyId,
        name,
        categoryId,
        unit: nullIfEmpty(r.satuan),
        basePrice: Number(r.retail) || 0, // Harga Retail
        priceGrosir1,
        priceGrosir23,
        priceHpp,
      },
    });
    created += 1;
  }
  console.log(`Produk: ${created} diproses, ${skipped} dilewati (data tidak lengkap).`);
  console.log(`  Harga Retail/Grosir 1/Grosir 2-3/HPP ikut termigrasi. Stok & supplier per-produk TIDAK ikut - model Product ERP tidak punya field itu.`);
}

// Sisakan digit signifikan nomor HP - abaikan beda prefix '0' vs '62' & karakter non-digit,
// supaya '0812...' dan '62812...' dan '812...' dianggap sama saat dicocokkan.
function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  if (!digits) return null;
  return digits.replace(/^62/, '').replace(/^0/, '');
}

function normalizeName(n) {
  return n ? String(n).trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

async function migrateCustomers() {
  // tb_pelanggan tidak punya kolom email - kolom `alamat` isinya alamat asli (nama desa/jalan),
  // tapi sebagian kecil staf lama kadang nyelip nulis email di situ. Ambil yang mengandung '@'
  // saja sebagai email; sisanya alamat asli diabaikan (Customer ERP belum punya field alamat).
  const rows = queryLegacyJSON(
    `SELECT JSON_ARRAYAGG(JSON_OBJECT('idpelanggan', idpelanggan, 'nama', nama, 'alamat', alamat, 'telp', telp, 'jenis', jenis)) FROM tb_pelanggan`
  );

  const existingCustomers = await prisma.customer.findMany();
  const existingEmails = new Set(existingCustomers.filter((c) => c.email).map((c) => c.email));
  // legacyId -> email row yang sudah pernah diimpor - dipakai supaya baris yang di-re-run tidak
  // salah kedeteksi "bentrok" sama emailnya sendiri (upsert-nya cuma update:{} no-op, tapi cek
  // konflik di bawah jalan duluan sebelum tahu itu).
  const ownEmailByLegacyId = new Map(existingCustomers.filter((c) => c.legacyId && c.email).map((c) => [c.legacyId, c.email]));
  // Cuma customer yang BELUM ketahuan asal-usulnya (legacyId null) yang boleh jadi target gabung -
  // customer yang sudah pernah digabung/diimpor sebelumnya tidak boleh "direbut" baris legacy lain.
  const mergeTargetByKey = new Map(
    existingCustomers
      .filter((c) => !c.legacyId)
      .map((c) => [`${normalizePhone(c.phone)}|${normalizeName(c.name)}`, c])
      .filter(([key]) => !key.startsWith('null|') && !key.startsWith('|'))
  );

  let created = 0;
  let merged = 0;
  let skipped = 0;
  const emailConflicts = [];
  for (const r of rows) {
    const legacyId = nullIfEmpty(r.idpelanggan);
    const name = nullIfEmpty(r.nama);
    if (!legacyId || !name) {
      skipped += 1;
      continue;
    }
    const phone = nullIfEmpty(r.telp);
    const alamat = nullIfEmpty(r.alamat);
    let email = alamat && alamat.includes('@') ? alamat : null;
    if (email && email !== ownEmailByLegacyId.get(legacyId)) {
      if (existingEmails.has(email)) {
        emailConflicts.push({ legacyId, email });
        email = null;
      } else {
        existingEmails.add(email);
      }
    }
    const segment = nullIfEmpty(r.jenis);

    const matchKey = `${normalizePhone(phone)}|${normalizeName(name)}`;
    const matched = phone && !matchKey.startsWith('null|') ? mergeTargetByKey.get(matchKey) : null;

    if (matched) {
      // Ketemu customer ERP yang sama (cocok HP + nama) - lengkapi field yang masih kosong,
      // JANGAN timpa data ERP yang sudah ada ("saling melengkapi", bukan menimpa).
      await prisma.customer.update({
        where: { customerId: matched.customerId },
        data: {
          legacyId,
          ...(matched.segment == null && segment ? { segment } : {}),
          ...(matched.email == null && email ? { email } : {}),
        },
      });
      mergeTargetByKey.delete(matchKey); // sekali gabung, jangan dipakai lagi buat baris legacy lain
      merged += 1;
      continue;
    }

    await prisma.customer.upsert({
      where: { legacyId },
      update: {},
      create: {
        legacyId,
        name,
        phone,
        email,
        segment,
        source: 'Migrasi POS Lama',
      },
    });
    created += 1;
  }
  console.log(`Pelanggan: ${created} baru, ${merged} digabung ke customer ERP yang sudah ada, ${skipped} dilewati (data tidak lengkap).`);
  if (emailConflicts.length > 0) {
    console.log(`  Email bentrok (dikosongkan, data lain tetap masuk): ${emailConflicts.map((c) => `${c.legacyId}:${c.email}`).join(', ')}`);
  }
}

async function main() {
  console.log('Mulai migrasi data legacy POS -> ERP (master data saja, tanpa riwayat transaksi)...\n');
  const categoryMap = await migrateCategories();
  await migrateSuppliers();
  await migrateProducts(categoryMap);
  await migrateCustomers();

  const [custCount, prodCount, supCount, catCount] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.category.count(),
  ]);
  console.log('\nTotal akhir di ERP:');
  console.log(`  Customer: ${custCount}`);
  console.log(`  Product: ${prodCount}`);
  console.log(`  Supplier: ${supCount}`);
  console.log(`  Category: ${catCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
