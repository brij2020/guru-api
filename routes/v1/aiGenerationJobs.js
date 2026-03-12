const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const workerSecret = require('../../middleware/workerSecret');
const { createRateLimiter } = require('../../middleware/rateLimit');
const {
  rateLimitWindowMs,
  aiRateLimitMax,
  aiJobCreateRateLimitMax,
} = require('../../config/env');
const aiGenerationJobController = require('../../controllers/aiGenerationJobController');

module.exports = (app) => {
  const router = express.Router();

  const aiLimiter = createRateLimiter({
    keyPrefix: 'ai-generation',
    windowMs: rateLimitWindowMs,
    max: aiRateLimitMax,
  });
  const aiCreateLimiter = createRateLimiter({
    keyPrefix: 'ai-generation-create',
    windowMs: rateLimitWindowMs,
    max: aiJobCreateRateLimitMax,
  });

  router.post('/worker-run', workerSecret, aiLimiter, asyncHandler(aiGenerationJobController.workerRun));
  router.use(authenticate);
  router.post('/', aiCreateLimiter, asyncHandler(aiGenerationJobController.createJob));
  router.get('/', asyncHandler(aiGenerationJobController.listJobs));
  router.post('/process-next', aiLimiter, asyncHandler(aiGenerationJobController.processNextJob));
  router.get('/:jobId', asyncHandler(aiGenerationJobController.getJob));

  app.use('/api/v1/ai-generation-jobs', router);
};
