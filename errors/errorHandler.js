const { logger, logStore } = require('../config/logger');
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

  const requestId = req.headers['x-request-id'] || Date.now() + '-' + Math.random().toString(36).slice(2, 11);

  const logData = {
    service: 'aiguru-api',
    requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode: status,
    error: err.message,
    stack: err.stack,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    ...(err.errors ? { errors: err.errors } : {}),
  };

  logStore.add('error', 'api', req.method + ' ' + req.originalUrl + ' - ' + err.message, null, logData);

  logger.error('Request error', {
    status,
    path: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack,
    ...(err.errors ? { errors: err.errors } : {}),
  });

  res.status(status).json(response);
};

module.exports = errorHandler;
