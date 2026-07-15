// Promo storefront - dikelola manager, tampil publik di cetakpixelso.com kalau sedang aktif.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function listPromos() {
  return prisma.promo.findMany({ orderBy: { sortOrder: 'asc' } });
}

async function getPromoById(id) {
  const promo = await prisma.promo.findUnique({ where: { promoId: Number(id) } });
  if (!promo) {
    throw new ApiError(404, 'Promo not found');
  }
  return promo;
}

async function createPromo(data, userId) {
  const { title, description, imageUrl, startDate, endDate, isActive, sortOrder } = data;

  if (!title) {
    throw new ApiError(400, 'title is required');
  }

  return prisma.promo.create({
    data: {
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder || 0),
      updatedBy: userId,
    },
  });
}

async function updatePromo(id, data, userId) {
  await getPromoById(id);

  const { title, description, imageUrl, startDate, endDate, isActive, sortOrder } = data;

  return prisma.promo.update({
    where: { promoId: Number(id) },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      updatedBy: userId,
    },
  });
}

async function deletePromo(id) {
  await getPromoById(id);
  return prisma.promo.delete({ where: { promoId: Number(id) } });
}

// Reshape ke DTO publik untuk storefront - hanya promo yang isActive dan berada
// dalam rentang tanggal aktif (kalau tanggal diisi) yang boleh tampil ke pelanggan.
async function getPublicPromos() {
  const promos = await listPromos();
  const now = new Date();

  return promos
    .filter((p) => {
      if (!p.isActive) return false;
      if (p.startDate && p.startDate > now) return false;
      if (p.endDate) {
        // endDate cuma tanggal (00:00) - dorong ke akhir hari itu supaya promo tetap
        // tampil sepanjang hari terakhirnya, bukan hilang sejak tengah malam.
        const endOfDay = new Date(p.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (endOfDay < now) return false;
      }
      return true;
    })
    .map((p) => ({
      id: p.promoId,
      title: p.title,
      description: p.description || null,
      imageUrl: p.imageUrl || null,
      startDate: p.startDate,
      endDate: p.endDate,
    }));
}

module.exports = {
  listPromos,
  getPromoById,
  createPromo,
  updatePromo,
  deletePromo,
  getPublicPromos,
};
