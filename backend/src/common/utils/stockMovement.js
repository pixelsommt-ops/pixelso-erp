// Satu tempat untuk validasi + StockMovement insert + Material.stockQty update, dipakai
// inventory.service.js (manual), purchasing.service.js (penerimaan PO pembelian - otomatis),
// dan production.service.js (konsumsi otomatis saat task selesai) - supaya ketiganya konsisten
// dan tidak drift. HARUS dipanggil di dalam prisma.$transaction milik caller.

const ApiError = require('../errors/ApiError');

const MOVEMENT_TYPES = ['in', 'out', 'reserve', 'adjustment'];

// unitCost opsional - kalau diisi dan type='in', avgCost material di-recompute pakai rata-rata
// tertimbang (weighted average) terhadap stok yang sudah ada.
async function applyStockMovement(tx, { materialId, type, qty, poId, poDetailId, createdBy, unitCost }) {
  if (!MOVEMENT_TYPES.includes(type)) {
    throw new ApiError(400, `movement type must be one of ${MOVEMENT_TYPES.join(', ')}`);
  }
  if (qty === undefined || qty === null || Number(qty) === 0) {
    throw new ApiError(400, 'movement qty must be non-zero');
  }
  if (type !== 'adjustment' && Number(qty) < 0) {
    throw new ApiError(400, `movement qty must be > 0 for type '${type}'`);
  }

  const material = await tx.material.findUnique({ where: { materialId: Number(materialId) } });
  if (!material) {
    throw new ApiError(400, 'Invalid materialId');
  }

  const currentQty = Number(material.stockQty);
  let newQty;
  if (type === 'in') {
    newQty = currentQty + Number(qty);
  } else if (type === 'adjustment') {
    newQty = currentQty + Number(qty);
    if (newQty < 0) {
      throw new ApiError(400, `Adjustment would result in negative stock (${newQty})`);
    }
  } else {
    // out | reserve both consume available stock
    if (Number(qty) > currentQty) {
      throw new ApiError(400, `Stok "${material.name}" tidak cukup: tersedia ${currentQty}, diminta ${qty}`);
    }
    newQty = currentQty - Number(qty);
  }

  await tx.stockMovement.create({
    data: {
      materialId: Number(materialId),
      poId: poId ? Number(poId) : undefined,
      poDetailId: poDetailId ? Number(poDetailId) : undefined,
      type,
      qty: Number(qty),
      createdBy: createdBy || undefined,
    },
  });

  const materialUpdateData = { stockQty: newQty };
  if (type === 'in' && unitCost !== undefined && unitCost !== null) {
    const totalOldValue = currentQty * Number(material.avgCost);
    const totalNewValue = Number(qty) * Number(unitCost);
    materialUpdateData.avgCost = newQty > 0 ? (totalOldValue + totalNewValue) / newQty : Number(material.avgCost);
  }

  return tx.material.update({ where: { materialId: Number(materialId) }, data: materialUpdateData });
}

module.exports = { applyStockMovement, MOVEMENT_TYPES };
