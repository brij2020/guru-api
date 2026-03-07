const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const questionBankController = require('../../controllers/questionBankController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.post('/similar', asyncHandler(questionBankController.pullSimilarQuestions));

  app.use('/api/v1/question-bank', router);
};
