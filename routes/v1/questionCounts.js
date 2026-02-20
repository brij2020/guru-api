const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const questionCountController = require('../../controllers/questionCountController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(questionCountController.listQuestionCounts));
  router.get('/:id', asyncHandler(questionCountController.getQuestionCount));
  router.post('/', asyncHandler(questionCountController.createQuestionCount));
  router.put('/:id', asyncHandler(questionCountController.updateQuestionCount));
  router.delete('/:id', asyncHandler(questionCountController.deleteQuestionCount));

  app.use('/api/v1/question-counts', router);
};
