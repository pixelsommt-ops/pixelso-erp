const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./expense.service');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query) });
});

const getById = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.create(req.body, req.user) });
});

const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.update(req.params.id, req.body) });
});

const deleteExpense = asyncHandler(async (req, res) => {
  await service.deleteExpense(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = { list, getById, create, update, deleteExpense };
