// M05: Inventory
// Fitur kunci (PRD 3.2): Bahan baku, stok minimum, reservasi bahan, mutasi, stock opname, supplier

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { applyStockMovement, MOVEMENT_TYPES } = require('../../common/utils/stockMovement');

async function list(query) {
  const { search, lowStock } = query;

  const materials = await prisma.material.findMany({
    where: search ? { name: { contains: search } } : {},
    orderBy: { materialId: 'asc' },
  });

  if (lowStock === 'true') {
    return materials.filter((m) => Number(m.stockQty) <= Number(m.minStock));
  }
  return materials;
}

async function getById(id) {
  const material = await prisma.material.findUnique({
    where: { materialId: Number(id) },
    include: {
      stockMovements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { productionOrder: { select: { poId: true, poNumber: true } } },
      },
    },
  });
  if (!material) {
    throw new ApiError(404, 'Material not found');
  }
  return material;
}

async function create(data) {
  const { name, unit, stockQty, minStock, avgCost } = data;

  if (!name || !unit) {
    throw new ApiError(400, 'name and unit are required');
  }

  const initialQty = stockQty ? Number(stockQty) : 0;

  return prisma.$transaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        name,
        unit,
        stockQty: 0,
        minStock: minStock ? Number(minStock) : 0,
        avgCost: avgCost ? Number(avgCost) : 0,
      },
    });

    if (initialQty > 0) {
      return applyStockMovement(tx, { materialId: material.materialId, type: 'in', qty: initialQty });
    }

    return material;
  });
}

async function update(id, data, currentUser) {
  const { name, unit, minStock, avgCost, movement } = data;

  const material = await prisma.material.findUnique({ where: { materialId: Number(id) } });
  if (!material) {
    throw new ApiError(404, 'Material not found');
  }

  if (movement) {
    const { type, qty, poId } = movement;
    if (poId) {
      const order = await prisma.productionOrder.findUnique({ where: { poId: Number(poId) } });
      if (!order) {
        throw new ApiError(400, 'Invalid poId');
      }
    }

    return prisma.$transaction((tx) =>
      applyStockMovement(tx, { materialId: id, type, qty, poId, createdBy: currentUser?.userId })
    );
  }

  return prisma.material.update({
    where: { materialId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(unit ? { unit } : {}),
      ...(minStock !== undefined ? { minStock: Number(minStock) } : {}),
      ...(avgCost !== undefined ? { avgCost: Number(avgCost) } : {}),
    },
  });
}

module.exports = { list, getById, create, update };
