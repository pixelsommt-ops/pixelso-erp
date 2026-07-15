// M08: Finance & Bonus
// Fitur kunci (PRD 3.2): Omzet, HPP, margin, bonus role, closing harian/bulanan, rekonsiliasi

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { ROLES } = require('../../common/constants');

const BONUS_SOURCES = ['po', 'pos', 'production', 'qc', 'marketing'];
const PRIVILEGED_ROLES = [ROLES.FINANCE, ROLES.MANAGER];

const BONUS_INCLUDE = {
  user: { select: { userId: true, name: true, role: { select: { roleName: true } } } },
};

// --- Bonus Records ---

async function list(query, currentUser) {
  const { userId, period, source } = query;

  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);
  const where = {
    ...(userId ? { userId: Number(userId) } : {}),
    ...(period ? { period } : {}),
    ...(source ? { source } : {}),
    ...(canSeeAll ? {} : { userId: currentUser?.userId }),
  };

  return prisma.bonusRecord.findMany({ where, include: BONUS_INCLUDE, orderBy: { bonusId: 'desc' } });
}

async function getById(id, currentUser) {
  const record = await prisma.bonusRecord.findUnique({ where: { bonusId: Number(id) }, include: BONUS_INCLUDE });
  if (!record) {
    throw new ApiError(404, 'Bonus record not found');
  }
  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);
  if (!canSeeAll && record.userId !== currentUser?.userId) {
    throw new ApiError(403, 'Cannot view bonus record of another user');
  }
  return record;
}

async function create(data) {
  const { userId, period, source, score, amount } = data;

  if (!userId || !period || !source || amount === undefined) {
    throw new ApiError(400, 'userId, period, source, and amount are required');
  }
  if (!BONUS_SOURCES.includes(source)) {
    throw new ApiError(400, `source must be one of ${BONUS_SOURCES.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError(400, "period must be in 'YYYY-MM' format");
  }

  const user = await prisma.user.findUnique({ where: { userId: Number(userId) } });
  if (!user) {
    throw new ApiError(400, 'Invalid userId');
  }

  try {
    return await prisma.bonusRecord.create({
      data: {
        userId: Number(userId),
        period,
        source,
        score: score !== undefined ? Number(score) : 0,
        amount: Number(amount),
      },
      include: BONUS_INCLUDE,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(409, 'Bonus record for this user/period/source already exists - update it instead');
    }
    throw err;
  }
}

async function update(id, data) {
  const { score, amount } = data;

  const record = await prisma.bonusRecord.findUnique({ where: { bonusId: Number(id) } });
  if (!record) {
    throw new ApiError(404, 'Bonus record not found');
  }

  return prisma.bonusRecord.update({
    where: { bonusId: Number(id) },
    data: {
      // Koreksi manual terhadap entri (termasuk yang tadinya auto-generated) menandainya
      // isAuto=false, supaya tidak tertimpa lagi oleh auto-calculate berikutnya.
      isAuto: false,
      ...(score !== undefined ? { score: Number(score) } : {}),
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
    },
    include: BONUS_INCLUDE,
  });
}

// --- Laporan Omzet / HPP / Margin (closing harian/bulanan, rekonsiliasi) ---

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

async function getRevenueReport(query) {
  const { from, to } = parseRange(query);

  const payments = await prisma.payment.findMany({
    // Bukti transfer storefront yang masih 'pending' belum diverifikasi staf - jangan ikut terhitung omzet.
    where: { paidAt: { gte: from, lte: to }, status: 'confirmed' },
    include: { sale: { select: { saleId: true, poId: true, paidStatus: true } } },
  });
  const validPayments = payments.filter((p) => p.sale.paidStatus !== 'void');
  const omzet = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const movements = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: from, lte: to }, type: { in: ['out', 'reserve'] }, poId: { not: null } },
    include: { material: { select: { avgCost: true } } },
  });
  const hpp = movements.reduce((sum, m) => sum + Number(m.qty) * Number(m.material.avgCost), 0);

  const margin = omzet - hpp;

  const byDay = {};
  for (const p of validPayments) {
    const day = p.paidAt.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + Number(p.amount);
  }
  const dailyBreakdown = Object.entries(byDay)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    omzet,
    hpp,
    margin,
    transactionCount: validPayments.length,
    dailyBreakdown,
  };
}

// --- Bonus Otomatis ---
// Formula belum ada di PRD/dokumen sumber, jadi dipakai rate tetap per aktivitas (Rp/unit),
// terdokumentasi di sini dan mudah diubah. score = jumlah aktivitas pada periode tsb, amount = score * rate.
const AUTO_BONUS_RATES = {
  po: 5000, // per PO yang dibuat desainer (status bukan draft)
  pos: 3000, // per invoice yang dibuat kasir (tidak void)
  production: 4000, // per job ticket yang diselesaikan operator
  qc: 2000, // per pemeriksaan QC yang dilakukan
};

async function autoCalculateBonus(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError(400, "period is required in 'YYYY-MM' format");
  }

  const [year, month] = period.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const [orders, sales, tasks, qcChecks] = await Promise.all([
    prisma.productionOrder.groupBy({
      by: ['designerId'],
      // User sistem (checkout storefront) dikecualikan supaya tidak dapat bonus_records palsu.
      where: { createdAt: { gte: from, lte: to }, status: { not: 'draft' }, designer: { isSystem: false } },
      _count: { designerId: true },
    }),
    prisma.salesPos.groupBy({
      by: ['cashierId'],
      where: { createdAt: { gte: from, lte: to }, paidStatus: { not: 'void' }, cashier: { isSystem: false } },
      _count: { cashierId: true },
    }),
    prisma.productionTask.groupBy({
      by: ['operatorId'],
      where: { status: 'done', finishAt: { gte: from, lte: to }, operatorId: { not: null } },
      _count: { operatorId: true },
    }),
    prisma.qcCheck.groupBy({
      by: ['qcBy'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { qcBy: true },
    }),
  ]);

  const rows = [
    ...orders.map((o) => ({ userId: o.designerId, source: 'po', count: o._count.designerId })),
    ...sales.map((s) => ({ userId: s.cashierId, source: 'pos', count: s._count.cashierId })),
    ...tasks.map((t) => ({ userId: t.operatorId, source: 'production', count: t._count.operatorId })),
    ...qcChecks.map((q) => ({ userId: q.qcBy, source: 'qc', count: q._count.qcBy })),
  ].filter((r) => r.userId && r.count > 0);

  // Jangan timpa entri manual (isAuto=false) yang sudah ada untuk kombinasi userId/period/source yang sama.
  const existing = await prisma.bonusRecord.findMany({
    where: { period, isAuto: false, OR: rows.map((r) => ({ userId: r.userId, source: r.source })) },
    select: { userId: true, source: true },
  });
  const manualKeys = new Set(existing.map((e) => `${e.userId}:${e.source}`));
  const autoRows = rows.filter((r) => !manualKeys.has(`${r.userId}:${r.source}`));

  if (autoRows.length === 0) {
    return [];
  }

  const results = await prisma.$transaction(
    autoRows.map((r) =>
      prisma.bonusRecord.upsert({
        where: { userId_period_source: { userId: r.userId, period, source: r.source } },
        create: {
          userId: r.userId,
          period,
          source: r.source,
          score: r.count,
          amount: r.count * AUTO_BONUS_RATES[r.source],
          isAuto: true,
        },
        update: {
          score: r.count,
          amount: r.count * AUTO_BONUS_RATES[r.source],
          isAuto: true,
        },
        include: BONUS_INCLUDE,
      })
    )
  );

  return results;
}

module.exports = { list, getById, create, update, getRevenueReport, autoCalculateBonus };
