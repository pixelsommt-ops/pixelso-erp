// Master Mode Harga - daftar mode kalkulasi harga (Per m², Per Pcs, Per Menit, Per Gram, dst) yang
// bisa dipilih staf saat bikin PrintProduct di halaman Harga Website - lihat pricing.service.js
// untuk pemakaiannya (validasi pricingMode + enrichment getPublicPricing).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const KEY_PATTERN = /^[a-z0-9_-]+$/;
const VALID_CALC_TYPES = ['area', 'scalar'];

async function list() {
  return prisma.pricingMode.findMany({ orderBy: { sortOrder: 'asc' } });
}

async function getByKey(key) {
  const mode = await prisma.pricingMode.findUnique({ where: { key } });
  if (!mode) {
    throw new ApiError(404, 'Mode harga tidak ditemukan');
  }
  return mode;
}

function validateCalcType(calcType) {
  if (!VALID_CALC_TYPES.includes(calcType)) {
    throw new ApiError(400, "calcType harus 'area' atau 'scalar'");
  }
}

async function create(data) {
  const { key, label, calcType, unitLabel, inputLabel, sortOrder, isActive } = data;

  if (!key || !KEY_PATTERN.test(key)) {
    throw new ApiError(400, 'key wajib diisi, huruf kecil/angka/-/_ saja');
  }
  if (!label) {
    throw new ApiError(400, 'label wajib diisi');
  }
  validateCalcType(calcType);
  if (!unitLabel) {
    throw new ApiError(400, 'unitLabel wajib diisi');
  }
  if (!inputLabel) {
    throw new ApiError(400, 'inputLabel wajib diisi');
  }

  try {
    return await prisma.pricingMode.create({
      data: {
        key,
        label,
        calcType,
        unitLabel,
        inputLabel,
        sortOrder: Number(sortOrder || 0),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(400, 'Key mode harga sudah dipakai');
    }
    throw err;
  }
}

async function update(key, data) {
  await getByKey(key);

  if (data.key !== undefined && data.key !== key) {
    throw new ApiError(400, 'key tidak bisa diubah setelah dibuat (dipakai sebagai referensi string di produk)');
  }
  if (data.calcType !== undefined) {
    validateCalcType(data.calcType);
  }

  const { label, calcType, unitLabel, inputLabel, sortOrder, isActive } = data;

  return prisma.pricingMode.update({
    where: { key },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(calcType !== undefined ? { calcType } : {}),
      ...(unitLabel !== undefined ? { unitLabel } : {}),
      ...(inputLabel !== undefined ? { inputLabel } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });
}

async function deleteMode(key) {
  await getByKey(key);

  const printProductCount = await prisma.printProduct.count({ where: { pricingMode: key } });
  if (printProductCount > 0) {
    throw new ApiError(400, `Mode harga masih dipakai ${printProductCount} produk, tidak bisa dihapus`);
  }

  return prisma.pricingMode.delete({ where: { key } });
}

module.exports = { list, getByKey, create, update, deleteMode };
