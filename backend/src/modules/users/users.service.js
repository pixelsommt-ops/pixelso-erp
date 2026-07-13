// M01: User & Role Management
// Fitur kunci (PRD 3.2): Login, role, permission, audit log, status user, tim/divisi

const bcrypt = require('bcrypt');
const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const SAFE_SELECT = {
  userId: true,
  name: true,
  email: true,
  status: true,
  roleId: true,
  teamId: true,
  createdAt: true,
  role: { select: { roleId: true, roleName: true } },
  team: { select: { teamId: true, name: true } },
};

async function list(query) {
  const { roleId, status, search } = query;

  const where = {
    ...(roleId ? { roleId: Number(roleId) } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  return prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { userId: 'asc' } });
}

async function getById(id) {
  const user = await prisma.user.findUnique({ where: { userId: Number(id) }, select: SAFE_SELECT });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
}

async function create(data) {
  const { name, email, password, roleId, teamId, status } = data;

  if (!name || !email || !password || !roleId) {
    throw new ApiError(400, 'name, email, password, and roleId are required');
  }

  const role = await prisma.role.findUnique({ where: { roleId: Number(roleId) } });
  if (!role) {
    throw new ApiError(400, 'Invalid roleId');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }

  const hashed = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      roleId: Number(roleId),
      teamId: teamId ? Number(teamId) : undefined,
      status: status || 'active',
    },
    select: SAFE_SELECT,
  });
}

async function update(id, data) {
  const { name, email, password, roleId, teamId, status } = data;

  const user = await prisma.user.findUnique({ where: { userId: Number(id) } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'Email already registered');
    }
  }

  if (roleId) {
    const role = await prisma.role.findUnique({ where: { roleId: Number(roleId) } });
    if (!role) {
      throw new ApiError(400, 'Invalid roleId');
    }
  }

  return prisma.user.update({
    where: { userId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      ...(roleId ? { roleId: Number(roleId) } : {}),
      ...(teamId !== undefined ? { teamId: teamId ? Number(teamId) : null } : {}),
      ...(status ? { status } : {}),
    },
    select: SAFE_SELECT,
  });
}

async function listRoles() {
  return prisma.role.findMany({ orderBy: { roleId: 'asc' } });
}

async function listTeams() {
  return prisma.team.findMany({ orderBy: { teamId: 'asc' }, include: { _count: { select: { users: true } } } });
}

async function createTeam(data) {
  const { name } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  return prisma.team.create({ data: { name } });
}

module.exports = { list, getById, create, update, listRoles, listTeams, createTeam };
