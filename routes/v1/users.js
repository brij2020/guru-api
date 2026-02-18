const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authController = require('../../controllers/authController');

module.exports = (app) => {
  const router = express.Router();

  // Register user
  router.post('/register', asyncHandler(authController.register));

  // Keep both modern and legacy-compatible paths
  app.use('/api/v1/user', router);
  app.use('/v1/user', router);
};
