const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret } = require('../config/env');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the Bearer token and loads req.user
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Not authenticated');
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (e) {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, 'User no longer exists');
  req.user = user;
  next();
});

// Like protect but does not fail for anonymous visitors
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), jwtSecret);
      req.user = await User.findById(payload.id);
    } catch (e) {
      /* ignore */
    }
  }
  next();
});

// Role based access control
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You are not allowed to perform this action'));
  }
  next();
};

module.exports = { protect, optionalAuth, authorize };
