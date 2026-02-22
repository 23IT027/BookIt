/**
 * Standardized API response helper
 */

class ApiResponse {
  constructor(success, statusCode, message, data = null, errors = null) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== null) this.data = data;
    if (errors !== null) this.errors = errors;
    this.timestamp = new Date().toISOString();
  }
}

// Success responses
const successResponse = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json(new ApiResponse(true, statusCode, message, data));
};

const created = (res, message, data = null) => {
  return successResponse(res, 201, message, data);
};

const ok = (res, message, data = null) => {
  return successResponse(res, 200, message, data);
};

// Error responses
const errorResponse = (res, statusCode, message, errors = null) => {
  return res.status(statusCode).json(new ApiResponse(false, statusCode, message, null, errors));
};

const badRequest = (res, message, errors = null) => {
  return errorResponse(res, 400, message, errors);
};

const unauthorized = (res, message = 'Unauthorized') => {
  return errorResponse(res, 401, message);
};

const forbidden = (res, message = 'Forbidden') => {
  return errorResponse(res, 403, message);
};

const notFound = (res, message = 'Resource not found') => {
  return errorResponse(res, 404, message);
};

const conflict = (res, message = 'Resource conflict') => {
  return errorResponse(res, 409, message);
};

const internalError = (res, message = 'Internal server error', errors = null) => {
  return errorResponse(res, 500, message, errors);
};

module.exports = {
  ApiResponse,
  successResponse,
  created,
  ok,
  errorResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError
};
