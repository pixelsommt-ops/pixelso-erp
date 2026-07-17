// Kontrak Kerja - riwayat per karyawan (renewal nambah baris baru, bukan overwrite). Data gaji
// (baseSalary) sensitif - seluruh modul ini (termasuk GET) dibatasi HRD & manager di routes.js.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const CONTRACT_TYPES = ['PKWT', 'PKWTT', 'Magang', 'Harian Lepas'];
const STATUSES = ['active', 'expired', 'terminated'];

const INCLUDE = { user: { select: { userId: true, name: true, email: true } } };

async function list(query) {
  const { userId } = query;
  return prisma.employmentContract.findMany({
    where: userId ? { userId: Number(userId) } : {},
    include: INCLUDE,
    orderBy: { startDate: 'desc' },
  });
}

async function getById(id) {
  const contract = await prisma.employmentContract.findUnique({ where: { contractId: Number(id) }, include: INCLUDE });
  if (!contract) {
    throw new ApiError(404, 'Contract not found');
  }
  return contract;
}

async function create(data) {
  const { userId, contractType, startDate, endDate, baseSalary, status, notes } = data;

  if (!userId || !contractType || !startDate || baseSalary === undefined) {
    throw new ApiError(400, 'userId, contractType, startDate, and baseSalary are required');
  }
  if (!CONTRACT_TYPES.includes(contractType)) {
    throw new ApiError(400, `contractType must be one of ${CONTRACT_TYPES.join(', ')}`);
  }
  if (Number(baseSalary) < 0) {
    throw new ApiError(400, 'baseSalary must be >= 0');
  }

  const user = await prisma.user.findUnique({ where: { userId: Number(userId) } });
  if (!user) {
    throw new ApiError(400, 'Invalid userId');
  }

  return prisma.employmentContract.create({
    data: {
      userId: Number(userId),
      contractType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      baseSalary: Number(baseSalary),
      status: status && STATUSES.includes(status) ? status : 'active',
      notes: notes || null,
    },
    include: INCLUDE,
  });
}

async function update(id, data) {
  const { contractType, startDate, endDate, baseSalary, status, notes } = data;
  await getById(id);

  if (contractType && !CONTRACT_TYPES.includes(contractType)) {
    throw new ApiError(400, `contractType must be one of ${CONTRACT_TYPES.join(', ')}`);
  }
  if (status && !STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of ${STATUSES.join(', ')}`);
  }
  if (baseSalary !== undefined && Number(baseSalary) < 0) {
    throw new ApiError(400, 'baseSalary must be >= 0');
  }

  return prisma.employmentContract.update({
    where: { contractId: Number(id) },
    data: {
      ...(contractType ? { contractType } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(baseSalary !== undefined ? { baseSalary: Number(baseSalary) } : {}),
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: INCLUDE,
  });
}

async function deleteContract(id) {
  await getById(id);
  return prisma.employmentContract.delete({ where: { contractId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteContract, CONTRACT_TYPES, STATUSES };
