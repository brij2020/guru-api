const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const { createRateLimiter } = require('../../middleware/rateLimit');
const { rateLimitWindowMs, aiRateLimitMax, writeRateLimitMax } = require('../../config/env');
const questionBankController = require('../../controllers/questionBankController');
const pdfExtractionJobController = require('../../controllers/pdfExtractionJobController');

module.exports = (app) => {
  const router = express.Router();
  const readLimiter = createRateLimiter({
    keyPrefix: 'question-bank-read',
    windowMs: rateLimitWindowMs,
    max: writeRateLimitMax,
  });
  const aiLimiter = createRateLimiter({
    keyPrefix: 'question-bank-ai',
    windowMs: rateLimitWindowMs,
    max: aiRateLimitMax,
  });

  router.post('/similar', readLimiter, authenticate, asyncHandler(questionBankController.pullSimilarQuestions));
  router.post('/assemble-paper', aiLimiter, authenticate, asyncHandler(questionBankController.assemblePaper));
  router.post('/assemble-it-paper', aiLimiter, asyncHandler(questionBankController.assembleItPaper));
  router.post('/import-json', readLimiter, asyncHandler(questionBankController.importJson));
  router.post('/bulk-create', readLimiter, authenticate, asyncHandler(questionBankController.bulkCreateQuestions));
  router.get('/review-list', readLimiter, asyncHandler(questionBankController.listForReview));
  router.put('/review-status', readLimiter, asyncHandler(questionBankController.updateReviewStatus));
  router.put('/review-item/:id', readLimiter, asyncHandler(questionBankController.updateReviewQuestion));
  router.post('/review-item/:id/ai-review', aiLimiter, asyncHandler(questionBankController.aiReviewQuestion));
  router.get('/coverage', readLimiter, asyncHandler(questionBankController.getCoverage));
  router.get('/todays-questions', readLimiter, asyncHandler(questionBankController.getTodaysQuestionsBySection));
  router.post('/pdf-jobs', readLimiter, asyncHandler(pdfExtractionJobController.createPdfJob));
  router.get('/pdf-jobs', readLimiter, asyncHandler(pdfExtractionJobController.listPdfJobs));
  router.get('/pdf-jobs/:id', readLimiter, asyncHandler(pdfExtractionJobController.getPdfJob));
  router.post('/pdf-jobs/:id/run', readLimiter, asyncHandler(pdfExtractionJobController.runPdfJob));
  router.post('/pdf-jobs/:id/import', readLimiter, asyncHandler(pdfExtractionJobController.importPdfJob));

  app.use('/api/v1/question-bank', router);
};
