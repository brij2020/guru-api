const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const controller = require('../../controllers/motivationalQuoteController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(controller.getAll));
  router.get('/random', asyncHandler(controller.getRandom));
  router.post('/', authenticate, asyncHandler(controller.create));
  router.put('/:id', authenticate, asyncHandler(controller.update));
  router.delete('/:id', authenticate, asyncHandler(controller.remove));

  app.use('/api/v1/motivational', router);
};
