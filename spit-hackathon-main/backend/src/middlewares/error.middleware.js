const { ZodError } = require('zod');
const { badRequest, internalError } = require('../helpers/response.helper');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message
    }));
    return badRequest(res, 'Validation failed', errors);
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
    return badRequest(res, 'Validation failed', errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return badRequest(res, `${field} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return badRequest(res, `Invalid ${err.path}: ${err.value}`);
  }

  // JWT errors (handled in auth middleware, but just in case)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: 'Token expired',
      timestamp: new Date().toISOString()
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors || null,
      timestamp: new Date().toISOString()
    });
  }

  // Default to 500 server error
  return internalError(
    res,
    process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    process.env.NODE_ENV === 'production' 
      ? null 
      : { stack: err.stack }
  );
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
