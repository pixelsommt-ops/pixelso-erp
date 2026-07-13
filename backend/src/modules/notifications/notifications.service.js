// M12: Notification & Approval
// Fitur kunci (PRD 3.2): Notifikasi WhatsApp/email internal, approval harga, stok kurang, PO terlambat
//
// Alert dihitung real-time dari data operasional (disaring sesuai role login), lalu di-upsert
// sebagai row Notification tersimpan per user (dedup by userId+type+refType+refId) supaya status
// read/unread bertahan antar refresh. Pengiriman WhatsApp/email aktual tidak diimplementasikan
// (butuh integrasi pihak ketiga).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { ROLES } = require('../../common/constants');

async function getPendingApproval() {
  const orders = await prisma.productionOrder.findMany({
    where: { status: 'draft' },
    select: { poId: true, poNumber: true, createdAt: true, customer: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return orders.map((o) => ({
    type: 'approval',
    severity: 'medium',
    message: `PO ${o.poNumber} (${o.customer.name}) menunggu approval`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: o.createdAt,
  }));
}

async function getLowStock() {
  const materials = await prisma.material.findMany();
  return materials
    .filter((m) => Number(m.stockQty) <= Number(m.minStock))
    .map((m) => ({
      type: 'low_stock',
      severity: 'high',
      message: `Stok ${m.name} tersisa ${m.stockQty} ${m.unit} (minimum ${m.minStock})`,
      refType: 'material',
      refId: m.materialId,
      createdAt: null,
    }));
}

async function getOverdueOrders() {
  const now = new Date();
  const orders = await prisma.productionOrder.findMany({
    where: { dueAt: { lt: now }, status: { notIn: ['done'] } },
    select: { poId: true, poNumber: true, dueAt: true, customer: { select: { name: true } } },
    orderBy: { dueAt: 'asc' },
  });
  return orders.map((o) => ({
    type: 'overdue',
    severity: 'high',
    message: `PO ${o.poNumber} (${o.customer.name}) melewati due date (${o.dueAt.toISOString().slice(0, 10)})`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: o.dueAt,
  }));
}

async function getComplaints() {
  const orders = await prisma.productionOrder.findMany({
    where: { status: 'complaint' },
    select: { poId: true, poNumber: true, createdAt: true, customer: { select: { name: true } } },
  });
  return orders.map((o) => ({
    type: 'complaint',
    severity: 'high',
    message: `PO ${o.poNumber} (${o.customer.name}) mendapat komplain`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: o.createdAt,
  }));
}

async function getReadyForInvoice() {
  const orders = await prisma.productionOrder.findMany({
    where: { status: 'approved' },
    select: { poId: true, poNumber: true, createdAt: true, customer: { select: { name: true } } },
  });
  return orders.map((o) => ({
    type: 'ready_for_invoice',
    severity: 'low',
    message: `PO ${o.poNumber} (${o.customer.name}) siap dibuatkan invoice/nota`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: o.createdAt,
  }));
}

async function getQueuedForProduction() {
  const orders = await prisma.productionOrder.findMany({
    where: { status: 'queue' },
    select: { poId: true, poNumber: true, createdAt: true, customer: { select: { name: true } } },
  });
  return orders.map((o) => ({
    type: 'queued',
    severity: 'low',
    message: `PO ${o.poNumber} (${o.customer.name}) menunggu job ticket dibuat`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: o.createdAt,
  }));
}

async function getReworkTasks() {
  const tasks = await prisma.productionTask.findMany({
    where: { status: 'rework' },
    include: { poDetail: { include: { productionOrder: { select: { poId: true, poNumber: true } } } } },
  });
  return tasks.map((t) => ({
    type: 'rework',
    severity: 'medium',
    message: `Task pada PO ${t.poDetail.productionOrder.poNumber} butuh rework`,
    refType: 'production_task',
    refId: t.taskId,
    createdAt: null,
  }));
}

async function getOwnOrderAlerts(userId) {
  const orders = await prisma.productionOrder.findMany({
    where: { designerId: userId, status: { in: ['rework', 'complaint'] } },
    select: { poId: true, poNumber: true, status: true, customer: { select: { name: true } } },
  });
  return orders.map((o) => ({
    type: o.status,
    severity: 'medium',
    message: `PO ${o.poNumber} (${o.customer.name}) berstatus '${o.status}', mungkin butuh perhatian Anda`,
    refType: 'production_order',
    refId: o.poId,
    createdAt: null,
  }));
}

async function getUnpaidSales() {
  const sales = await prisma.salesPos.findMany({
    where: { paidStatus: { in: ['unpaid', 'partial'] } },
    include: { productionOrder: { select: { poNumber: true } } },
  });
  return sales.map((s) => ({
    type: 'unpaid',
    severity: 'medium',
    message: `Invoice PO ${s.productionOrder.poNumber} berstatus '${s.paidStatus}' (total ${s.total})`,
    refType: 'sales_pos',
    refId: s.saleId,
    createdAt: s.createdAt,
  }));
}

async function computeAlertsForRole(currentUser) {
  switch (currentUser.roleName) {
    case ROLES.MANAGER:
      return [
        ...(await getPendingApproval()),
        ...(await getOverdueOrders()),
        ...(await getComplaints()),
        ...(await getLowStock()),
      ];
    case ROLES.INVENTORY:
      return getLowStock();
    case ROLES.PRODUCTION:
      return [...(await getQueuedForProduction()), ...(await getReworkTasks())];
    case ROLES.DESIGNER:
      return getOwnOrderAlerts(currentUser.userId);
    case ROLES.CASHIER:
      return [...(await getReadyForInvoice()), ...(await getUnpaidSales())];
    case ROLES.FINANCE:
      return getUnpaidSales();
    default:
      return [];
  }
}

async function list(query, currentUser) {
  if (!currentUser) {
    throw new ApiError(401, 'Not authenticated');
  }

  const alerts = await computeAlertsForRole(currentUser);

  // Sinkronkan alert yang baru terdeteksi ke tabel Notification (dedup, tidak reset isRead yang sudah ada).
  await Promise.all(
    alerts.map((a) =>
      prisma.notification.upsert({
        where: {
          userId_type_refType_refId: {
            userId: currentUser.userId,
            type: a.type,
            refType: a.refType,
            refId: a.refId,
          },
        },
        create: {
          userId: currentUser.userId,
          type: a.type,
          severity: a.severity,
          message: a.message,
          refType: a.refType,
          refId: a.refId,
        },
        update: { message: a.message, severity: a.severity },
      })
    )
  );

  const unread = await prisma.notification.findMany({
    where: { userId: currentUser.userId, isRead: false },
    orderBy: { createdAt: 'desc' },
  });
  const recentRead = await prisma.notification.findMany({
    where: { userId: currentUser.userId, isRead: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const severityOrder = { high: 0, medium: 1, low: 2 };
  unread.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return [...unread, ...recentRead];
}

async function getById(id, currentUser) {
  const notif = await prisma.notification.findUnique({ where: { notificationId: Number(id) } });
  if (!notif || notif.userId !== currentUser.userId) {
    throw new ApiError(404, 'Notification not found');
  }
  return notif;
}

async function create() {
  throw new ApiError(400, 'Notifications are system-generated, cannot be created manually');
}

async function update(id, data, currentUser) {
  const notif = await prisma.notification.findUnique({ where: { notificationId: Number(id) } });
  if (!notif || notif.userId !== currentUser.userId) {
    throw new ApiError(404, 'Notification not found');
  }
  return prisma.notification.update({
    where: { notificationId: Number(id) },
    data: { isRead: data.isRead !== undefined ? Boolean(data.isRead) : true },
  });
}

async function markAllRead(currentUser) {
  await prisma.notification.updateMany({
    where: { userId: currentUser.userId, isRead: false },
    data: { isRead: true },
  });
  return { success: true };
}

module.exports = { list, getById, create, update, markAllRead };
