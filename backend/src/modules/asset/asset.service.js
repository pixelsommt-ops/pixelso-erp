// Master Aset - daftar aset tetap dasar (tanpa perhitungan penyusutan otomatis, keputusan
// eksplisit user - currentValue diedit manual kalau perlu).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

async function list(query) {
  const { search, status, page, pageSize } = query;

  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(status ? { status } : {}),
  };

  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.asset.count({ where }),
  ]);

  return { assets, total, page: currentPage, pageSize: take, totalPages: Math.max(1, Math.ceil(total / take)) };
}

async function getById(id) {
  const asset = await prisma.asset.findUnique({ where: { assetId: Number(id) } });
  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }
  return asset;
}

async function create(data) {
  const { name, category, acquisitionDate, acquisitionCost, currentValue, location, status, notes } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }

  return prisma.asset.create({
    data: {
      name,
      category: category || null,
      acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
      acquisitionCost: acquisitionCost !== undefined && acquisitionCost !== '' ? Number(acquisitionCost) : null,
      currentValue: currentValue !== undefined && currentValue !== '' ? Number(currentValue) : null,
      location: location || null,
      status: status || 'active',
      notes: notes || null,
    },
  });
}

async function update(id, data) {
  const { name, category, acquisitionDate, acquisitionCost, currentValue, location, status, notes } = data;
  await getById(id);

  return prisma.asset.update({
    where: { assetId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(acquisitionDate !== undefined ? { acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null } : {}),
      ...(acquisitionCost !== undefined ? { acquisitionCost: acquisitionCost === '' ? null : Number(acquisitionCost) } : {}),
      ...(currentValue !== undefined ? { currentValue: currentValue === '' ? null : Number(currentValue) } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });
}

async function deleteAsset(id) {
  await getById(id);
  return prisma.asset.delete({ where: { assetId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteAsset };
