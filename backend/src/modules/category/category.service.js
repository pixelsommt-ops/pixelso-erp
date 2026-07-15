// Master Kategori - satu-satunya sumber kategori, dipakai bareng oleh Master Produk
// (internal, lihat products.service.js) dan katalog storefront (lihat pricing.service.js).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function list() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

async function getById(id) {
  const category = await prisma.category.findUnique({ where: { categoryId: Number(id) } });
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  return category;
}

async function create(data) {
  const { name } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  try {
    return await prisma.category.create({ data: { name } });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(400, 'Nama kategori sudah dipakai');
    }
    throw err;
  }
}

async function update(id, data) {
  await getById(id);
  const { name } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  try {
    return await prisma.category.update({ where: { categoryId: Number(id) }, data: { name } });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(400, 'Nama kategori sudah dipakai');
    }
    throw err;
  }
}

async function deleteCategory(id) {
  await getById(id);
  const categoryId = Number(id);

  const [productCount, printProductCount] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.printProduct.count({ where: { categoryId } }),
  ]);
  const total = productCount + printProductCount;
  if (total > 0) {
    throw new ApiError(400, `Kategori masih dipakai ${total} produk, tidak bisa dihapus`);
  }

  return prisma.category.delete({ where: { categoryId } });
}

module.exports = { list, getById, create, update, deleteCategory };
