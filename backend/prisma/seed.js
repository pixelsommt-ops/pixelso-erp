// Seed roles sesuai PRD 3.1 Persona Pengguna dan Hak Akses
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

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

  const PRINT_PRODUCTS = [
    { key: 'banner', name: 'Banner / MMT Outdoor', pricingMode: 'area', baseRate: 28000, minimumArea: 0.5, setupFee: 0 },
    { key: 'sticker', name: 'Stiker Indoor', pricingMode: 'area', baseRate: 85000, minimumArea: 0.25, setupFee: 0 },
    { key: 'dtf', name: 'DTF Kaos', pricingMode: 'area', baseRate: 155000, minimumArea: 0.05, setupFee: 10000 },
    { key: 'a3', name: 'Cetak A3+', pricingMode: 'unit', baseRate: 4500, minimumArea: 0, setupFee: 0 },
    { key: 'laser', name: 'Laser Cutting', pricingMode: 'area', baseRate: 180000, minimumArea: 0.02, setupFee: 25000 },
    { key: 'lanyard', name: 'Lanyard Custom', pricingMode: 'unit', baseRate: 18000, minimumArea: 0, setupFee: 15000 },
    { key: 'mug', name: 'Mug Custom', pricingMode: 'unit', baseRate: 28000, minimumArea: 0, setupFee: 10000 },
  ];
  for (let i = 0; i < PRINT_PRODUCTS.length; i += 1) {
    const p = PRINT_PRODUCTS[i];
    await prisma.printProduct.upsert({
      where: { key: p.key },
      update: {},
      create: { ...p, isActive: true, sortOrder: i },
    });
  }
  console.log('Seed pricing settings + print products done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
