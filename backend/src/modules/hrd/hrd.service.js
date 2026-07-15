// M10: HRD Productivity
// Fitur kunci (PRD 3.2): Output per karyawan, durasi task, revisi, rework, SLA, ranking performa

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { ROLES } = require('../../common/constants');

const PRIVILEGED_ROLES = [ROLES.HRD, ROLES.MANAGER];
const KPI_INCLUDE = { user: { select: { userId: true, name: true } } };

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

// --- Daily KPI (entri manual) ---

async function list(query, currentUser) {
  const { userId, role, metric, date } = query;
  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);

  const where = {
    ...(userId ? { userId: Number(userId) } : {}),
    ...(role ? { role } : {}),
    ...(metric ? { metric } : {}),
    ...(date ? { date: new Date(date) } : {}),
    ...(canSeeAll ? {} : { userId: currentUser?.userId }),
  };

  return prisma.dailyKpi.findMany({ where, include: KPI_INCLUDE, orderBy: { date: 'desc' } });
}

async function getById(id, currentUser) {
  const kpi = await prisma.dailyKpi.findUnique({ where: { kpiId: Number(id) }, include: KPI_INCLUDE });
  if (!kpi) {
    throw new ApiError(404, 'KPI record not found');
  }
  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);
  if (!canSeeAll && kpi.userId !== currentUser?.userId) {
    throw new ApiError(403, 'Cannot view KPI record of another user');
  }
  return kpi;
}

async function create(data) {
  const { date, role, metric, value, userId } = data;

  if (!date || !role || !metric || value === undefined) {
    throw new ApiError(400, 'date, role, metric, and value are required');
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { userId: Number(userId) } });
    if (!user) {
      throw new ApiError(400, 'Invalid userId');
    }
  }

  return prisma.dailyKpi.create({
    data: {
      date: new Date(date),
      role,
      metric,
      value: Number(value),
      userId: userId ? Number(userId) : undefined,
    },
    include: KPI_INCLUDE,
  });
}

async function update(id, data) {
  const { value } = data;

  const kpi = await prisma.dailyKpi.findUnique({ where: { kpiId: Number(id) } });
  if (!kpi) {
    throw new ApiError(404, 'KPI record not found');
  }
  if (value === undefined) {
    throw new ApiError(400, 'value is required');
  }

  return prisma.dailyKpi.update({
    where: { kpiId: Number(id) },
    data: { value: Number(value) },
    include: KPI_INCLUDE,
  });
}

// --- Laporan Produktivitas (output, durasi, rework, SLA) ---

async function getProductivityReport(query) {
  const { from, to } = parseRange(query);
  const slaHours = query.slaHours ? Number(query.slaHours) : 24;

  const users = await prisma.user.findMany({
    where: { isSystem: false }, // kecualikan akun sistem (checkout storefront) dari laporan produktivitas staf
    select: { userId: true, name: true, role: { select: { roleName: true } } },
  });

  const stats = new Map(
    users.map((u) => [
      u.userId,
      {
        userId: u.userId,
        name: u.name,
        role: u.role.roleName,
        poCreated: 0,
        tasksCompleted: 0,
        totalDurationHours: 0,
        tasksOverSla: 0,
        reworkCount: 0,
        qcPerformed: 0,
      },
    ])
  );

  const [orders, tasks, qcChecks] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { designerId: true },
    }),
    prisma.productionTask.findMany({
      where: { status: 'done', finishAt: { gte: from, lte: to } },
      select: { operatorId: true, startAt: true, finishAt: true },
    }),
    prisma.qcCheck.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { qcBy: true, result: true },
    }),
  ]);

  for (const o of orders) {
    const s = stats.get(o.designerId);
    if (s) s.poCreated += 1;
  }

  for (const t of tasks) {
    if (!t.operatorId) continue;
    const s = stats.get(t.operatorId);
    if (!s) continue;
    s.tasksCompleted += 1;
    if (t.startAt && t.finishAt) {
      const hours = (t.finishAt - t.startAt) / 3600000;
      s.totalDurationHours += hours;
      if (hours > slaHours) s.tasksOverSla += 1;
    }
  }

  for (const q of qcChecks) {
    const s = stats.get(q.qcBy);
    if (!s) continue;
    s.qcPerformed += 1;
    if (q.result === 'fail') s.reworkCount += 1;
  }

  return Array.from(stats.values())
    .map((s) => ({
      ...s,
      avgDurationHours: s.tasksCompleted ? Number((s.totalDurationHours / s.tasksCompleted).toFixed(2)) : 0,
      totalDurationHours: Number(s.totalDurationHours.toFixed(2)),
    }))
    .filter((s) => s.poCreated > 0 || s.tasksCompleted > 0 || s.qcPerformed > 0);
}

async function getRanking(query) {
  const metric = query.metric || 'tasksCompleted';
  const validMetrics = ['poCreated', 'tasksCompleted', 'qcPerformed', 'avgDurationHours'];
  if (!validMetrics.includes(metric)) {
    throw new ApiError(400, `metric must be one of ${validMetrics.join(', ')}`);
  }
  const limit = query.limit ? Number(query.limit) : 10;

  const report = await getProductivityReport(query);
  return report.sort((a, b) => b[metric] - a[metric]).slice(0, limit);
}

module.exports = { list, getById, create, update, getProductivityReport, getRanking };
