const jwt = require('jsonwebtoken');
const config = require('../../config');
const ApiError = require('../errors/ApiError');

// Verifies the JWT and attaches { userId, roleId, roleName } to req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Missing bearer token'));
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

// Restricts a route to specific role names, e.g. authorize('manager', 'finance')
// See PRD 3.1 Persona Pengguna dan Hak Akses for the role -> permission mapping.
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.roleName)) {
      return next(new ApiError(403, 'Insufficient role permission'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
