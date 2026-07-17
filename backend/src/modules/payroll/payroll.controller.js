const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./payroll.service');

const listRuns = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listRuns() });
});

const getRunById = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getRunById(req.params.id) });
});

const createRun = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createRun(req.body.period, req.user) });
});

const finalizeRun = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.finalizeRun(req.params.id) });
});

const updateItem = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateItem(req.params.id, req.body) });
});

module.exports = { listRuns, getRunById, createRun, finalizeRun, updateItem };
