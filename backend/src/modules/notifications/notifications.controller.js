// M12: Notification & Approval

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./notifications.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query, req.user);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id, req.user);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user);
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body, req.user);
  res.json({ success: true, data });
});

const markAllRead = asyncHandler(async (req, res) => {
  const data = await service.markAllRead(req.user);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, markAllRead };
