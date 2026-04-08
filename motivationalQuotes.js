const express = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const authenticate = require('../../../middleware/authenticate');
const controller = require('../../../controllers/motivationalQuoteController');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);

  router.get('/', asyncHandler(controller.getAll));
  router.get('/random', asyncHandler(controller.getRandom));
  router.post('/', asyncHandler(controller.create));
  router.put('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.remove));

  app.use('/api/admin/motivational-quotes', router);
};
