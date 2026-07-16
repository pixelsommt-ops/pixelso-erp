// M04: POS & Pembayaran
// Fitur kunci (PRD 3.2): Invoice, DP, pelunasan, diskon, metode bayar, piutang, refund/void terkontrol

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS, ROLES } = require('../../common/constants');

const DETAIL_INCLUDE = {
  productionOrder: {
    select: {
      poId: true,
      poNumber: true,
      status: true,
      customer: { select: { customerId: true, name: true, phone: true } },
    },
  },
  cashier: { select: { userId: true, name: true } },
  payments: { orderBy: { paidAt: 'asc' } },
};

function paidStatusFor(total, paidSoFar) {
  if (paidSoFar <= 0) return 'unpaid';
  if (paidSoFar >= total) return 'paid';
  return 'partial';
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

async function list(query) {
  const { paidStatus, poId, cashierId, dateFrom, dateTo, page, pageSize } = query;

  const where = {
    ...(paidStatus ? { paidStatus } : {}),
    ...(poId ? { poId: Number(poId) } : {}),
    ...(cashierId ? { cashierId: Number(cashierId) } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  // Wajib dipaginasi - tabel ini sekarang berisi puluhan ribu baris histori migrasi POS lama
  // (lihat migrate-legacy-sales.js), findMany tanpa batas bikin tab browser staf freeze.
  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [sales, total] = await Promise.all([
    prisma.salesPos.findMany({ where, include: DETAIL_INCLUDE, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.salesPos.count({ where }),
  ]);

  return { sales, total, page: currentPage, pageSize: take, totalPages: Math.max(1, Math.ceil(total / take)) };
}

async function getById(id) {
  const sale = await prisma.salesPos.findUnique({ where: { saleId: Number(id) }, include: DETAIL_INCLUDE });
  if (!sale) {
    throw new ApiError(404, 'Sale not found');
  }
  return sale;
}

async function create(data, currentUser) {
  const { poId, discount, dp, paymentMethod } = data;

  if (!poId) {
    throw new ApiError(400, 'poId is required');
  }
  if (!currentUser) {
    throw new ApiError(401, 'Not authenticated');
  }

  const existingSale = await prisma.salesPos.findUnique({ where: { poId: Number(poId) } });
  if (existingSale) {
    throw new ApiError(409, 'This production order already has a sale/invoice');
  }

  const order = await prisma.productionOrder.findUnique({
    where: { poId: Number(poId) },
    include: { poDetails: { include: { product: true } } },
  });
  if (!order) {
    throw new ApiError(400, 'Invalid poId');
  }
  if (![PO_STATUS.APPROVED, PO_STATUS.POS].includes(order.status)) {
    throw new ApiError(400, `Production order must be in '${PO_STATUS.APPROVED}' status before invoicing (currently '${order.status}')`);
  }

  const subtotal = order.poDetails.reduce(
    (sum, detail) => sum + Number(detail.product.basePrice) * detail.qty,
    0
  );
  const total = Math.max(subtotal - (discount ? Number(discount) : 0), 0);
  const dpAmount = dp ? Number(dp) : 0;
  if (dpAmount > total) {
    throw new ApiError(400, 'dp cannot exceed total');
  }
  if (dpAmount > 0 && !paymentMethod) {
    throw new ApiError(400, 'paymentMethod is required when dp > 0');
  }

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.salesPos.create({
      data: {
        poId: Number(poId),
        cashierId: currentUser.userId,
        total,
        dp: dpAmount,
        paidStatus: paidStatusFor(total, dpAmount),
        ...(dpAmount > 0
          ? { payments: { create: [{ method: paymentMethod, amount: dpAmount }] } }
          : {}),
      },
      include: DETAIL_INCLUDE,
    });

    if (order.status === PO_STATUS.APPROVED) {
      await tx.productionOrder.update({ where: { poId: Number(poId) }, data: { status: PO_STATUS.POS } });
    }

    return created;
  });

  return sale;
}

async function update(id, data, currentUser) {
  const { payment, void: shouldVoid } = data;

  const sale = await prisma.salesPos.findUnique({ where: { saleId: Number(id) }, include: { payments: true } });
  if (!sale) {
    throw new ApiError(404, 'Sale not found');
  }
  if (sale.paidStatus === 'void') {
    throw new ApiError(400, 'This sale has been voided');
  }

  if (shouldVoid) {
    if (!currentUser || ![ROLES.MANAGER, ROLES.FINANCE].includes(currentUser.roleName)) {
      throw new ApiError(403, 'Only manager or finance can void a sale');
    }
    return prisma.salesPos.update({
      where: { saleId: Number(id) },
      data: { paidStatus: 'void' },
      include: DETAIL_INCLUDE,
    });
  }

  if (payment) {
    const { amount, method } = payment;
    if (!amount || amount <= 0 || !method) {
      throw new ApiError(400, 'payment requires amount > 0 and method');
    }

    // Cuma payment yang sudah confirmed dihitung "sudah lunas" - bukti transfer storefront yang
    // masih pending tidak boleh bikin order kelihatan lunas sebelum staf verifikasi.
    const paidSoFar = sale.payments
      .filter((p) => p.status === 'confirmed')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(sale.total) - paidSoFar;
    if (amount > remaining) {
      throw new ApiError(400, `payment amount exceeds remaining balance (${remaining})`);
    }

    return prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: { saleId: Number(id), amount: Number(amount), method } });
      const newPaidSoFar = paidSoFar + Number(amount);
      return tx.salesPos.update({
        where: { saleId: Number(id) },
        data: { paidStatus: paidStatusFor(Number(sale.total), newPaidSoFar) },
        include: DETAIL_INCLUDE,
      });
    });
  }

  throw new ApiError(400, 'Nothing to update: provide payment or void');
}

// Staf konfirmasi/tolak bukti transfer yang diupload pelanggan lewat storefront (Payment.status 'pending').
async function confirmPayment(saleId, paymentId, action, currentUser) {
  if (!['confirm', 'reject'].includes(action)) {
    throw new ApiError(400, "action must be 'confirm' or 'reject'");
  }

  const sale = await prisma.salesPos.findUnique({ where: { saleId: Number(saleId) }, include: { payments: true } });
  if (!sale) {
    throw new ApiError(404, 'Sale not found');
  }
  const payment = sale.payments.find((p) => p.paymentId === Number(paymentId));
  if (!payment) {
    throw new ApiError(404, 'Payment not found on this sale');
  }
  if (payment.status !== 'pending') {
    throw new ApiError(400, `Payment already ${payment.status}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { paymentId: Number(paymentId) },
      data: {
        status: action === 'confirm' ? 'confirmed' : 'rejected',
        confirmedBy: currentUser.userId,
        confirmedAt: new Date(),
      },
    });

    const confirmedPaid = sale.payments
      .filter((p) => p.paymentId !== Number(paymentId) && p.status === 'confirmed')
      .reduce((sum, p) => sum + Number(p.amount), 0)
      + (action === 'confirm' ? Number(payment.amount) : 0);

    return tx.salesPos.update({
      where: { saleId: Number(saleId) },
      data: { paidStatus: paidStatusFor(Number(sale.total), confirmedPaid) },
      include: DETAIL_INCLUDE,
    });
  });
}

module.exports = { list, getById, create, update, confirmPayment };
