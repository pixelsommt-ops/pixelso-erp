// M03: Production Order / PO

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./production-orders.service');
const { saveUpload } = require('../../common/utils/fileUpload');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user);
  res.status(201).json({ success: true, data });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ success: true, data });
});

const setDetailMaterial = asyncHandler(async (req, res) => {
  const data = await service.setDetailMaterial(req.params.detailId, req.body);
  res.json({ success: true, data });
});

const uploadReferenceImage = asyncHandler(async (req, res) => {
  const url = await saveUpload({ ...req.body, kind: 'photo' });
  res.status(201).json({ success: true, data: { url } });
});

module.exports = { list, getById, create, update, setDetailMaterial, uploadReferenceImage };
