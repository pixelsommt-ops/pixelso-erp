const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./attendance.service');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.query, req.user) });
});

const checkIn = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.checkIn(req.user, req.body) });
});

const checkOut = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.checkOut(req.user, req.body) });
});

module.exports = { list, checkIn, checkOut };
