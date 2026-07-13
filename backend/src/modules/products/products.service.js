// Master Produk - katalog item cetak yang dipakai sebagai referensi PO (poDetails)

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function list(query) {
  const { category, search } = query;

  const where = {
    ...(category ? { category } : {}),
    ...(search ? { name: { contains: search } } : {}),
  };

  return prisma.product.findMany({ where, orderBy: { productId: 'asc' } });
}

async function getById(id) {
  const product = await prisma.product.findUnique({ where: { productId: Number(id) } });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  return product;
}

async function create(data) {
  const { name, category, basePrice, unit } = data;

  if (!name) {
    throw new ApiError(400, 'name is required');
  }

  return prisma.product.create({
    data: {
      name,
      category,
      unit,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
    },
  });
}

async function update(id, data) {
  const { name, category, basePrice, unit } = data;

  const product = await prisma.product.findUnique({ where: { productId: Number(id) } });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return prisma.product.update({
    where: { productId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
    },
  });
}

module.exports = { list, getById, create, update };
