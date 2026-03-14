const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');
const { unauthorized } = require('../helpers/response.helper');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return unauthorized(res, 'No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return unauthorized(res, 'User not found');
    }

    if (!user.isActive) {
      return unauthorized(res, 'User account is inactive');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expired');
    }
    return unauthorized(res, 'Authentication failed');
  }
};

/**
 * Optional authentication - attach user if token is valid, but don't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken
};
