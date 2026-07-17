// M03: Production Order / PO
// Fitur kunci (PRD 3.2): Buat PO, upload file, produk, ukuran, qty, deadline, revisi, approval

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS, ROLES } = require('../../common/constants');

// Alur status PO (PRD 3.5). hold/rework/complaint adalah cabang yang bisa kembali ke alur utama.
const STATUS_TRANSITIONS = {
  [PO_STATUS.DRAFT]: [PO_STATUS.APPROVED],
  [PO_STATUS.APPROVED]: [PO_STATUS.POS, PO_STATUS.HOLD],
  [PO_STATUS.POS]: [PO_STATUS.MATERIAL, PO_STATUS.HOLD],
  [PO_STATUS.MATERIAL]: [PO_STATUS.QUEUE, PO_STATUS.HOLD],
  [PO_STATUS.HOLD]: [PO_STATUS.MATERIAL, PO_STATUS.QUEUE, PO_STATUS.APPROVED],
  [PO_STATUS.QUEUE]: [PO_STATUS.PRODUCTION],
  [PO_STATUS.PRODUCTION]: [PO_STATUS.QC, PO_STATUS.HOLD],
  [PO_STATUS.QC]: [PO_STATUS.READY, PO_STATUS.REWORK],
  [PO_STATUS.REWORK]: [PO_STATUS.PRODUCTION],
  [PO_STATUS.READY]: [PO_STATUS.DONE, PO_STATUS.COMPLAINT],
  [PO_STATUS.COMPLAINT]: [PO_STATUS.REWORK, PO_STATUS.DONE],
  [PO_STATUS.DONE]: [],
};

const LIST_INCLUDE = {
  customer: { select: { customerId: true, name: true, phone: true } },
  designer: { select: { userId: true, name: true } },
  _count: { select: { poDetails: true } },
};

const DETAIL_INCLUDE = {
  customer: true,
  designer: { select: { userId: true, name: true, email: true } },
  poDetails: { include: { product: true } },
};

async function generatePoNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const countToday = await prisma.productionOrder.count({ where: { createdAt: { gte: startOfDay } } });
  return `PO-${datePart}-${String(countToday + 1).padStart(4, '0')}`;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

async function list(query) {
  const { status, customerId, designerId, search, dateFrom, dateTo, page, pageSize } = query;

  const where = {
    ...(status ? { status } : {}),
    ...(customerId ? { customerId: Number(customerId) } : {}),
    ...(designerId ? { designerId: Number(designerId) } : {}),
    ...(search ? { poNumber: { contains: search } } : {}),
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

  const [orders, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.productionOrder.count({ where }),
  ]);

  return {
    orders: orders.map(({ _count, ...order }) => ({ ...order, itemCount: _count.poDetails })),
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

async function getById(id) {
  const order = await prisma.productionOrder.findUnique({
    where: { poId: Number(id) },
    include: DETAIL_INCLUDE,
  });

  if (!order) {
    throw new ApiError(404, 'Production order not found');
  }

  return order;
}

async function create(data, currentUser) {
  const { customerId, designerId, priority, dueAt, notes, poDetails } = data;

  if (!customerId) {
    throw new ApiError(400, 'customerId is required');
  }
  if (!Array.isArray(poDetails) || poDetails.length === 0) {
    throw new ApiError(400, 'poDetails must be a non-empty array');
  }
  for (const item of poDetails) {
    if (!item.productId || !item.qty || item.qty <= 0) {
      throw new ApiError(400, 'Each poDetail requires productId and qty > 0');
    }
  }

  const resolvedDesignerId = currentUser?.roleName === ROLES.DESIGNER ? currentUser.userId : designerId;
  if (!resolvedDesignerId) {
    throw new ApiError(400, 'designerId is required');
  }

  const [customer, designer] = await Promise.all([
    prisma.customer.findUnique({ where: { customerId: Number(customerId) } }),
    prisma.user.findUnique({ where: { userId: Number(resolvedDesignerId) } }),
  ]);
  if (!customer) {
    throw new ApiError(400, 'Invalid customerId');
  }
  if (!designer) {
    throw new ApiError(400, 'Invalid designerId');
  }

  const productIds = poDetails.map((item) => Number(item.productId));
  const products = await prisma.product.findMany({ where: { productId: { in: productIds } } });
  if (products.length !== new Set(productIds).size) {
    throw new ApiError(400, 'One or more productId is invalid');
  }
  const productById = new Map(products.map((p) => [p.productId, p]));

  // Mode area (mis. "Per m2") butuh Lebar x Tinggi, mode lain (Per Pcs, Per Menit, dst) cuma Qty -
  // sama seperti kalkulator storefront (storefront.calculator.js), tapi ini untuk PO staff input manual.
  const pricingModes = await prisma.pricingMode.findMany();
  const calcTypeByKey = new Map(pricingModes.map((m) => [m.key, m.calcType]));

  for (const item of poDetails) {
    const product = productById.get(Number(item.productId));
    const calcType = calcTypeByKey.get(product.pricingMode) || 'scalar';
    if (calcType === 'area') {
      const width = Number(item.widthCm);
      const height = Number(item.heightCm);
      if (!width || width <= 0 || !height || height <= 0) {
        throw new ApiError(400, `Produk "${product.name}" pakai mode area - Lebar dan Tinggi wajib diisi (> 0)`);
      }
    }
  }

  const poNumber = await generatePoNumber();

  return prisma.productionOrder.create({
    data: {
      poNumber,
      customerId: Number(customerId),
      designerId: Number(resolvedDesignerId),
      priority: priority ? Number(priority) : 0,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      notes,
      poDetails: {
        create: poDetails.map((item) => {
          const product = productById.get(Number(item.productId));
          const calcType = calcTypeByKey.get(product.pricingMode) || 'scalar';
          const isArea = calcType === 'area';
          const widthCm = isArea ? Math.round(Number(item.widthCm) * 100) / 100 : null;
          const heightCm = isArea ? Math.round(Number(item.heightCm) * 100) / 100 : null;
          return {
            productId: Number(item.productId),
            qty: Number(item.qty),
            size: isArea ? `${widthCm} x ${heightCm} cm` : item.size,
            widthCm,
            heightCm,
            fileUrl: item.fileUrl,
            specNote: item.specNote,
          };
        }),
      },
    },
    include: DETAIL_INCLUDE,
  });
}

async function update(id, data) {
  const { status, priority, dueAt, notes } = data;

  const order = await prisma.productionOrder.findUnique({ where: { poId: Number(id) } });
  if (!order) {
    throw new ApiError(404, 'Production order not found');
  }

  if (status && status !== order.status) {
    const allowedNext = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      throw new ApiError(400, `Cannot transition PO status from '${order.status}' to '${status}'`);
    }
  }

  return prisma.productionOrder.update({
    where: { poId: Number(id) },
    data: {
      ...(status ? { status } : {}),
      ...(priority !== undefined ? { priority: Number(priority) } : {}),
      ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: DETAIL_INCLUDE,
  });
}

module.exports = { list, getById, create, update, generatePoNumber };
