// Harga & produk kalkulator website - satu-satunya sumber untuk landing page (lihat public.routes).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { PO_STATUS } = require('../../common/constants');
const { sanitizeDescriptionHtml } = require('../../common/utils/htmlSanitize');

const SETTINGS_ID = 1;
const VALID_MODES = ['area', 'unit'];
const KEY_PATTERN = /^[a-z0-9_-]+$/;
const MAX_PRODUCT_IMAGES = 4;
const VALID_PRICE_MODES = ['replace_base', 'multiplier', 'add'];

const OPTION_GROUPS_INCLUDE = { optionGroups: { include: { choices: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } };

// Tier harga bertingkat opsional per pilihan (mis. Stiker HVS 1-100=9000, 101-200=8850) -
// null/array kosong berarti pilihan pakai priceValue flat seperti biasa (lihat calculatePrintPrice).
function normalizeQtyTiers(qtyTiers) {
  if (qtyTiers === undefined || qtyTiers === null) return null;
  if (!Array.isArray(qtyTiers) || qtyTiers.length === 0) return null;

  return qtyTiers.map((tier) => {
    const minQty = Number(tier?.minQty);
    const price = Number(tier?.price);
    const maxQty = tier?.maxQty === null || tier?.maxQty === undefined || tier?.maxQty === '' ? null : Number(tier.maxQty);
    if (!Number.isInteger(minQty) || minQty < 1) {
      throw new ApiError(400, 'Tier qty: minQty wajib bilangan bulat >= 1');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, 'Tier qty: price wajib angka >= 0');
    }
    if (maxQty !== null && (!Number.isInteger(maxQty) || maxQty < minQty)) {
      throw new ApiError(400, 'Tier qty: maxQty wajib kosong (ke atas) atau bilangan bulat >= minQty');
    }
    return { minQty, maxQty, price };
  });
}

// optionGroups dikirim client sebagai pohon lengkap tiap kali produk disimpan (pola sama
// dengan images/specs) - divalidasi lalu dipakai untuk replace-seluruh-pohon di create/update.
function normalizeOptionGroups(optionGroups) {
  if (optionGroups === undefined) return undefined;
  if (!Array.isArray(optionGroups)) return [];

  return optionGroups.map((group, groupIndex) => {
    if (!group.label) {
      throw new ApiError(400, 'Setiap grup opsi wajib punya label');
    }
    const choices = Array.isArray(group.choices) ? group.choices : [];
    return {
      label: group.label,
      required: group.required !== undefined ? Boolean(group.required) : true,
      sortOrder: groupIndex,
      choices: {
        create: choices.map((choice, choiceIndex) => {
          if (!choice.label) {
            throw new ApiError(400, 'Setiap pilihan opsi wajib punya label');
          }
          if (!VALID_PRICE_MODES.includes(choice.priceMode)) {
            throw new ApiError(400, "priceMode pilihan harus 'replace_base', 'multiplier', atau 'add'");
          }
          return {
            label: choice.label,
            priceMode: choice.priceMode,
            priceValue: Number(choice.priceValue || 0),
            perUnit: Boolean(choice.perUnit),
            isDefault: Boolean(choice.isDefault),
            sortOrder: choiceIndex,
            qtyTiers: normalizeQtyTiers(choice.qtyTiers),
          };
        }),
      },
    };
  });
}

// images[0] adalah thumbnail utama - imageUrl selalu di-derive dari sini, bukan input terpisah,
// supaya konsumen lama (ProductCard, Home storefront) yang cuma baca imageUrl tetap jalan tanpa ubah.
function normalizeImages(images) {
  if (images === undefined) return undefined;
  const list = Array.isArray(images) ? images.filter((url) => typeof url === 'string' && url.trim()) : [];
  if (list.length > MAX_PRODUCT_IMAGES) {
    throw new ApiError(400, `Maksimal ${MAX_PRODUCT_IMAGES} foto per produk`);
  }
  return list;
}

function normalizeVideoUrl(videoUrl) {
  if (!videoUrl) return null;
  if (!/^https?:\/\//i.test(videoUrl)) {
    throw new ApiError(400, 'Link video harus diawali http:// atau https://');
  }
  return videoUrl;
}

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
  return prisma.printProduct.findMany({ orderBy: { sortOrder: 'asc' }, include: { category: true, ...OPTION_GROUPS_INCLUDE } });
}

async function getProductByKey(key) {
  const product = await prisma.printProduct.findUnique({ where: { key }, include: OPTION_GROUPS_INCLUDE });
  if (!product) {
    throw new ApiError(404, 'Print product not found');
  }
  return product;
}

async function createProduct(data, userId) {
  const { key, name, pricingMode, categoryId, baseRate, minimumArea, setupFee, isActive, sortOrder, images, videoUrl, description, specs, optionGroups } = data;

  if (!key || !KEY_PATTERN.test(key)) {
    throw new ApiError(400, 'key is required and must be a lowercase slug (a-z0-9_-)');
  }
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (!VALID_MODES.includes(pricingMode)) {
    throw new ApiError(400, "pricingMode must be 'area' or 'unit'");
  }

  const normalizedImages = normalizeImages(images) || [];
  const normalizedOptionGroups = normalizeOptionGroups(optionGroups) || [];

  const created = await prisma.printProduct.create({
    data: {
      key,
      name,
      pricingMode,
      categoryId: categoryId ? Number(categoryId) : null,
      baseRate: Number(baseRate || 0),
      minimumArea: Number(minimumArea || 0),
      setupFee: Number(setupFee || 0),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder || 0),
      images: normalizedImages,
      imageUrl: normalizedImages[0] || null,
      videoUrl: normalizeVideoUrl(videoUrl),
      description: sanitizeDescriptionHtml(description),
      specs: Array.isArray(specs) ? specs : [],
      updatedBy: userId,
      optionGroups: { create: normalizedOptionGroups },
    },
    include: OPTION_GROUPS_INCLUDE,
  });
  return created;
}

async function updateProduct(key, data, userId) {
  await getProductByKey(key);

  if (data.key !== undefined && data.key !== key) {
    throw new ApiError(400, 'key cannot be changed once created (the landing page references products by key)');
  }
  if (data.pricingMode !== undefined && !VALID_MODES.includes(data.pricingMode)) {
    throw new ApiError(400, "pricingMode must be 'area' or 'unit'");
  }

  const { name, pricingMode, categoryId, baseRate, minimumArea, setupFee, isActive, sortOrder, images, videoUrl, description, specs, optionGroups } = data;
  const normalizedImages = normalizeImages(images);
  const normalizedOptionGroups = normalizeOptionGroups(optionGroups);

  return prisma.$transaction(async (tx) => {
    if (normalizedOptionGroups !== undefined) {
      // Replace-seluruh-pohon: hapus semua grup lama (cascade hapus choices-nya), buat ulang
      // dari payload - pola sama seperti images/specs, lebih sederhana daripada CRUD granular.
      const product = await tx.printProduct.findUnique({ where: { key }, select: { printProductId: true } });
      await tx.productOptionGroup.deleteMany({ where: { printProductId: product.printProductId } });
    }

    return tx.printProduct.update({
      where: { key },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(pricingMode !== undefined ? { pricingMode } : {}),
        ...(categoryId !== undefined ? { categoryId: categoryId ? Number(categoryId) : null } : {}),
        ...(baseRate !== undefined ? { baseRate: Number(baseRate) } : {}),
        ...(minimumArea !== undefined ? { minimumArea: Number(minimumArea) } : {}),
        ...(setupFee !== undefined ? { setupFee: Number(setupFee) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(normalizedImages !== undefined ? { images: normalizedImages, imageUrl: normalizedImages[0] || null } : {}),
        ...(videoUrl !== undefined ? { videoUrl: normalizeVideoUrl(videoUrl) } : {}),
        ...(description !== undefined ? { description: sanitizeDescriptionHtml(description) } : {}),
        ...(specs !== undefined ? { specs: Array.isArray(specs) ? specs : [] } : {}),
        ...(normalizedOptionGroups !== undefined ? { optionGroups: { create: normalizedOptionGroups } } : {}),
        updatedBy: userId,
      },
      include: OPTION_GROUPS_INCLUDE,
    });
  });
}

async function deleteProduct(key) {
  await getProductByKey(key);
  return prisma.printProduct.delete({ where: { key } });
}

// Terjual dihitung dari PoDetail.qty pada order yang sudah 'done' - angka jujur dari data order
// asli, bukan diisi manual. Dikelompokkan per Product.productId lalu dipetakan ke PrintProduct
// lewat Product.printProductId (PoDetail masih FK ke Product operasional, bukan PrintProduct).
async function getSoldCountByPrintProductId() {
  const [soldByProductId, linkedProducts] = await Promise.all([
    prisma.poDetail.groupBy({
      by: ['productId'],
      where: { productionOrder: { status: PO_STATUS.DONE } },
      _sum: { qty: true },
    }),
    prisma.product.findMany({
      where: { printProductId: { not: null } },
      select: { productId: true, printProductId: true },
    }),
  ]);
  const soldByProduct = new Map(soldByProductId.map((s) => [s.productId, s._sum.qty || 0]));
  return new Map(linkedProducts.map((p) => [p.printProductId, soldByProduct.get(p.productId) || 0]));
}

// Reshapes DB rows into the exact JSON contract the landing page & storefront expect as `config.pricing`.
async function getPublicPricing() {
  const [settings, products, soldByPrintProductId] = await Promise.all([
    getSettings(),
    listProducts(),
    getSoldCountByPrintProductId(),
  ]);

  return {
    designFee: Number(settings.designFee || 0),
    materialFactors: settings.materialFactors || {},
    finishingRates: settings.finishingRates || {},
    products: products.map((p) => ({
      key: p.key,
      name: p.name,
      mode: p.pricingMode,
      category: p.category?.name || null,
      baseRate: Number(p.baseRate),
      minArea: Number(p.minimumArea),
      setup: Number(p.setupFee),
      active: p.isActive,
      imageUrl: p.imageUrl || null,
      images: Array.isArray(p.images) ? p.images : [],
      videoUrl: p.videoUrl || null,
      description: p.description || null,
      specs: Array.isArray(p.specs) ? p.specs : [],
      soldCount: soldByPrintProductId.get(p.printProductId) || 0,
      optionGroups: (p.optionGroups || []).map((g) => ({
        id: g.groupId,
        label: g.label,
        required: g.required,
        choices: (g.choices || []).map((c) => ({
          id: c.choiceId,
          label: c.label,
          priceMode: c.priceMode,
          priceValue: Number(c.priceValue),
          perUnit: c.perUnit,
          isDefault: c.isDefault,
          qtyTiers: Array.isArray(c.qtyTiers) ? c.qtyTiers : null,
        })),
      })),
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
