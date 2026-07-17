// M06: Produksi

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./production.service');

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
  const data = await service.update(req.params.id, req.body, req.user);
  res.json({ success: true, data });
});

const listMachines = asyncHandler(async (req, res) => {
  const data = await service.listMachines(req.query);
  res.json({ success: true, data });
});

const createMachine = asyncHandler(async (req, res) => {
  const data = await service.createMachine(req.body);
  res.status(201).json({ success: true, data });
});

module.exports = { list, getById, create, update, listMachines, createMachine };
