const logger = require('../config/logger');
const { nodeEnv } = require('../config/env');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === 'CastError') {
    err.statusCode = 400;
    err.message = 'Invalid resource identifier';
  }

  if (err.code === 11000) {
    err.statusCode = 409;
    err.message = 'Duplicate value for a unique field';
  }

  const status = err.statusCode || err.status || 500;
  const response = {
    status,
    error: err.message || 'Internal server error',
  };

  if (err.errors) {
    response.details = err.errors;
  }

  if (nodeEnv !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  logger.error('Request error', {
    status,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    ...(err.errors ? { errors: err.errors } : {}),
  });

  res.status(status).json(response);
};

module.exports = errorHandler;
