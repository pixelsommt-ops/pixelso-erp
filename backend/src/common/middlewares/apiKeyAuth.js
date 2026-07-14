const crypto = require('crypto');
const config = require('../../config');
const ApiError = require('../errors/ApiError');

// Server-to-server auth for the landing page's public pricing fetch - not a logged-in ERP user,
// so this deliberately does not use the JWT authenticate() middleware.
function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireApiKey(req, res, next) {
  const expected = config.landingPageApiKey;
  if (!expected) {
    return next(new ApiError(500, 'LANDING_PAGE_API_KEY is not configured'));
  }
  const provided = req.headers['x-api-key'] || '';
  if (!provided || !constantTimeEqual(provided, expected)) {
    return next(new ApiError(401, 'Invalid or missing API key'));
  }
  next();
}

module.exports = { requireApiKey };
