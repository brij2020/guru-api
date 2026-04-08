const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const controller = require('../../controllers/sarkariJobUpdateController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(controller.getAllPublic));
  router.get('/category/:category', asyncHandler(controller.getByCategoryPublic));
  router.get('/:id', asyncHandler(controller.getByIdPublic));

  app.use('/api/v1/sarkari-job-updates', router);
};
