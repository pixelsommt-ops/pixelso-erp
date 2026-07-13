// M01: Auth

const asyncHandler = require('../../common/utils/asyncHandler');
const service = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const data = await service.login(email, password);
  res.json({ success: true, data });
});

const me = asyncHandler(async (req, res) => {
  const data = await service.me(req.user.userId);
  res.json({ success: true, data });
});

module.exports = { login, me };
