// M02: Customer & CRM Ringkas

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./customers.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

const getDormant = asyncHandler(async (req, res) => {
  const data = await service.getDormant(req.query);
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

const deleteCustomer = asyncHandler(async (req, res) => {
  await service.deleteCustomer(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = { list, getById, create, update, deleteCustomer, getDormant };
