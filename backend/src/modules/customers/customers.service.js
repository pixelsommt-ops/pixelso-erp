// M02: Customer & CRM Ringkas
// Fitur kunci (PRD 3.2): Data pelanggan, segmentasi, sumber order, repeat order, riwayat transaksi

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

async function list(query) {
  const { segment, source, search } = query;

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

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { customerId: 'asc' },
    include: { _count: { select: { productionOrders: true } } },
  });

  return customers.map(({ _count, ...customer }) => ({
    ...customer,
    orderCount: _count.productionOrders,
    isRepeatCustomer: _count.productionOrders > 1,
  }));
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

module.exports = { list, getById, create, update };
