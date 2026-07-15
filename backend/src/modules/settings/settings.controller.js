const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./settings.service');
const { saveUpload } = require('../../common/utils/fileUpload');

const getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getSettings() });
});

const updateSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateSettings(req.body, req.user.userId) });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  const url = await saveUpload({ ...req.body, kind: 'photo' });
  res.status(201).json({ success: true, data: { url } });
});

module.exports = { getSettings, updateSettings, uploadPhoto };
