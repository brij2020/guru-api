const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const { createRateLimiter } = require('../../middleware/rateLimit');
const { rateLimitWindowMs, aiRateLimitMax } = require('../../config/env');
const testAttemptController = require('../../controllers/testAttemptController');

module.exports = (app) => {
  const router = express.Router();
  const attemptLimiter = createRateLimiter({
    keyPrefix: 'test-attempt-start',
    windowMs: rateLimitWindowMs,
    max: aiRateLimitMax,
  });

  router.use(authenticate);
  router.get('/', asyncHandler(testAttemptController.getTestAttempts));
  router.post('/start', attemptLimiter, asyncHandler(testAttemptController.startTestAttempt));
  router.post('/complete', asyncHandler(testAttemptController.completeTestAttempt));

  app.use('/api/v1/test-attempts', router);
};
