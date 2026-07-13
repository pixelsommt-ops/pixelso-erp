// M09: Marketing Analytics
// Fitur kunci (PRD 3.2): Produk laris, channel, customer repeat, campaign, cohort sederhana

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const CAMPAIGN_STATUSES = ['planned', 'active', 'completed', 'cancelled'];

function parseRange(query) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const from = query.from ? new Date(query.from) : defaultFrom;
  const to = query.to ? new Date(`${query.to}T23:59:59`) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, 'Invalid from/to date');
  }
  return { from, to };
}

// PO 'draft' belum dianggap order terkonfirmasi, jadi dikecualikan dari analytics.
const CONFIRMED_ORDER_WHERE = { status: { not: 'draft' } };

async function getTopProducts(query) {
  const { from, to } = parseRange(query);
  const limit = query.limit ? Number(query.limit) : 10;

  const details = await prisma.poDetail.findMany({
    where: { productionOrder: { ...CONFIRMED_ORDER_WHERE, createdAt: { gte: from, lte: to } } },
    include: { product: { select: { productId: true, name: true, category: true } } },
  });

  const byProduct = new Map();
  for (const d of details) {
    const key = d.productId;
    const entry = byProduct.get(key) || {
      productId: key,
      name: d.product.name,
      category: d.product.category,
      totalQty: 0,
      orderCount: 0,
      poIds: new Set(),
    };
    entry.totalQty += d.qty;
    entry.poIds.add(d.poId);
    byProduct.set(key, entry);
  }

  return Array.from(byProduct.values())
    .map(({ poIds, ...rest }) => ({ ...rest, orderCount: poIds.size }))
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, limit);
}

async function getChannelBreakdown(query) {
  const { from, to } = parseRange(query);

  const orders = await prisma.productionOrder.findMany({
    where: { ...CONFIRMED_ORDER_WHERE, createdAt: { gte: from, lte: to } },
    include: { customer: { select: { source: true } }, poDetails: { select: { qty: true } } },
  });

  const byChannel = new Map();
  for (const order of orders) {
    const channel = order.customer.source || 'unknown';
    const entry = byChannel.get(channel) || { channel, orderCount: 0, totalQty: 0 };
    entry.orderCount += 1;
    entry.totalQty += order.poDetails.reduce((sum, d) => sum + d.qty, 0);
    byChannel.set(channel, entry);
  }

  return Array.from(byChannel.values()).sort((a, b) => b.orderCount - a.orderCount);
}

async function getRepeatCustomers(query) {
  const minOrders = query.minOrders ? Number(query.minOrders) : 2;

  const customers = await prisma.customer.findMany({
    include: {
      _count: { select: { productionOrders: { where: CONFIRMED_ORDER_WHERE } } },
    },
  });

  return customers
    .filter((c) => c._count.productionOrders >= minOrders)
    .map(({ _count, ...c }) => ({ ...c, orderCount: _count.productionOrders }))
    .sort((a, b) => b.orderCount - a.orderCount);
}

async function getCohort() {
  const customers = await prisma.customer.findMany({
    include: {
      productionOrders: { where: CONFIRMED_ORDER_WHERE, select: { createdAt: true } },
    },
  });

  const cohorts = new Map();
  for (const c of customers) {
    if (c.productionOrders.length === 0) continue;
    const dates = c.productionOrders.map((o) => o.createdAt).sort((a, b) => a - b);
    const cohortMonth = dates[0].toISOString().slice(0, 7);
    const isRepeat = c.productionOrders.length > 1;

    const entry = cohorts.get(cohortMonth) || { cohortMonth, totalCustomers: 0, repeatCustomers: 0 };
    entry.totalCustomers += 1;
    if (isRepeat) entry.repeatCustomers += 1;
    cohorts.set(cohortMonth, entry);
  }

  return Array.from(cohorts.values())
    .map((c) => ({ ...c, repeatRate: c.totalCustomers ? Number((c.repeatCustomers / c.totalCustomers).toFixed(2)) : 0 }))
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
}

// --- Campaign (M09 CRUD utama modul ini) ---

async function list(query) {
  const { status, channel } = query;
  return prisma.campaign.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getById(id) {
  const campaign = await prisma.campaign.findUnique({ where: { campaignId: Number(id) } });
  if (!campaign) {
    throw new ApiError(404, 'Campaign not found');
  }
  return campaign;
}

async function create(data) {
  const { name, channel, startDate, endDate, budget, status, notes } = data;

  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (status && !CAMPAIGN_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of ${CAMPAIGN_STATUSES.join(', ')}`);
  }

  return prisma.campaign.create({
    data: {
      name,
      channel,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      budget: budget !== undefined ? Number(budget) : undefined,
      status: status || 'planned',
      notes,
    },
  });
}

async function update(id, data) {
  const { name, channel, startDate, endDate, budget, status, notes } = data;

  const campaign = await prisma.campaign.findUnique({ where: { campaignId: Number(id) } });
  if (!campaign) {
    throw new ApiError(404, 'Campaign not found');
  }
  if (status && !CAMPAIGN_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of ${CAMPAIGN_STATUSES.join(', ')}`);
  }

  return prisma.campaign.update({
    where: { campaignId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(channel !== undefined ? { channel } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(budget !== undefined ? { budget: Number(budget) } : {}),
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });
}

module.exports = { list, getById, create, update, getTopProducts, getChannelBreakdown, getRepeatCustomers, getCohort };
