const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/response');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password -refreshToken -passwordResetToken');

    if (!user) return sendError(res, 401, 'User no longer exists.');
    if (!user.isActive) return sendError(res, 401, 'Account has been deactivated.');
    if (user.isBlocked) return sendError(res, 403, 'Account has been blocked. Contact support.');

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return sendError(res, 401, 'Invalid token.');
    if (error.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired.');
    return sendError(res, 500, 'Authentication error.');
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, 403, `Role '${req.user.role}' is not authorized to access this route.`);
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password -refreshToken');
    }
  } catch (_) {}
  next();
};

module.exports = { protect, authorize, optionalAuth };
