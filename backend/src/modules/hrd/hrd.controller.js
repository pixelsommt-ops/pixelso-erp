// M10: HRD Productivity

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./hrd.service');

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

const productivityReport = asyncHandler(async (req, res) => {
  const data = await service.getProductivityReport(req.query);
  res.json({ success: true, data });
});

const ranking = asyncHandler(async (req, res) => {
  const data = await service.getRanking(req.query);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, productivityReport, ranking };
