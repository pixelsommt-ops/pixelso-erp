const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./supplier.service');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query) });
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.create(req.body) });
});

const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.update(req.params.id, req.body) });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  await service.deleteSupplier(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = { list, create, update, deleteSupplier };
