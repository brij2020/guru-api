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
  router.post('/assemble-it-paper', aiLimiter, authenticate, asyncHandler(questionBankController.assembleItPaper));
  router.post('/import-json', readLimiter, authenticate, asyncHandler(questionBankController.importJson));
  router.post('/bulk-create', readLimiter, authenticate, asyncHandler(questionBankController.bulkCreateQuestions));
  router.get('/review-list', readLimiter, authenticate, asyncHandler(questionBankController.listForReview));
  router.put('/review-status', readLimiter, authenticate, asyncHandler(questionBankController.updateReviewStatus));
  router.put('/review-item/:id', readLimiter, authenticate, asyncHandler(questionBankController.updateReviewQuestion));
  router.post('/review-item/:id/ai-review', aiLimiter, authenticate, asyncHandler(questionBankController.aiReviewQuestion));
  router.get('/coverage', readLimiter, authenticate, asyncHandler(questionBankController.getCoverage));
  router.get('/todays-questions', readLimiter, asyncHandler(questionBankController.getTodaysQuestionsBySection));
  router.post('/pdf-jobs', readLimiter, authenticate, asyncHandler(pdfExtractionJobController.createPdfJob));
  router.get('/pdf-jobs', readLimiter, authenticate, asyncHandler(pdfExtractionJobController.listPdfJobs));
  router.get('/pdf-jobs/:id', readLimiter, authenticate, asyncHandler(pdfExtractionJobController.getPdfJob));
  router.post('/pdf-jobs/:id/run', readLimiter, authenticate, asyncHandler(pdfExtractionJobController.runPdfJob));
  router.post('/pdf-jobs/:id/import', readLimiter, authenticate, asyncHandler(pdfExtractionJobController.importPdfJob));
  router.get('/:id', readLimiter, authenticate, asyncHandler(questionBankController.getQuestionById));
  router.put('/:id', readLimiter, authenticate, asyncHandler(questionBankController.updateQuestionById));
  router.delete('/:id', readLimiter, authenticate, asyncHandler(questionBankController.deleteQuestionById));

  app.use('/api/v1/question-bank', router);
};
