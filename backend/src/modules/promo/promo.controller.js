const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./promo.service');
const { saveUpload } = require('../../common/utils/fileUpload');

const listPromos = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listPromos() });
});

const getPromo = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getPromoById(req.params.id) });
});

const createPromo = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createPromo(req.body, req.user.userId) });
});

const updatePromo = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updatePromo(req.params.id, req.body, req.user.userId) });
});

const deletePromo = asyncHandler(async (req, res) => {
  await service.deletePromo(req.params.id);
  res.json({ success: true, data: null });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  const url = await saveUpload({ ...req.body, kind: 'photo' });
  res.status(201).json({ success: true, data: { url } });
});

module.exports = {
  listPromos,
  getPromo,
  createPromo,
  updatePromo,
  deletePromo,
  uploadPhoto,
};
