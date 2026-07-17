// M08: Finance & Bonus

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./finance.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query, req.user);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id, req.user);
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

const getRevenueReport = asyncHandler(async (req, res) => {
  const data = await service.getRevenueReport(req.query);
  res.json({ success: true, data });
});

const getExpenseSummary = asyncHandler(async (req, res) => {
  const data = await service.getExpenseSummary(req.query);
  res.json({ success: true, data });
});

const autoCalculateBonus = asyncHandler(async (req, res) => {
  const data = await service.autoCalculateBonus(req.body.period);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, getRevenueReport, getExpenseSummary, autoCalculateBonus };
