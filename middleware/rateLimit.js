const ApiError = require('../errors/apiError');
const { rateLimitEnabled } = require('../config/env');

const stores = new Map();

const buildKey = (prefix, req) => {
  const identity = req.user?.id || req.ip || 'anonymous';
  return `${prefix}:${identity}`;
};

const createRateLimiter = ({ keyPrefix, windowMs, max }) => {
  const safePrefix = String(keyPrefix || 'default');
  const safeWindow = Math.max(1000, Number(windowMs || 60_000));
  const safeMax = Math.max(1, Number(max || 60));

  return (req, res, next) => {
    if (!rateLimitEnabled) return next();

    const now = Date.now();
    const key = buildKey(safePrefix, req);
    const state = stores.get(key);
    if (!state || now > state.resetAt) {
      stores.set(key, { count: 1, resetAt: now + safeWindow });
      return next();
    }

    state.count += 1;
    if (state.count > safeMax) {
      const retryAfterSec = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return next(new ApiError(429, `Too many requests. Retry in ${retryAfterSec}s.`));
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
};
