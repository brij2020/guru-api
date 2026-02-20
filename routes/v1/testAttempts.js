const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const testAttemptController = require('../../controllers/testAttemptController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.post('/start', asyncHandler(testAttemptController.startTestAttempt));

  app.use('/api/v1/test-attempts', router);
};
