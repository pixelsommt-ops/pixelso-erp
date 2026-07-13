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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
