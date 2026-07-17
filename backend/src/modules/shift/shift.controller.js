const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./shift.service');

const listShifts = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listShifts() });
});

const createShift = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createShift(req.body) });
});

const updateShift = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateShift(req.params.id, req.body) });
});

const deleteShift = asyncHandler(async (req, res) => {
  await service.deleteShift(req.params.id);
  res.json({ success: true, data: null });
});

const listAssignments = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.listAssignments(req.query, req.user) });
});

const createAssignment = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createAssignment(req.body) });
});

const deleteAssignment = asyncHandler(async (req, res) => {
  await service.deleteAssignment(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = {
  listShifts, createShift, updateShift, deleteShift,
  listAssignments, createAssignment, deleteAssignment,
};
