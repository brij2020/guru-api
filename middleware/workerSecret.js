const ApiError = require('../errors/apiError');
const { workerSecret, nodeEnv } = require('../config/env');

module.exports = (req, res, next) => {
  if (!workerSecret) {
    if (nodeEnv === 'test') return next();
    return next(new ApiError(503, 'Worker secret is not configured'));
  }

  const incoming = String(req.headers['x-worker-secret'] || '');
  if (!incoming || incoming !== workerSecret) {
    return next(new ApiError(403, 'Invalid worker secret'));
  }

  return next();
};
