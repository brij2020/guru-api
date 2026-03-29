const engagementService = require('../services/engagementAnalyticsService');

const trackEngagementEvent = async (req, res) => {
  try {
    const user = req.user || null;
    const { eventType, visitorId, sessionId, path, examSlug, categorySlug, categoryName, metadata, deviceType } = req.body;

    if (!visitorId || !eventType) {
      return res.status(400).json({ error: 'visitorId and eventType are required' });
    }

    const event = await engagementService.trackEvent(
      { eventType, visitorId, sessionId, path, examSlug, categorySlug, categoryName, metadata, deviceType },
      user
    );

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Track engagement event error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};

const getCategoryAnalytics = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const data = await engagementService.getCategoryPerformance({ days, limit });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Category analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch category analytics' });
  }
};

const getContentAnalytics = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const data = await engagementService.getContentPerformance({ days, limit });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Content analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch content analytics' });
  }
};

const getJourneyAnalytics = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const data = await engagementService.getUserJourneys({ days });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Journey analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch journey analytics' });
  }
};

const getFunnelAnalytics = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const data = await engagementService.getFunnelAnalytics({ days });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Funnel analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel analytics' });
  }
};

const getRealTimeEngagement = async (req, res) => {
  try {
    const data = await engagementService.getRealTimeEngagement();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Real-time engagement error:', error);
    res.status(500).json({ error: 'Failed to fetch real-time engagement' });
  }
};

const getAudienceInsights = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const data = await engagementService.getAudienceInsights({ days });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Audience insights error:', error);
    res.status(500).json({ error: 'Failed to fetch audience insights' });
  }
};

const getFullEngagementReport = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const [
      categories,
      content,
      journeys,
      funnels,
      audience,
    ] = await Promise.all([
      engagementService.getCategoryPerformance({ days }),
      engagementService.getContentPerformance({ days }),
      engagementService.getUserJourneys({ days }),
      engagementService.getFunnelAnalytics({ days }),
      engagementService.getAudienceInsights({ days }),
    ]);

    res.json({
      success: true,
      data: { categories, content, journeys, funnels, audience },
    });
  } catch (error) {
    console.error('Full engagement report error:', error);
    res.status(500).json({ error: 'Failed to fetch full engagement report' });
  }
};

module.exports = {
  trackEngagementEvent,
  getCategoryAnalytics,
  getContentAnalytics,
  getJourneyAnalytics,
  getFunnelAnalytics,
  getRealTimeEngagement,
  getAudienceInsights,
  getFullEngagementReport,
};
