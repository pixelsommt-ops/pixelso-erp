// M07: QC & Delivery
// Fitur kunci (PRD 3.2): Checklist QC, foto bukti, alasan reject, pickup/delivery, tanda terima

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS } = require('../../common/constants');

const QC_INCLUDE = {
  task: {
    include: {
      poDetail: {
        include: { productionOrder: { select: { poId: true, poNumber: true, status: true } } },
      },
    },
  },
  qcBy_user: { select: { userId: true, name: true } },
};

// --- QC Checklist ---

async function list(query) {
  const { taskId, result, poId } = query;

  const where = {
    ...(taskId ? { taskId: Number(taskId) } : {}),
    ...(result ? { result } : {}),
    ...(poId ? { task: { poDetail: { poId: Number(poId) } } } : {}),
  };

  return prisma.qcCheck.findMany({ where, include: QC_INCLUDE, orderBy: { createdAt: 'desc' } });
}

async function getById(id) {
  const qc = await prisma.qcCheck.findUnique({ where: { qcId: Number(id) }, include: QC_INCLUDE });
  if (!qc) {
    throw new ApiError(404, 'QC check not found');
  }
  return qc;
}

async function create(data, currentUser) {
  const { taskId, result, issueType, photoUrl } = data;

  if (!taskId || !result) {
    throw new ApiError(400, 'taskId and result are required');
  }
  if (!['pass', 'fail'].includes(result)) {
    throw new ApiError(400, "result must be 'pass' or 'fail'");
  }
  if (result === 'fail' && !issueType) {
    throw new ApiError(400, 'issueType is required when result is fail (alasan reject)');
  }
  if (!currentUser) {
    throw new ApiError(401, 'Not authenticated');
  }

  const task = await prisma.productionTask.findUnique({
    where: { taskId: Number(taskId) },
    include: { poDetail: { include: { productionOrder: true } } },
  });
  if (!task) {
    throw new ApiError(400, 'Invalid taskId');
  }
  if (task.status !== 'done') {
    throw new ApiError(400, `Task must be 'done' before QC can be checked (currently '${task.status}')`);
  }

  const poId = task.poDetail.productionOrder.poId;
  const poStatus = task.poDetail.productionOrder.status;

  return prisma.$transaction(async (tx) => {
    const qcCheck = await tx.qcCheck.create({
      data: {
        taskId: Number(taskId),
        qcBy: currentUser.userId,
        result,
        issueType: issueType || null,
        photoUrl: photoUrl || null,
      },
      include: QC_INCLUDE,
    });

    if (result === 'fail') {
      await tx.productionTask.update({ where: { taskId: Number(taskId) }, data: { status: 'rework' } });
      if (poStatus === PO_STATUS.QC) {
        await tx.productionOrder.update({ where: { poId }, data: { status: PO_STATUS.PRODUCTION } });
      }
      return qcCheck;
    }

    // result === 'pass': cek apakah semua task PO ini sudah lolos QC (qc check terakhir tiap task = pass)
    if (poStatus === PO_STATUS.QC) {
      const tasks = await tx.productionTask.findMany({
        where: { poDetail: { poId } },
        include: { qcChecks: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const allPassed = tasks.every((t) => t.qcChecks[0]?.result === 'pass');
      if (allPassed) {
        await tx.productionOrder.update({ where: { poId }, data: { status: PO_STATUS.READY } });
      }
    }

    return qcCheck;
  });
}

async function update(id, data) {
  // QC check bersifat immutable (audit trail); koreksi dilakukan dengan membuat check baru.
  throw new ApiError(400, 'QC check cannot be updated, create a new check instead');
}

// --- Delivery ---

const DELIVERY_INCLUDE = {
  productionOrder: {
    select: { poId: true, poNumber: true, status: true, customer: { select: { name: true, phone: true } } },
  },
};

async function listDeliveries(query) {
  const { poId, status, method } = query;

  const where = {
    ...(poId ? { poId: Number(poId) } : {}),
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
  };

  return prisma.delivery.findMany({ where, include: DELIVERY_INCLUDE, orderBy: { createdAt: 'desc' } });
}

async function createDelivery(data) {
  const { poId, method, receiver } = data;

  if (!poId || !method) {
    throw new ApiError(400, 'poId and method are required');
  }
  if (!['pickup', 'delivery'].includes(method)) {
    throw new ApiError(400, "method must be 'pickup' or 'delivery'");
  }

  const order = await prisma.productionOrder.findUnique({ where: { poId: Number(poId) } });
  if (!order) {
    throw new ApiError(400, 'Invalid poId');
  }
  if (order.status !== PO_STATUS.READY) {
    throw new ApiError(400, `Production order must be '${PO_STATUS.READY}' before scheduling delivery (currently '${order.status}')`);
  }

  return prisma.delivery.create({
    data: { poId: Number(poId), method, receiver, status: 'pending' },
    include: DELIVERY_INCLUDE,
  });
}

async function updateDelivery(id, data) {
  const { status, receiver } = data;

  const delivery = await prisma.delivery.findUnique({ where: { deliveryId: Number(id) } });
  if (!delivery) {
    throw new ApiError(404, 'Delivery not found');
  }
  if (delivery.status !== 'pending') {
    throw new ApiError(400, `Delivery already '${delivery.status}'`);
  }

  if (status === 'completed') {
    const finalReceiver = receiver || delivery.receiver;
    if (!finalReceiver) {
      throw new ApiError(400, 'receiver is required to complete delivery (tanda terima)');
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { deliveryId: Number(id) },
        data: { status: 'completed', receiver: finalReceiver },
        include: DELIVERY_INCLUDE,
      });
      await tx.productionOrder.update({ where: { poId: delivery.poId }, data: { status: PO_STATUS.DONE } });
      return updated;
    });
  }

  if (status === 'cancelled') {
    return prisma.delivery.update({
      where: { deliveryId: Number(id) },
      data: { status: 'cancelled' },
      include: DELIVERY_INCLUDE,
    });
  }

  return prisma.delivery.update({
    where: { deliveryId: Number(id) },
    data: { ...(receiver !== undefined ? { receiver } : {}) },
    include: DELIVERY_INCLUDE,
  });
}

module.exports = { list, getById, create, update, listDeliveries, createDelivery, updateDelivery };
