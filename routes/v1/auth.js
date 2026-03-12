const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const { createRateLimiter } = require('../../middleware/rateLimit');
const { rateLimitWindowMs, authRateLimitMax } = require('../../config/env');
const authController = require('../../controllers/authController');

module.exports = (app) => {
  const router = express.Router();
  const authLimiter = createRateLimiter({
    keyPrefix: 'auth',
    windowMs: rateLimitWindowMs,
    max: authRateLimitMax,
  });

  router.post('/register', authLimiter, asyncHandler(authController.register));
  router.post('/login', authLimiter, asyncHandler(authController.login));
  router.post('/refresh-token', authLimiter, asyncHandler(authController.refresh));
  router.post('/logout', authenticate, asyncHandler(authController.logout));
  router.get('/me', authenticate, asyncHandler(authController.me));

  app.use('/api/v1/auth', router);
};
