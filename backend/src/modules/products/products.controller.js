const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./products.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body);
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ success: true, data });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await service.deleteProduct(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = { list, getById, create, update, deleteProduct };
