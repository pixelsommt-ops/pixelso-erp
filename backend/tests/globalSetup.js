const { execSync } = require('child_process');
const path = require('path');

const TEST_DB_URL = 'mysql://pixelso:pixelso123@127.0.0.1:3306/pixelso_erp_test';

module.exports = async function globalSetup() {
  execSync(
    'mysql -u pixelso -ppixelso123 -h 127.0.0.1 -e "DROP DATABASE IF EXISTS pixelso_erp_test; CREATE DATABASE pixelso_erp_test;"',
    { stdio: 'inherit' }
  );

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  });

  process.env.DATABASE_URL = TEST_DB_URL;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const ROLE_NAMES = ['designer', 'cashier', 'production', 'inventory', 'finance', 'marketing', 'hrd', 'manager'];
  for (const roleName of ROLE_NAMES) {
    await prisma.role.upsert({ where: { roleName }, update: {}, create: { roleName } });
  }

  // pricing.test.js dan lainnya bikin PrintProduct dengan pricingMode 'area'/'unit' - keduanya
  // wajib ada di Master Mode Harga sejak awal, sama seperti di prisma/seed.js produksi/dev.
  const PRICING_MODES = [
    { key: 'area', label: 'Per m² (Luas)', calcType: 'area', unitLabel: 'm²', inputLabel: 'Ukuran (Lebar x Tinggi)', sortOrder: 0 },
    { key: 'unit', label: 'Per Pcs', calcType: 'scalar', unitLabel: 'pcs', inputLabel: 'Jumlah (pcs)', sortOrder: 1 },
  ];
  for (const mode of PRICING_MODES) {
    await prisma.pricingMode.upsert({ where: { key: mode.key }, update: {}, create: mode });
  }

  await prisma.$disconnect();
};
