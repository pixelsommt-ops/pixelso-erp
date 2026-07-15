const jwt = require('jsonwebtoken');
const config = require('../../config');
const ApiError = require('../errors/ApiError');

// Auth pelanggan storefront - sengaja terpisah dari authenticate() staf: secret beda
// (CUSTOMER_JWT_SECRET) dan payload beda bentuk (tidak ada roleName), supaya token
// pelanggan tidak pernah bisa lolos authorize() milik staf.
function authenticateCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Missing bearer token'));
  }

  try {
    const payload = jwt.verify(token, config.customerJwtSecret);
    if (payload.kind !== 'customer') {
      return next(new ApiError(401, 'Invalid token'));
    }
    req.customer = { customerId: payload.customerId };
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = { authenticateCustomer };
