const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const difficultyController = require('../../controllers/difficultyController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(difficultyController.listDifficulties));

  app.use('/api/v1/difficulties', router);
};
