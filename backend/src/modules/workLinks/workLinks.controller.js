const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./workLinks.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user);
  res.status(201).json({ success: true, data });
});

const deleteLink = asyncHandler(async (req, res) => {
  await service.deleteLink(req.params.id);
  res.json({ success: true, data: null });
});

const click = asyncHandler(async (req, res) => {
  await service.recordClick(req.params.id, req.user);
  res.status(201).json({ success: true, data: null });
});

const listClicks = asyncHandler(async (req, res) => {
  const data = await service.listClicks(req.params.id);
  res.json({ success: true, data });
});

module.exports = { list, create, deleteLink, click, listClicks };
