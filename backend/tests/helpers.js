const bcrypt = require('bcrypt');
const request = require('supertest');
const prisma = require('../src/db/prisma');
const app = require('../src/app');

async function createUser({ name, email, password, roleName, status = 'active' }) {
  const role = await prisma.role.findUnique({ where: { roleName } });
  if (!role) {
    throw new Error(`Role '${roleName}' not seeded`);
  }
  const hashed = await bcrypt.hash(password, 4); // rounds rendah supaya test cepat
  return prisma.user.create({
    data: { name, email, password: hashed, roleId: role.roleId, status },
  });
}

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (!res.body?.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token;
}

async function getRoleId(roleName) {
  const role = await prisma.role.findUnique({ where: { roleName } });
  return role.roleId;
}

module.exports = { createUser, loginAs, getRoleId, prisma, app, request };
