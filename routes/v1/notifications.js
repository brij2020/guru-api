const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const notificationController = require('../../controllers/notificationController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', authenticate, asyncHandler(notificationController.getNotifications));
  router.get('/unread-count', authenticate, asyncHandler(notificationController.getUnreadCount));
  router.put('/:id/read', authenticate, asyncHandler(notificationController.markAsRead));
  router.put('/read-all', authenticate, asyncHandler(notificationController.markAllAsRead));
  router.delete('/:id', authenticate, asyncHandler(notificationController.deleteNotification));

  app.use('/api/v1/notifications', router);
};
