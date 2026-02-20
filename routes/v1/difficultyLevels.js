const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const difficultyLevelController = require('../../controllers/difficultyLevelController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(difficultyLevelController.listDifficultyLevels));
  router.get('/:id', asyncHandler(difficultyLevelController.getDifficultyLevel));
  router.post('/', asyncHandler(difficultyLevelController.createDifficultyLevel));
  router.put('/:id', asyncHandler(difficultyLevelController.updateDifficultyLevel));
  router.delete('/:id', asyncHandler(difficultyLevelController.deleteDifficultyLevel));

  app.use('/api/v1/difficulty-levels', router);
};
