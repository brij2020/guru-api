const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const systemController = require('../../controllers/systemController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/metrics', asyncHandler(systemController.getMetrics));

  app.use('/api/v1/system', router);
};
