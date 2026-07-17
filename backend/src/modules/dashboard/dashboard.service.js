// M11: Manager Dashboard
// Fitur kunci (PRD 3.2): Order masuk, antrean, stok kritis, omzet, margin, keterlambatan, komplain

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const financeService = require('../finance/finance.service');

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

module.exports = { list, getById, create, update, getSummary };
