const Notification = require('../models/notification');
const User = require('../models/user');

const createNotification = async ({ userId, type, title, body, data = {} }) => {
  console.log('[Notification] Creating notification for user:', userId);
  console.log('[Notification] Type:', type, 'Title:', title, 'Data:', data);
  
  const notification = new Notification({
    userId,
    type,
    title,
    body,
    data,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  
  await notification.save();
  console.log('[Notification] Saved successfully:', notification._id);
  return notification;
};

const notifyWeeklyTestReady = async (userId, testId, weekStart, meta = {}) => {
  console.log('[Notification] notifyWeeklyTestReady called:', { userId, testId: testId?.toString(), weekStart: weekStart?.toISOString?.(), meta });
  return createNotification({
    userId,
    type: 'weekly_test_ready',
    title: 'Your Weekly Test is Ready!',
    body: `A new weekly test has been generated based on your study schedule. Check it out now!`,
    data: {
      testId: testId.toString(),
      weekStart: weekStart.toISOString(),
      examSlug: meta.examSlug || null,
      stageSlug: meta.stageSlug || null,
      paperId: meta.paperId || null,
      sections: Array.isArray(meta.sections) ? meta.sections : [],
      redirectUrl: meta.redirectUrl || null,
    },
  });
};

const getUserNotifications = async (userId, { limit = 20, unreadOnly = false } = {}) => {
  const query = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }
  
  return Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, isRead: false });
};

const markAsRead = async (userId, notificationId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

const markAllAsRead = async (userId) => {
  return Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

const deleteNotification = async (userId, notificationId) => {
  return Notification.findOneAndDelete({ _id: notificationId, userId });
};

const cleanupExpired = async () => {
  return Notification.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

module.exports = {
  createNotification,
  notifyWeeklyTestReady,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupExpired,
};
