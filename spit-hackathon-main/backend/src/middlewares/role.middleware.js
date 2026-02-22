const { forbidden } = require('../helpers/response.helper');

/**
 * Check if user has required role(s)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(res, `Access denied. Required role: ${allowedRoles.join(' or ')}`);
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const isAdmin = authorize('ADMIN');

/**
 * Check if user is organiser or admin
 */
const isOrganiser = authorize('ORGANISER', 'ADMIN');

/**
 * Check if user is customer (any authenticated user)
 */
const isCustomer = authorize('CUSTOMER', 'ORGANISER', 'ADMIN');

/**
 * Check if user owns the resource or is admin
 */
const isOwnerOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Authentication required');
    }

    // Admin can access anything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check ownership
    const resourceUserId = req[resourceUserIdField] || req.params[resourceUserIdField];
    
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return forbidden(res, 'Access denied. You can only access your own resources');
  };
};

module.exports = {
  authorize,
  isAdmin,
  isOrganiser,
  isCustomer,
  isOwnerOrAdmin
};
