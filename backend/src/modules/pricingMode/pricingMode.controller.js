const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./pricingMode.service');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list() });
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.create(req.body) });
});

const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.update(req.params.key, req.body) });
});

const deleteMode = asyncHandler(async (req, res) => {
  await service.deleteMode(req.params.key);
  res.json({ success: true, data: null });
});

module.exports = { list, create, update, deleteMode };
