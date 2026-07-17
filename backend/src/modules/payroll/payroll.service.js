// Payroll Calculation - satu PayrollRun per periode (YYYY-MM), satu PayrollItem per karyawan
// dengan kontrak aktif. Lihat payroll.calculator.js untuk peringatan lengkap soal akurasi
// tarif PPh21/BPJS - BELUM diverifikasi ke konsultan pajak, jangan dipakai riil dulu.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { calculatePayrollItem } = require('./payroll.calculator');

const RUN_INCLUDE = {
  creator: { select: { userId: true, name: true } },
  items: {
    include: { user: { select: { userId: true, name: true, maritalStatus: true, dependentsCount: true } } },
    orderBy: { payrollItemId: 'asc' },
  },
};

async function listRuns() {
  return prisma.payrollRun.findMany({
    include: { creator: { select: { userId: true, name: true } }, _count: { select: { items: true } } },
    orderBy: { period: 'desc' },
  });
}

async function getRunById(id) {
  const run = await prisma.payrollRun.findUnique({ where: { payrollRunId: Number(id) }, include: RUN_INCLUDE });
  if (!run) {
    throw new ApiError(404, 'Payroll run not found');
  }
  return run;
}

async function createRun(period, currentUser) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ApiError(400, "period is required in 'YYYY-MM' format");
  }

  const existing = await prisma.payrollRun.findUnique({ where: { period } });
  if (existing) {
    throw new ApiError(409, `Payroll run untuk periode ${period} sudah ada`);
  }

  // Karyawan dengan kontrak aktif (status='active') - satu user bisa punya beberapa kontrak
  // historis, ambil yang paling baru per user.
  const activeContracts = await prisma.employmentContract.findMany({
    where: { status: 'active' },
    orderBy: { startDate: 'desc' },
    include: { user: { select: { userId: true, name: true, maritalStatus: true, dependentsCount: true } } },
  });
  const latestContractByUser = new Map();
  for (const c of activeContracts) {
    if (!latestContractByUser.has(c.userId)) latestContractByUser.set(c.userId, c);
  }

  if (latestContractByUser.size === 0) {
    throw new ApiError(400, 'Tidak ada karyawan dengan kontrak aktif - tidak ada yang bisa diproses payroll-nya');
  }

  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: { period, createdBy: currentUser.userId },
    });

    for (const contract of latestContractByUser.values()) {
      const calc = calculatePayrollItem({
        baseSalary: contract.baseSalary,
        overtimeHours: 0,
        incentive: 0,
        maritalStatus: contract.user.maritalStatus,
        dependentsCount: contract.user.dependentsCount,
      });
      await tx.payrollItem.create({
        data: {
          payrollRunId: run.payrollRunId,
          userId: contract.userId,
          baseSalary: contract.baseSalary,
          overtimeHours: 0,
          incentive: 0,
          ...calc,
        },
      });
    }

    return tx.payrollRun.findUnique({ where: { payrollRunId: run.payrollRunId }, include: RUN_INCLUDE });
  });
}

async function updateItem(itemId, data) {
  const { overtimeHours, incentive } = data;

  const item = await prisma.payrollItem.findUnique({
    where: { payrollItemId: Number(itemId) },
    include: { payrollRun: true, user: { select: { maritalStatus: true, dependentsCount: true } } },
  });
  if (!item) {
    throw new ApiError(404, 'Payroll item not found');
  }
  if (item.payrollRun.status === 'finalized') {
    throw new ApiError(400, 'Payroll run ini sudah difinalisasi - tidak bisa diubah lagi');
  }
  if (overtimeHours !== undefined && Number(overtimeHours) < 0) {
    throw new ApiError(400, 'overtimeHours must be >= 0');
  }
  if (incentive !== undefined && Number(incentive) < 0) {
    throw new ApiError(400, 'incentive must be >= 0');
  }

  const nextOvertimeHours = overtimeHours !== undefined ? Number(overtimeHours) : Number(item.overtimeHours);
  const nextIncentive = incentive !== undefined ? Number(incentive) : Number(item.incentive);

  const calc = calculatePayrollItem({
    baseSalary: item.baseSalary,
    overtimeHours: nextOvertimeHours,
    incentive: nextIncentive,
    maritalStatus: item.user.maritalStatus,
    dependentsCount: item.user.dependentsCount,
  });

  return prisma.payrollItem.update({
    where: { payrollItemId: Number(itemId) },
    data: { overtimeHours: nextOvertimeHours, incentive: nextIncentive, ...calc },
    include: { user: { select: { userId: true, name: true } } },
  });
}

async function finalizeRun(id) {
  const run = await prisma.payrollRun.findUnique({ where: { payrollRunId: Number(id) } });
  if (!run) {
    throw new ApiError(404, 'Payroll run not found');
  }
  if (run.status === 'finalized') {
    throw new ApiError(400, 'Payroll run ini sudah difinalisasi');
  }

  return prisma.payrollRun.update({
    where: { payrollRunId: Number(id) },
    data: { status: 'finalized', finalizedAt: new Date() },
    include: RUN_INCLUDE,
  });
}

module.exports = { listRuns, getRunById, createRun, updateItem, finalizeRun };
