// Master Supplier - awalnya cuma diisi dari migrasi data POS lama (migrate-legacy-data.js),
// modul ini yang kasih CRUD-nya. Belum ada relasi ke Material/Product (mis. "produk ini dari
// supplier X") - itu fitur pembelian terpisah, di luar cakupan saat ini.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

async function list(query) {
  const { search, page, pageSize } = query;

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
        ],
      }
    : {};

  // Dipaginasi dari awal - pelajaran dari insiden freeze PO/Customer/POS sebelumnya, jangan
  // tunggu tabel ini membesar dulu baru dibetulkan.
  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, total, page: currentPage, pageSize: take, totalPages: Math.max(1, Math.ceil(total / take)) };
}

async function getById(id) {
  const supplier = await prisma.supplier.findUnique({ where: { supplierId: Number(id) } });
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }
  return supplier;
}

async function create(data) {
  const { name, address, phone, contact } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }

  return prisma.supplier.create({ data: { name, address, phone, contact } });
}

async function update(id, data) {
  const { name, address, phone, contact } = data;
  await getById(id);

  return prisma.supplier.update({
    where: { supplierId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(contact !== undefined ? { contact } : {}),
    },
  });
}

async function deleteSupplier(id) {
  await getById(id);
  return prisma.supplier.delete({ where: { supplierId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteSupplier };
