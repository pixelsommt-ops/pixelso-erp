// M06: Produksi
// Fitur kunci (PRD 3.2): Job ticket, antrian, mesin, operator, status, timer, kapasitas, rework

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS } = require('../../common/constants');
const { applyStockMovement } = require('../../common/utils/stockMovement');

const TASK_STATUS = { QUEUE: 'queue', IN_PROGRESS: 'in_progress', DONE: 'done', REWORK: 'rework' };

const TASK_TRANSITIONS = {
  [TASK_STATUS.QUEUE]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.DONE, TASK_STATUS.REWORK],
  [TASK_STATUS.REWORK]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.DONE]: [TASK_STATUS.REWORK],
};

const TASK_INCLUDE = {
  poDetail: {
    include: {
      product: { select: { productId: true, name: true } },
      productionOrder: {
        select: { poId: true, poNumber: true, status: true, customer: { select: { customerId: true, name: true } } },
      },
    },
  },
  machine: true,
  operator: { select: { userId: true, name: true } },
};

async function list(query) {
  const { status, machineId, operatorId, poId } = query;

  const where = {
    ...(status ? { status } : {}),
    ...(machineId ? { machineId: Number(machineId) } : {}),
    ...(operatorId ? { operatorId: Number(operatorId) } : {}),
    ...(poId ? { poDetail: { poId: Number(poId) } } : {}),
  };

  return prisma.productionTask.findMany({ where, include: TASK_INCLUDE, orderBy: { taskId: 'asc' } });
}

async function getById(id) {
  const task = await prisma.productionTask.findUnique({ where: { taskId: Number(id) }, include: TASK_INCLUDE });
  if (!task) {
    throw new ApiError(404, 'Production task not found');
  }
  return task;
}

async function create(data) {
  const { poDetailId, machineId, operatorId, stage } = data;

  if (!poDetailId) {
    throw new ApiError(400, 'poDetailId is required');
  }

  const poDetail = await prisma.poDetail.findUnique({
    where: { poDetailId: Number(poDetailId) },
    include: { productionOrder: true },
  });
  if (!poDetail) {
    throw new ApiError(400, 'Invalid poDetailId');
  }
  if (poDetail.productionOrder.status !== PO_STATUS.QUEUE) {
    throw new ApiError(
      400,
      `Production order must be in '${PO_STATUS.QUEUE}' status to create a job ticket (currently '${poDetail.productionOrder.status}')`
    );
  }

  if (machineId) {
    const machine = await prisma.machine.findUnique({ where: { machineId: Number(machineId) } });
    if (!machine) {
      throw new ApiError(400, 'Invalid machineId');
    }
  }
  if (operatorId) {
    const operator = await prisma.user.findUnique({ where: { userId: Number(operatorId) } });
    if (!operator) {
      throw new ApiError(400, 'Invalid operatorId');
    }
  }

  return prisma.productionTask.create({
    data: {
      poDetailId: Number(poDetailId),
      machineId: machineId ? Number(machineId) : undefined,
      operatorId: operatorId ? Number(operatorId) : undefined,
      stage: stage || undefined,
      status: TASK_STATUS.QUEUE,
    },
    include: TASK_INCLUDE,
  });
}

async function update(id, data, currentUser) {
  const { status, machineId, operatorId, stage } = data;

  const task = await prisma.productionTask.findUnique({
    where: { taskId: Number(id) },
    include: { poDetail: { include: { productionOrder: true } } },
  });
  if (!task) {
    throw new ApiError(404, 'Production task not found');
  }

  if (!status) {
    // Reassignment mesin/operator hanya diperbolehkan sebelum job berjalan.
    if (task.status !== TASK_STATUS.QUEUE) {
      throw new ApiError(400, 'Machine/operator can only be reassigned while task is queued');
    }
    if (machineId) {
      const machine = await prisma.machine.findUnique({ where: { machineId: Number(machineId) } });
      if (!machine) throw new ApiError(400, 'Invalid machineId');
    }
    if (operatorId) {
      const operator = await prisma.user.findUnique({ where: { userId: Number(operatorId) } });
      if (!operator) throw new ApiError(400, 'Invalid operatorId');
    }
    return prisma.productionTask.update({
      where: { taskId: Number(id) },
      data: {
        ...(machineId !== undefined ? { machineId: machineId ? Number(machineId) : null } : {}),
        ...(operatorId !== undefined ? { operatorId: operatorId ? Number(operatorId) : null } : {}),
        ...(stage !== undefined ? { stage: stage || null } : {}),
      },
      include: TASK_INCLUDE,
    });
  }

  const allowedNext = TASK_TRANSITIONS[task.status] || [];
  if (!allowedNext.includes(status)) {
    throw new ApiError(400, `Cannot transition task status from '${task.status}' to '${status}'`);
  }

  return prisma.$transaction(async (tx) => {
    const taskData = {};
    let machineStatus = null;

    if (status === TASK_STATUS.IN_PROGRESS) {
      if (task.machineId) {
        const busy = await tx.productionTask.findFirst({
          where: { machineId: task.machineId, status: TASK_STATUS.IN_PROGRESS, taskId: { not: task.taskId } },
        });
        if (busy) {
          throw new ApiError(400, 'Machine is currently busy with another task');
        }
        machineStatus = 'busy';
      }
      taskData.startAt = task.startAt || new Date();
      taskData.finishAt = null;
    }

    if (status === TASK_STATUS.DONE) {
      taskData.finishAt = new Date();
      if (task.machineId) machineStatus = 'idle';

      // Konsumsi Material otomatis kalau item ini ditautkan (PoDetail.materialId/materialQty -
      // opsional, lihat production-orders.service.js#setDetailMaterial). Dicek dulu supaya task
      // yang berpindah done->rework->done lagi tidak mengonsumsi material dua kali (lihat komentar
      // StockMovement.poDetailId di schema.prisma).
      if (task.poDetail.materialId && task.poDetail.materialQty) {
        const alreadyConsumed = await tx.stockMovement.findFirst({
          where: { poDetailId: task.poDetail.poDetailId, type: 'out' },
        });
        if (!alreadyConsumed) {
          await applyStockMovement(tx, {
            materialId: task.poDetail.materialId,
            type: 'out',
            qty: task.poDetail.materialQty,
            poId: task.poDetail.productionOrder.poId,
            poDetailId: task.poDetail.poDetailId,
            createdBy: currentUser?.userId,
          });
        }
      }
    }

    if (status === TASK_STATUS.REWORK) {
      taskData.finishAt = null;
      if (task.machineId) machineStatus = 'idle';
    }

    taskData.status = status;

    const updatedTask = await tx.productionTask.update({
      where: { taskId: Number(id) },
      data: taskData,
      include: TASK_INCLUDE,
    });

    if (task.machineId && machineStatus) {
      await tx.machine.update({ where: { machineId: task.machineId }, data: { status: machineStatus } });
    }

    const poId = task.poDetail.productionOrder.poId;
    const poStatus = task.poDetail.productionOrder.status;

    if (status === TASK_STATUS.IN_PROGRESS && poStatus === PO_STATUS.QUEUE) {
      await tx.productionOrder.update({ where: { poId }, data: { status: PO_STATUS.PRODUCTION } });
    }

    if (status === TASK_STATUS.DONE && poStatus === PO_STATUS.PRODUCTION) {
      const remainingTasks = await tx.productionTask.count({
        where: { poDetail: { poId }, status: { not: TASK_STATUS.DONE } },
      });
      if (remainingTasks === 0) {
        await tx.productionOrder.update({ where: { poId }, data: { status: PO_STATUS.QC } });
      }
    }

    return updatedTask;
  });
}

// --- Master Mesin (machine) ---

async function listMachines(query) {
  const { status } = query;
  return prisma.machine.findMany({ where: status ? { status } : {}, orderBy: { machineId: 'asc' } });
}

async function createMachine(data) {
  const { name, type, capacity } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  return prisma.machine.create({ data: { name, type, capacity, status: 'idle' } });
}

module.exports = { list, getById, create, update, listMachines, createMachine };
