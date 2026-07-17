// Master Produk - katalog item cetak yang dipakai sebagai referensi PO (poDetails)

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function list(query) {
  const { categoryId, search } = query;

  const where = {
    ...(categoryId ? { categoryId: Number(categoryId) } : {}),
    ...(search ? { name: { contains: search } } : {}),
  };

  return prisma.product.findMany({ where, orderBy: { productId: 'asc' }, include: { category: true } });
}

async function getById(id) {
  const product = await prisma.product.findUnique({ where: { productId: Number(id) }, include: { category: true } });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  return product;
}

// Mode harga (area/unit/menit/gram/dst) - lihat pricing.service.js#validatePricingMode, versi
// sama persis dipakai di sini karena Master Produk (internal) validasi lepas dari PrintProduct
// (storefront) meski keduanya rujuk tabel PricingMode yang sama.
async function validatePricingMode(pricingMode) {
  const mode = await prisma.pricingMode.findUnique({ where: { key: pricingMode } });
  if (!mode || !mode.isActive) {
    throw new ApiError(400, 'Mode harga tidak valid atau tidak aktif - kelola di Master Mode Harga');
  }
}

async function create(data) {
  const { name, categoryId, basePrice, priceGrosir1, priceGrosir23, priceHpp, unit, pricingMode } = data;

  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (pricingMode) {
    await validatePricingMode(pricingMode);
  }

  return prisma.product.create({
    data: {
      name,
      categoryId: categoryId ? Number(categoryId) : null,
      unit,
      pricingMode: pricingMode || undefined,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
      priceGrosir1: priceGrosir1 !== undefined && priceGrosir1 !== null ? Number(priceGrosir1) : null,
      priceGrosir23: priceGrosir23 !== undefined && priceGrosir23 !== null ? Number(priceGrosir23) : null,
      priceHpp: priceHpp !== undefined && priceHpp !== null ? Number(priceHpp) : null,
    },
  });
}

async function update(id, data) {
  const { name, categoryId, basePrice, priceGrosir1, priceGrosir23, priceHpp, unit, pricingMode } = data;

  const product = await prisma.product.findUnique({ where: { productId: Number(id) } });
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  if (pricingMode) {
    await validatePricingMode(pricingMode);
  }

  return prisma.product.update({
    where: { productId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId ? Number(categoryId) : null } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(pricingMode ? { pricingMode } : {}),
      ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
      ...(priceGrosir1 !== undefined ? { priceGrosir1: priceGrosir1 !== null ? Number(priceGrosir1) : null } : {}),
      ...(priceGrosir23 !== undefined ? { priceGrosir23: priceGrosir23 !== null ? Number(priceGrosir23) : null } : {}),
      ...(priceHpp !== undefined ? { priceHpp: priceHpp !== null ? Number(priceHpp) : null } : {}),
    },
  });
}

async function deleteProduct(id) {
  const product = await getById(id);

  if (product.printProductId) {
    throw new ApiError(400, 'Produk ini terhubung ke katalog storefront - kelola/hapus lewat halaman Harga Website (Kalkulator), bukan di sini.');
  }

  const poDetailCount = await prisma.poDetail.count({ where: { productId: Number(id) } });
  if (poDetailCount > 0) {
    throw new ApiError(400, `Produk masih dipakai di ${poDetailCount} baris pesanan, tidak bisa dihapus.`);
  }

  return prisma.product.delete({ where: { productId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteProduct };
