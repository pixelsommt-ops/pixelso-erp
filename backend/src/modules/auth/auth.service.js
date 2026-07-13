// M01: Auth (bagian dari User & Role Management)

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../db/prisma');
const config = require('../../config');
const ApiError = require('../../common/errors/ApiError');

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { userId: user.userId, roleId: user.roleId, roleName: user.role.roleName },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: { userId: user.userId, name: user.name, email: user.email, role: user.role.roleName },
  };
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { userId }, include: { role: true } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return { userId: user.userId, name: user.name, email: user.email, role: user.role.roleName };
}

module.exports = { login, me };
