const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./theme.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list();
  res.json({ success: true, data, colorKeys: service.THEMEABLE_COLOR_KEYS });
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

const deleteTheme = asyncHandler(async (req, res) => {
  await service.deleteTheme(req.params.id);
  res.json({ success: true });
});

const activate = asyncHandler(async (req, res) => {
  const data = await service.activate(req.params.id);
  res.json({ success: true, data });
});

const deactivate = asyncHandler(async (req, res) => {
  const data = await service.deactivate(req.params.id);
  res.json({ success: true, data });
});

module.exports = { list, getById, create, update, deleteTheme, activate, deactivate };
