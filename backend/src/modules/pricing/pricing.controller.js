const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./pricing.service');
const { saveUpload } = require('../../common/utils/fileUpload');

const getAll = asyncHandler(async (req, res) => {
  const [settings, products] = await Promise.all([service.getSettings(), service.listProducts()]);
  res.json({ success: true, data: { settings, products } });
});

const getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getSettings() });
});

const updateSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateSettings(req.body, req.user.userId) });
});

const listProducts = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listProducts() });
});

const getProduct = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getProductByKey(req.params.key) });
});

const createProduct = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createProduct(req.body, req.user.userId) });
});

const updateProduct = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateProduct(req.params.key, req.body, req.user.userId) });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await service.deleteProduct(req.params.key);
  res.json({ success: true, data: null });
});

const getPublicPricing = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getPublicPricing() });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  const url = await saveUpload({ ...req.body, kind: 'photo' });
  res.status(201).json({ success: true, data: { url } });
});

module.exports = {
  getAll,
  getSettings,
  updateSettings,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getPublicPricing,
  uploadPhoto,
};
