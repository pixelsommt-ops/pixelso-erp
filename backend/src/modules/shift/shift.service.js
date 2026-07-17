// Manajemen Shift - dua konsep terkait dalam satu modul: definisi Shift (master, GET terbuka
// mirip Category) dan ShiftAssignment (penugasan staf ke shift per tanggal - lihat semua kalau
// HRD/manager, lihat punya sendiri kalau bukan, sama seperti pola BonusRecord di finance.service.js).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { ROLES } = require('../../common/constants');

const PRIVILEGED_ROLES = [ROLES.HRD, ROLES.MANAGER];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// --- Shift (definisi) ---

async function listShifts() {
  return prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
}

async function getShiftById(id) {
  const shift = await prisma.shift.findUnique({ where: { shiftId: Number(id) } });
  if (!shift) {
    throw new ApiError(404, 'Shift not found');
  }
  return shift;
}

async function createShift(data) {
  const { name, startTime, endTime } = data;
  if (!name || !startTime || !endTime) {
    throw new ApiError(400, 'name, startTime, and endTime are required');
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw new ApiError(400, "startTime/endTime must be in 'HH:mm' format");
  }
  return prisma.shift.create({ data: { name, startTime, endTime } });
}

async function updateShift(id, data) {
  const { name, startTime, endTime } = data;
  await getShiftById(id);
  if (startTime && !TIME_RE.test(startTime)) {
    throw new ApiError(400, "startTime must be in 'HH:mm' format");
  }
  if (endTime && !TIME_RE.test(endTime)) {
    throw new ApiError(400, "endTime must be in 'HH:mm' format");
  }
  return prisma.shift.update({
    where: { shiftId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    },
  });
}

async function deleteShift(id) {
  await getShiftById(id);
  const assignmentCount = await prisma.shiftAssignment.count({ where: { shiftId: Number(id) } });
  if (assignmentCount > 0) {
    throw new ApiError(400, 'Shift ini masih punya penugasan staf, tidak bisa dihapus');
  }
  return prisma.shift.delete({ where: { shiftId: Number(id) } });
}

// --- ShiftAssignment (penugasan) ---

const ASSIGNMENT_INCLUDE = {
  user: { select: { userId: true, name: true } },
  shift: { select: { shiftId: true, name: true, startTime: true, endTime: true } },
};

async function listAssignments(query, currentUser) {
  const { userId, dateFrom, dateTo } = query;
  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);

  const where = {
    ...(userId ? { userId: Number(userId) } : {}),
    ...(canSeeAll ? {} : { userId: currentUser?.userId }),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  return prisma.shiftAssignment.findMany({ where, include: ASSIGNMENT_INCLUDE, orderBy: { date: 'desc' } });
}

async function createAssignment(data) {
  const { userId, shiftId, date } = data;
  if (!userId || !shiftId || !date) {
    throw new ApiError(400, 'userId, shiftId, and date are required');
  }

  const [user, shift] = await Promise.all([
    prisma.user.findUnique({ where: { userId: Number(userId) } }),
    prisma.shift.findUnique({ where: { shiftId: Number(shiftId) } }),
  ]);
  if (!user) throw new ApiError(400, 'Invalid userId');
  if (!shift) throw new ApiError(400, 'Invalid shiftId');

  try {
    return await prisma.shiftAssignment.create({
      data: { userId: Number(userId), shiftId: Number(shiftId), date: new Date(date) },
      include: ASSIGNMENT_INCLUDE,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(409, 'Staf ini sudah punya shift di tanggal tersebut - hapus/ubah dulu penugasan yang ada');
    }
    throw err;
  }
}

async function deleteAssignment(id) {
  const assignment = await prisma.shiftAssignment.findUnique({ where: { assignmentId: Number(id) } });
  if (!assignment) {
    throw new ApiError(404, 'Shift assignment not found');
  }
  return prisma.shiftAssignment.delete({ where: { assignmentId: Number(id) } });
}

module.exports = {
  listShifts, getShiftById, createShift, updateShift, deleteShift,
  listAssignments, createAssignment, deleteAssignment,
};
