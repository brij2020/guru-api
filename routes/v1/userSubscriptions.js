const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const isAdmin = require('../../middleware/isAdmin');
const userSubscriptionController = require('../../controllers/userSubscriptionController');

router.get('/me', authenticate, asyncHandler(userSubscriptionController.getUserSubscription));

router.get('/history', authenticate, asyncHandler(userSubscriptionController.getUserSubscriptionHistory));

router.post('/subscribe', authenticate, asyncHandler(userSubscriptionController.subscribeToPlan));

router.post('/cancel', authenticate, asyncHandler(userSubscriptionController.cancelSubscription));

router.post('/reactivate', authenticate, asyncHandler(userSubscriptionController.reactivateSubscription));

router.get('/mock-test-access', authenticate, asyncHandler(userSubscriptionController.checkMockTestAccess));

router.post('/record-mock-test', authenticate, asyncHandler(userSubscriptionController.recordMockTestTaken));

router.get('/', authenticate, isAdmin, asyncHandler(userSubscriptionController.getAdminUserSubscriptions));

router.post('/', authenticate, isAdmin, asyncHandler(userSubscriptionController.adminCreateSubscription));

router.put('/:id', authenticate, isAdmin, asyncHandler(userSubscriptionController.adminUpdateSubscription));

module.exports = (app) => {
  app.use('/api/v1/user-subscriptions', router);
};
