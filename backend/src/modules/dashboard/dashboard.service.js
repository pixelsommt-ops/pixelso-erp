// M11: Manager Dashboard
// Fitur kunci (PRD 3.2): Order masuk, antrean, stok kritis, omzet, margin, keterlambatan, komplain

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const financeService = require('../finance/finance.service');
const marketingService = require('../marketing/marketing.service');

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

async function getSummary(query) {
  const { from, to } = parseRange(query);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    newOrdersInPeriod,
    newOrdersToday,
    statusGroups,
    activeTaskGroups,
    criticalStock,
    revenue,
    expenseSummary,
    overdueOrders,
    complaintOrders,
  ] = await Promise.all([
    prisma.productionOrder.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.productionOrder.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.productionOrder.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.productionTask.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.material.findMany(),
    financeService.getRevenueReport(query),
    financeService.getExpenseSummary(query),
    prisma.productionOrder.findMany({
      where: { dueAt: { lt: now }, status: { notIn: ['done'] } },
      select: { poId: true, poNumber: true, status: true, dueAt: true, customer: { select: { name: true } } },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.productionOrder.findMany({
      where: { status: 'complaint' },
      select: { poId: true, poNumber: true, dueAt: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const orderStatusBreakdown = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.status]));
  const taskQueueBreakdown = Object.fromEntries(activeTaskGroups.map((g) => [g.status, g._count.status]));
  const lowStockMaterials = criticalStock
    .filter((m) => Number(m.stockQty) <= Number(m.minStock))
    .map((m) => ({ materialId: m.materialId, name: m.name, stockQty: m.stockQty, minStock: m.minStock, unit: m.unit }));

  return {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    orderMasuk: { total: newOrdersInPeriod, today: newOrdersToday },
    antrean: {
      poByStatus: orderStatusBreakdown,
      taskByStatus: taskQueueBreakdown,
    },
    stokKritis: lowStockMaterials,
    keuangan: { omzet: revenue.omzet, hpp: revenue.hpp, margin: revenue.margin, pengeluaran: expenseSummary.total },
    keterlambatan: overdueOrders,
    komplain: complaintOrders,
  };
}

// Ringkasan "Dashboard Marketing" - terbuka untuk semua role login (lihat dashboard.routes.js),
// beda dari getSummary() di atas yang manager-only. Sengaja pakai fungsi marketing.service.js
// yang sudah ada (bukan query baru) supaya definisi "produk terlaris"/"repeat customer" konsisten
// satu sumber dengan halaman Marketing Analytics penuh.
async function getMarketingSummary() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  // getTopProducts() pakai marketing.service.js#parseRange, yang mengharapkan from/to berupa
  // string ("YYYY-MM-DD") lalu di-parse ulang sendiri di sana - Date object mentah bikin
  // template string `${to}T23:59:59` jadi string tanggal tidak valid.
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const [topProducts, repeatCustomers, activeCampaigns] = await Promise.all([
    marketingService.getTopProducts({ from: fromStr, to: toStr, limit: 10 }),
    marketingService.getRepeatCustomers({ minOrders: 2, from, to }).then((list) => list.slice(0, 10)),
    marketingService.list({ status: 'active' }),
  ]);

  return { topProducts, repeatCustomers, activeCampaigns };
}

// Generic CRUD pattern dipertahankan untuk konsistensi routing; list() default ke ringkasan dashboard.
async function list(query) {
  return getSummary(query);
}

async function getById() {
  throw new ApiError(400, 'Dashboard module exposes a read-only summary; use /api/dashboard/summary');
}

async function create() {
  throw new ApiError(400, 'No writable entity in Dashboard module');
}

async function update() {
  throw new ApiError(400, 'No writable entity in Dashboard module');
}

module.exports = { list, getById, create, update, getSummary, getMarketingSummary };
