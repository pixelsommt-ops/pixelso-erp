// M07: QC & Delivery

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./qc-delivery.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user);
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ success: true, data });
});

const listDeliveries = asyncHandler(async (req, res) => {
  const data = await service.listDeliveries(req.query);
  res.json({ success: true, data });
});

const createDelivery = asyncHandler(async (req, res) => {
  const data = await service.createDelivery(req.body);
  res.status(201).json({ success: true, data });
});

const updateDelivery = asyncHandler(async (req, res) => {
  const data = await service.updateDelivery(req.params.id, req.body);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, listDeliveries, createDelivery, updateDelivery };
