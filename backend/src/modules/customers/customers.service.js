// M02: Customer & CRM Ringkas
// Fitur kunci (PRD 3.2): Data pelanggan, segmentasi, sumber order, repeat order, riwayat transaksi

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS } = require('../../common/constants');

// PO 'draft' belum dianggap order terkonfirmasi, jadi dikecualikan dari perhitungan
// "terakhir order" - sama seperti marketing.service.js#CONFIRMED_ORDER_WHERE.
const CONFIRMED_ORDER_WHERE = { status: { not: PO_STATUS.DRAFT } };

const DEFAULT_PAGE_SIZE = 50;
// Lebih tinggi dari batas wajar buat halaman list (production-orders.service.js pakai 200) -
// dropdown "pilih customer" di form Buat PO butuh akses ke SEMUA customer, bukan cuma 1 halaman.
// Daftar nama/HP polos jauh lebih ringan daripada tabel PO dengan banyak kolom+relasi.
const MAX_PAGE_SIZE = 10000;

async function list(query) {
  const { segment, source, search, page, pageSize } = query;

  const where = {
    ...(segment ? { segment } : {}),
    ...(source ? { source } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  // Wajib dipaginasi - tabel ini sekarang 3.800+ baris (migrasi pelanggan POS lama), findMany
  // tanpa batas bikin tab browser staf lambat/freeze - lihat migrate-legacy-data.js.
  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { customerId: 'asc' },
      include: { _count: { select: { productionOrders: true } } },
      take,
      skip,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: customers.map(({ _count, ...customer }) => ({
      ...customer,
      orderCount: _count.productionOrders,
      isRepeatCustomer: _count.productionOrders > 1,
    })),
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

async function getById(id) {
  const customer = await prisma.customer.findUnique({
    where: { customerId: Number(id) },
    include: {
      productionOrders: {
        select: { poId: true, poNumber: true, status: true, createdAt: true, dueAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const { productionOrders, ...rest } = customer;
  return {
    ...rest,
    orderCount: productionOrders.length,
    isRepeatCustomer: productionOrders.length > 1,
    orderHistory: productionOrders,
  };
}

// Customer yang order terakhirnya lebih lama dari N hari lalu - dipakai tab "Customer Tidak
// Aktif" di frontend. Customer yang belum pernah order sama sekali (tidak ada baseline "terakhir
// order") sengaja dikecualikan, bukan target fitur ini.
async function getDormant({ days, segment }) {
  const cutoffDays = Number(days) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cutoffDays);

  const customers = await prisma.customer.findMany({
    where: segment ? { segment } : {},
    include: {
      productionOrders: { where: CONFIRMED_ORDER_WHERE, select: { createdAt: true } },
    },
  });

  return customers
    .filter((c) => c.productionOrders.length > 0)
    .map(({ productionOrders, ...c }) => ({
      ...c,
      orderCount: productionOrders.length,
      lastOrderAt: productionOrders.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), productionOrders[0].createdAt),
    }))
    .filter((c) => c.lastOrderAt < cutoff)
    .sort((a, b) => a.lastOrderAt - b.lastOrderAt);
}

async function create(data) {
  const { name, phone, segment, source } = data;

  if (!name) {
    throw new ApiError(400, 'name is required');
  }

  return prisma.customer.create({
    data: { name, phone, segment, source },
  });
}

async function update(id, data) {
  const { name, phone, segment, source } = data;

  const customer = await prisma.customer.findUnique({ where: { customerId: Number(id) } });
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  return prisma.customer.update({
    where: { customerId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(segment !== undefined ? { segment } : {}),
      ...(source !== undefined ? { source } : {}),
    },
  });
}

async function deleteCustomer(id) {
  const customerId = Number(id);
  const customer = await prisma.customer.findUnique({ where: { customerId } });
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const orderCount = await prisma.productionOrder.count({ where: { customerId } });
  if (orderCount > 0) {
    throw new ApiError(400, `Customer masih punya ${orderCount} riwayat order, tidak bisa dihapus`);
  }

  return prisma.customer.delete({ where: { customerId } });
}

module.exports = { list, getById, create, update, deleteCustomer, getDormant };
