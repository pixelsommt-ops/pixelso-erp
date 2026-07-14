// Harga & produk kalkulator website - satu-satunya sumber untuk landing page (lihat public.routes).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const SETTINGS_ID = 1;
const VALID_MODES = ['area', 'unit'];
const KEY_PATTERN = /^[a-z0-9_-]+$/;

async function getSettings() {
  const row = await prisma.pricingSetting.findUnique({ where: { id: SETTINGS_ID } });
  return row || { id: SETTINGS_ID, designFee: 0, materialFactors: {}, finishingRates: {} };
}

async function updateSettings(data, userId) {
  const { designFee, materialFactors, finishingRates } = data;

  return prisma.pricingSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {
      ...(designFee !== undefined ? { designFee: Number(designFee) } : {}),
      ...(materialFactors !== undefined ? { materialFactors } : {}),
      ...(finishingRates !== undefined ? { finishingRates } : {}),
      updatedBy: userId,
    },
    create: {
      id: SETTINGS_ID,
      designFee: Number(designFee || 0),
      materialFactors: materialFactors || {},
      finishingRates: finishingRates || {},
      updatedBy: userId,
    },
  });
}

async function listProducts() {
  return prisma.printProduct.findMany({ orderBy: { sortOrder: 'asc' } });
}

async function getProductByKey(key) {
  const product = await prisma.printProduct.findUnique({ where: { key } });
  if (!product) {
    throw new ApiError(404, 'Print product not found');
  }
  return product;
}

async function createProduct(data, userId) {
  const { key, name, pricingMode, baseRate, minimumArea, setupFee, isActive, sortOrder } = data;

  if (!key || !KEY_PATTERN.test(key)) {
    throw new ApiError(400, 'key is required and must be a lowercase slug (a-z0-9_-)');
  }
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (!VALID_MODES.includes(pricingMode)) {
    throw new ApiError(400, "pricingMode must be 'area' or 'unit'");
  }

  return prisma.printProduct.create({
    data: {
      key,
      name,
      pricingMode,
      baseRate: Number(baseRate || 0),
      minimumArea: Number(minimumArea || 0),
      setupFee: Number(setupFee || 0),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder || 0),
      updatedBy: userId,
    },
  });
}

async function updateProduct(key, data, userId) {
  await getProductByKey(key);

  if (data.key !== undefined && data.key !== key) {
    throw new ApiError(400, 'key cannot be changed once created (the landing page references products by key)');
  }
  if (data.pricingMode !== undefined && !VALID_MODES.includes(data.pricingMode)) {
    throw new ApiError(400, "pricingMode must be 'area' or 'unit'");
  }

  const { name, pricingMode, baseRate, minimumArea, setupFee, isActive, sortOrder } = data;

  return prisma.printProduct.update({
    where: { key },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(pricingMode !== undefined ? { pricingMode } : {}),
      ...(baseRate !== undefined ? { baseRate: Number(baseRate) } : {}),
      ...(minimumArea !== undefined ? { minimumArea: Number(minimumArea) } : {}),
      ...(setupFee !== undefined ? { setupFee: Number(setupFee) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      updatedBy: userId,
    },
  });
}

async function deleteProduct(key) {
  await getProductByKey(key);
  return prisma.printProduct.delete({ where: { key } });
}

// Reshapes DB rows into the exact JSON contract the landing page expects as `config.pricing`.
async function getPublicPricing() {
  const [settings, products] = await Promise.all([getSettings(), listProducts()]);

  return {
    designFee: Number(settings.designFee || 0),
    materialFactors: settings.materialFactors || {},
    finishingRates: settings.finishingRates || {},
    products: products.map((p) => ({
      key: p.key,
      name: p.name,
      mode: p.pricingMode,
      baseRate: Number(p.baseRate),
      minArea: Number(p.minimumArea),
      setup: Number(p.setupFee),
      active: p.isActive,
    })),
  };
}

module.exports = {
  getSettings,
  updateSettings,
  listProducts,
  getProductByKey,
  createProduct,
  updateProduct,
  deleteProduct,
  getPublicPricing,
};
