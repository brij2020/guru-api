const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const paperBlueprintController = require('../../controllers/paperBlueprintController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(paperBlueprintController.getBlueprint));
  router.use(authenticate);
  router.put('/', asyncHandler(paperBlueprintController.upsertBlueprint));

  app.use('/api/v1/paper-blueprints', router);
};
