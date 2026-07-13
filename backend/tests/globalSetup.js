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

  await prisma.$disconnect();
};
