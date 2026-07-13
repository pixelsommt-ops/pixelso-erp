// M09: Marketing Analytics

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./marketing.service');

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

const topProducts = asyncHandler(async (req, res) => {
  const data = await service.getTopProducts(req.query);
  res.json({ success: true, data });
});

const channels = asyncHandler(async (req, res) => {
  const data = await service.getChannelBreakdown(req.query);
  res.json({ success: true, data });
});

const repeatCustomers = asyncHandler(async (req, res) => {
  const data = await service.getRepeatCustomers(req.query);
  res.json({ success: true, data });
});

const cohort = asyncHandler(async (req, res) => {
  const data = await service.getCohort(req.query);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, topProducts, channels, repeatCustomers, cohort };
