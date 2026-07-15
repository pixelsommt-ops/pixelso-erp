const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./storefront.service');
const { saveUpload } = require('../../common/utils/fileUpload');

const register = asyncHandler(async (req, res) => {
  const data = await service.register(req.body);
  res.status(201).json({ success: true, data });
});

const login = asyncHandler(async (req, res) => {
  const data = await service.login(req.body);
  res.json({ success: true, data });
});

const getCatalog = asyncHandler(async (req, res) => {
  const data = await service.getCatalog();
  res.json({ success: true, data });
});

const getSiteSettings = asyncHandler(async (req, res) => {
  const data = await service.getSiteSettings();
  res.json({ success: true, data });
});

const getPromos = asyncHandler(async (req, res) => {
  const data = await service.getPromos();
  res.json({ success: true, data });
});

const upload = asyncHandler(async (req, res) => {
  const url = await saveUpload(req.body);
  res.status(201).json({ success: true, data: { url } });
});

const checkout = asyncHandler(async (req, res) => {
  const data = await service.checkout(req.customer.customerId, req.body);
  res.status(201).json({ success: true, data });
});

const myOrders = asyncHandler(async (req, res) => {
  const data = await service.listMyOrders(req.customer.customerId);
  res.json({ success: true, data });
});

const myOrderDetail = asyncHandler(async (req, res) => {
  const data = await service.getMyOrder(req.customer.customerId, req.params.poId);
  res.json({ success: true, data });
});

module.exports = { register, login, getCatalog, getSiteSettings, getPromos, upload, checkout, myOrders, myOrderDetail };
