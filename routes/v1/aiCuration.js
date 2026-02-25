const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const aiCurationController = require('../../controllers/aiCurationController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.post('/curate-questions', asyncHandler(aiCurationController.curateQuestions));
  router.post('/evaluate-test', asyncHandler(aiCurationController.evaluateTest));

  app.use('/api/v1/ai', router);
};
