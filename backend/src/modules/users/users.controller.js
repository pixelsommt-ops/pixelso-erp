// M01: User & Role Management

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./users.service');

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

const listRoles = asyncHandler(async (req, res) => {
  const data = await service.listRoles();
  res.json({ success: true, data });
});

const listTeams = asyncHandler(async (req, res) => {
  const data = await service.listTeams();
  res.json({ success: true, data });
});

const createTeam = asyncHandler(async (req, res) => {
  const data = await service.createTeam(req.body);
  res.status(201).json({ success: true, data });
});

const deleteTeam = asyncHandler(async (req, res) => {
  await service.deleteTeam(req.params.id);
  res.json({ success: true, data: null });
});

module.exports = { list, getById, create, update, listRoles, listTeams, createTeam, deleteTeam };
