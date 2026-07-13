const prisma = require('../src/db/prisma');

afterAll(async () => {
  await prisma.$disconnect();
});
