const ApiError = require('../errors/apiError');
const { logger } = require('../config/logger');
const analyticsService = require('../services/analyticsService');
const {
  validateAnalyticsSessionStart,
  validateAnalyticsSessionUpdate,
  validateAnalyticsQuery,
} = require('../validators/analyticsValidator');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const startSession = async (req, res) => {
  const payload = validateAnalyticsSessionStart(req.body || {});
  const session = await analyticsService.trackSessionStart(payload, req.user);
  logger.info('Analytics session started', {
    sessionId: session.sessionId,
    userId: req.user?.id || 'anonymous',
    path: session.path,
  });
  res.status(201).json({ data: { sessionId: session.sessionId } });
};

const heartbeat = async (req, res) => {
  const payload = validateAnalyticsSessionUpdate(req.body || {});
  const session = await analyticsService.trackSessionHeartbeat(payload);
  if (!session) {
    throw new ApiError(404, 'Analytics session not found');
  }
  res.json({ data: { sessionId: session.sessionId } });
};

const endSession = async (req, res) => {
  const payload = validateAnalyticsSessionUpdate(req.body || {});
  const session = await analyticsService.trackSessionEnd(payload);
  if (!session) {
    throw new ApiError(404, 'Analytics session not found');
  }
  res.json({ data: { sessionId: session.sessionId } });
};

const getOverview = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const query = validateAnalyticsQuery(req.query || {});
  const data = await analyticsService.getOverview(query);
  res.json({ data });
};

const getPageAnalytics = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const query = validateAnalyticsQuery(req.query || {});
  const data = await analyticsService.getPageAnalytics(query);
  res.json({ data });
};

const getExamAnalytics = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const query = validateAnalyticsQuery(req.query || {});
  const data = await analyticsService.getExamAnalytics(query);
  res.json({ data });
};

const getUserEngagement = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const query = validateAnalyticsQuery(req.query || {});
  const data = await analyticsService.getUserEngagement(query);
  res.json({ data });
};

const getRealTime = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const data = await analyticsService.getRealTimeAnalytics();
  res.json({ data });
};

const getSummary = async (req, res) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Admin access required');
  }
  const query = validateAnalyticsQuery(req.query || {});
  const data = await analyticsService.getAnalyticsSummary(query);
  res.json({ data });
};

module.exports = {
  startSession,
  heartbeat,
  endSession,
  getOverview,
  getPageAnalytics,
  getExamAnalytics,
  getUserEngagement,
  getRealTime,
  getSummary,
};
