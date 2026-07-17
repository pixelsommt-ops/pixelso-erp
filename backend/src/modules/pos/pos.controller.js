// M04: POS & Pembayaran

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./pos.service');

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({ success: true, data });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

const getQuote = asyncHandler(async (req, res) => {
  const data = await service.getQuote(req.params.poId);
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

const confirmPayment = asyncHandler(async (req, res) => {
  const data = await service.confirmPayment(req.params.id, req.params.paymentId, req.body.action, req.user);
  res.json({ success: true, data });
});

module.exports = { list, getById, getQuote, create, update, confirmPayment };
