const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { User } = require('../models');
const { HttpError, asyncHandler } = require('../utils/httpError');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new HttpError(401, 'Session expired or invalid. Please log in again.');
  }

  const user = await User.findByPk(payload.id);
  if (!user || !user.isActive) throw new HttpError(401, 'Account not found or deactivated');
  req.user = user;
  next();
});

// Usage: authorize('admin', 'teacher')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action'));
  }
  next();
};

module.exports = { authenticate, authorize };
