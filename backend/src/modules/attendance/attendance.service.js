// Kehadiran (Time & Attendance) - absen manual dari ERP (belum ada mesin fisik, lihat catatan
// source di schema.prisma). checkIn/checkOut upsert by [userId,date] - satu baris per staf per
// hari, checkIn dan checkOut adalah dua aksi terpisah yang mengisi baris yang sama.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { ROLES } = require('../../common/constants');

const PRIVILEGED_ROLES = [ROLES.HRD, ROLES.MANAGER];
const INCLUDE = { user: { select: { userId: true, name: true } } };

// Date.UTC (bukan konstruktor `new Date(y,m,d)` biasa yang pakai local time) - komponen
// tahun/bulan/tanggal tetap dari kalender lokal server (WIB), tapi hasilnya dijangkarkan ke
// UTC midnight. Kalau pakai local-midnight biasa, server di timezone +7 (WIB) bikin tanggal
// bergeser mundur satu hari begitu masuk kolom `@db.Date` (MySQL menyimpan porsi tanggal versi
// UTC-nya) - ketahuan lewat testing manual: absen jam 20:36 WIB tanggal 17 malah tersimpan
// sebagai tanggal 16, bikin cek "sudah absen hari ini" salah dan @@unique([userId,date]) tidak
// pernah match pada absen kedua di hari yang sama.
function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

async function list(query, currentUser) {
  const { userId, dateFrom, dateTo } = query;
  const canSeeAll = currentUser && PRIVILEGED_ROLES.includes(currentUser.roleName);

  const where = {
    ...(userId && canSeeAll ? { userId: Number(userId) } : {}),
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

  return prisma.attendance.findMany({ where, include: INCLUDE, orderBy: { date: 'desc' } });
}

async function checkIn(currentUser, data) {
  const { lat, lng } = data || {};
  const date = todayDateOnly();

  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: currentUser.userId, date } } });
  if (existing?.checkInAt) {
    throw new ApiError(400, 'Sudah absen masuk hari ini');
  }

  const now = new Date();
  // Lewat jam 9 pagi dianggap terlambat - ambang sederhana, belum dikaitkan ke jadwal Shift
  // spesifik staf (butuh join ShiftAssignment kalau mau presisi per-shift, di luar cakupan pass ini).
  const isLate = now.getHours() >= 9;

  return prisma.attendance.upsert({
    where: { userId_date: { userId: currentUser.userId, date } },
    create: {
      userId: currentUser.userId,
      date,
      checkInAt: now,
      checkInLat: lat !== undefined ? Number(lat) : null,
      checkInLng: lng !== undefined ? Number(lng) : null,
      status: isLate ? 'late' : 'present',
      source: 'manual',
    },
    update: {
      checkInAt: now,
      checkInLat: lat !== undefined ? Number(lat) : null,
      checkInLng: lng !== undefined ? Number(lng) : null,
      status: isLate ? 'late' : 'present',
    },
    include: INCLUDE,
  });
}

async function checkOut(currentUser, data) {
  const { lat, lng } = data || {};
  const date = todayDateOnly();

  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: currentUser.userId, date } } });
  if (!existing || !existing.checkInAt) {
    throw new ApiError(400, 'Belum absen masuk hari ini');
  }
  if (existing.checkOutAt) {
    throw new ApiError(400, 'Sudah absen pulang hari ini');
  }

  return prisma.attendance.update({
    where: { userId_date: { userId: currentUser.userId, date } },
    data: {
      checkOutAt: new Date(),
      checkOutLat: lat !== undefined ? Number(lat) : null,
      checkOutLng: lng !== undefined ? Number(lng) : null,
    },
    include: INCLUDE,
  });
}

module.exports = { list, checkIn, checkOut };
