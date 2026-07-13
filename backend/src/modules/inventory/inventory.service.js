// M05: Inventory
// Fitur kunci (PRD 3.2): Bahan baku, stok minimum, reservasi bahan, mutasi, stock opname, supplier

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const MOVEMENT_TYPES = ['in', 'out', 'reserve', 'adjustment'];

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
        stockQty: initialQty,
        minStock: minStock ? Number(minStock) : 0,
        avgCost: avgCost ? Number(avgCost) : 0,
      },
    });

    if (initialQty > 0) {
      await tx.stockMovement.create({
        data: { materialId: material.materialId, type: 'in', qty: initialQty },
      });
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
    if (!MOVEMENT_TYPES.includes(type)) {
      throw new ApiError(400, `movement.type must be one of ${MOVEMENT_TYPES.join(', ')}`);
    }
    if (qty === undefined || qty === null || Number(qty) === 0) {
      throw new ApiError(400, 'movement.qty must be non-zero');
    }
    if (type !== 'adjustment' && Number(qty) < 0) {
      throw new ApiError(400, `movement.qty must be > 0 for type '${type}'`);
    }
    if (poId) {
      const order = await prisma.productionOrder.findUnique({ where: { poId: Number(poId) } });
      if (!order) {
        throw new ApiError(400, 'Invalid poId');
      }
    }

    const currentQty = Number(material.stockQty);
    let newQty;
    if (type === 'in') {
      newQty = currentQty + Number(qty);
    } else if (type === 'adjustment') {
      // Koreksi stock opname: qty boleh negatif (kurang) atau positif (lebih).
      newQty = currentQty + Number(qty);
      if (newQty < 0) {
        throw new ApiError(400, `Adjustment would result in negative stock (${newQty})`);
      }
    } else {
      // out | reserve both consume available stock
      if (Number(qty) > currentQty) {
        throw new ApiError(400, `Insufficient stock: available ${currentQty}, requested ${qty}`);
      }
      newQty = currentQty - Number(qty);
    }

    return prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          materialId: Number(id),
          poId: poId ? Number(poId) : undefined,
          type,
          qty: Number(qty),
          createdBy: currentUser?.userId,
        },
      });
      return tx.material.update({ where: { materialId: Number(id) }, data: { stockQty: newQty } });
    });
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
