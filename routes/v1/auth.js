const express = require('express');
const asyncHandler = require('../../../middleware/asyncHandler');
const authenticate = require('../../../middleware/authenticate');
const authController = require('../../../controllers/authController');

module.exports = (app) => {
  const router = express.Router();

  router.post('/register', asyncHandler(authController.register));
  router.post('/login', asyncHandler(authController.login));
  router.post('/refresh-token', asyncHandler(authController.refresh));
  router.post('/logout', authenticate, asyncHandler(authController.logout));
  router.get('/me', authenticate, asyncHandler(authController.me));

  app.use('/api/v1/auth', router);
};
