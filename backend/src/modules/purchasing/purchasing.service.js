// Purchasing & Procurement - PO pembelian ke supplier (uang keluar), struktur header+items mirip
// ProductionOrder/PoDetail di modules/production-orders tapi arah sebaliknya (beli, bukan jual).
// Sengaja TIDAK menyentuh Material.stockQty (keputusan eksplisit user, di luar cakupan pass ini) -
// materialId di tiap item murni referensi/pelaporan.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { applyStockMovement } = require('../../common/utils/stockMovement');

const STATUS_TRANSITIONS = {
  draft: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: ['paid'],
  paid: [],
  cancelled: [],
};

const LIST_INCLUDE = {
  supplier: { select: { supplierId: true, name: true } },
  cashAccount: { select: { cashAccountId: true, name: true } },
  creator: { select: { userId: true, name: true } },
  _count: { select: { items: true } },
};

const DETAIL_INCLUDE = {
  supplier: true,
  cashAccount: true,
  creator: { select: { userId: true, name: true } },
  items: { include: { material: { select: { materialId: true, name: true, unit: true } } } },
};

async function generatePoNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const countToday = await prisma.purchaseOrder.count({ where: { createdAt: { gte: startOfDay } } });
  return `PB-${datePart}-${String(countToday + 1).padStart(4, '0')}`;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

async function list(query) {
  const { status, supplierId, search, dateFrom, dateTo, page, pageSize } = query;

  const where = {
    ...(status ? { status } : {}),
    ...(supplierId ? { supplierId: Number(supplierId) } : {}),
    ...(search ? { poNumber: { contains: search } } : {}),
    ...(dateFrom || dateTo
      ? {
          orderDate: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include: LIST_INCLUDE, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    purchaseOrders: orders.map(({ _count, ...order }) => ({ ...order, itemCount: _count.items })),
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

async function getById(id) {
  const order = await prisma.purchaseOrder.findUnique({ where: { purchaseOrderId: Number(id) }, include: DETAIL_INCLUDE });
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }
  return order;
}

async function create(data, currentUser) {
  const { supplierId, expectedDate, notes, items } = data;

  if (!supplierId) {
    throw new ApiError(400, 'supplierId is required');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items must be a non-empty array');
  }
  for (const item of items) {
    if (!item.description || !item.qty || Number(item.qty) <= 0 || item.unitPrice === undefined || Number(item.unitPrice) < 0) {
      throw new ApiError(400, 'Each item requires description, qty > 0, and unitPrice >= 0');
    }
  }

  const supplier = await prisma.supplier.findUnique({ where: { supplierId: Number(supplierId) } });
  if (!supplier) {
    throw new ApiError(400, 'Invalid supplierId');
  }

  const materialIds = items.filter((i) => i.materialId).map((i) => Number(i.materialId));
  if (materialIds.length > 0) {
    const materials = await prisma.material.findMany({ where: { materialId: { in: materialIds } } });
    if (materials.length !== new Set(materialIds).size) {
      throw new ApiError(400, 'One or more materialId is invalid');
    }
  }

  const itemsWithTotal = items.map((item) => ({
    materialId: item.materialId ? Number(item.materialId) : null,
    description: item.description,
    qty: Number(item.qty),
    unitPrice: Number(item.unitPrice),
    lineTotal: Math.round(Number(item.qty) * Number(item.unitPrice) * 100) / 100,
  }));
  const totalAmount = itemsWithTotal.reduce((sum, i) => sum + i.lineTotal, 0);

  const poNumber = await generatePoNumber();

  return prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: Number(supplierId),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: notes || null,
      totalAmount,
      createdBy: currentUser.userId,
      items: { create: itemsWithTotal },
    },
    include: DETAIL_INCLUDE,
  });
}

async function update(id, data, currentUser) {
  const { status, cashAccountId, expectedDate, notes } = data;

  const order = await prisma.purchaseOrder.findUnique({ where: { purchaseOrderId: Number(id) }, include: { items: true } });
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  const updateData = {
    ...(expectedDate !== undefined ? { expectedDate: expectedDate ? new Date(expectedDate) : null } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };

  if (status && status !== order.status) {
    const allowedNext = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      throw new ApiError(400, `Cannot transition purchase order status from '${order.status}' to '${status}'`);
    }
    if (status === 'paid') {
      if (!cashAccountId) {
        throw new ApiError(400, 'cashAccountId is required to mark a purchase order as paid');
      }
      const account = await prisma.cashAccount.findUnique({ where: { cashAccountId: Number(cashAccountId) } });
      if (!account) {
        throw new ApiError(400, 'Invalid cashAccountId');
      }
      updateData.cashAccountId = Number(cashAccountId);
      updateData.paidAt = new Date();
    }
    updateData.status = status;
  }

  // Diterima -> stok Material otomatis bertambah untuk tiap item yang tertaut ke katalog Material
  // (materialId), avgCost ikut di-recompute pakai rata-rata tertimbang. Item tanpa materialId
  // (barang non-katalog, mis. ATK) dilewati - murni pelaporan seperti sebelumnya.
  if (status === 'received') {
    return prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.materialId) {
          await applyStockMovement(tx, {
            materialId: item.materialId,
            type: 'in',
            qty: item.qty,
            unitCost: item.unitPrice,
            createdBy: currentUser?.userId,
          });
        }
      }
      return tx.purchaseOrder.update({ where: { purchaseOrderId: Number(id) }, data: updateData, include: DETAIL_INCLUDE });
    });
  }

  return prisma.purchaseOrder.update({
    where: { purchaseOrderId: Number(id) },
    data: updateData,
    include: DETAIL_INCLUDE,
  });
}

module.exports = { list, getById, create, update, generatePoNumber };
