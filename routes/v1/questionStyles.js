const express = require('express');
const questionStyleController = require('../../controllers/questionStyleController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(questionStyleController.listQuestionStyles));
  router.get('/:id', asyncHandler(questionStyleController.getQuestionStyle));
  router.post('/', asyncHandler(questionStyleController.createQuestionStyle));
  router.put('/:id', asyncHandler(questionStyleController.updateQuestionStyle));
  router.delete('/:id', asyncHandler(questionStyleController.deleteQuestionStyle));

  app.use('/api/v1/question-styles', router);
};
