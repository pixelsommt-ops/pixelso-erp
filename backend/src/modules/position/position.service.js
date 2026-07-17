// Master Jabatan & Hierarki Organisasi - flat list dengan parentId (atasan langsung), frontend
// yang susun jadi tampilan terindentasi. Bukan graphical org chart, cukup buat kebutuhan
// "siapa atasan siapa" secara data.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function list() {
  return prisma.position.findMany({
    include: { parent: { select: { positionId: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

async function getById(id) {
  const position = await prisma.position.findUnique({
    where: { positionId: Number(id) },
    include: { parent: { select: { positionId: true, name: true } } },
  });
  if (!position) {
    throw new ApiError(404, 'Position not found');
  }
  return position;
}

// Cegah parentId bikin siklus (posisi jadi atasan dirinya sendiri lewat rantai parent).
async function assertNoCycle(positionId, parentId) {
  let current = parentId;
  const seen = new Set();
  while (current) {
    if (current === positionId) {
      throw new ApiError(400, 'parentId tidak boleh membuat siklus hierarki (posisi jadi atasan dirinya sendiri)');
    }
    if (seen.has(current)) break; // safety net, seharusnya tidak pernah kejadian kalau data konsisten
    seen.add(current);
    const parent = await prisma.position.findUnique({ where: { positionId: current }, select: { parentId: true } });
    current = parent?.parentId || null;
  }
}

async function create(data) {
  const { name, parentId } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (parentId) {
    const parent = await prisma.position.findUnique({ where: { positionId: Number(parentId) } });
    if (!parent) {
      throw new ApiError(400, 'Invalid parentId');
    }
  }
  return prisma.position.create({ data: { name, parentId: parentId ? Number(parentId) : null } });
}

async function update(id, data) {
  const { name, parentId } = data;
  await getById(id);

  if (parentId !== undefined && parentId !== null) {
    const parent = await prisma.position.findUnique({ where: { positionId: Number(parentId) } });
    if (!parent) {
      throw new ApiError(400, 'Invalid parentId');
    }
    await assertNoCycle(Number(id), Number(parentId));
  }

  return prisma.position.update({
    where: { positionId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(parentId !== undefined ? { parentId: parentId ? Number(parentId) : null } : {}),
    },
  });
}

async function deletePosition(id) {
  await getById(id);
  const [childCount, userCount] = await Promise.all([
    prisma.position.count({ where: { parentId: Number(id) } }),
    prisma.user.count({ where: { positionId: Number(id) } }),
  ]);
  if (childCount > 0) {
    throw new ApiError(400, 'Posisi ini masih punya posisi bawahan, tidak bisa dihapus');
  }
  if (userCount > 0) {
    throw new ApiError(400, 'Posisi ini masih ditempati karyawan, tidak bisa dihapus');
  }
  return prisma.position.delete({ where: { positionId: Number(id) } });
}

module.exports = { list, getById, create, update, deletePosition };
