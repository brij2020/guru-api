const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authController = require('../../controllers/authController');
const userPreferencesController = require('../../controllers/userPreferencesController');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  // Register user
  router.post('/register', asyncHandler(authController.register));

  // User preferences
  router.get('/preferences', authenticate, userPreferencesController.getPreferences);
  router.put('/preferences', authenticate, userPreferencesController.updatePreferences);

  // Keep both modern and legacy-compatible paths
  app.use('/api/v1/user', router);
  app.use('/v1/user', router);
};
