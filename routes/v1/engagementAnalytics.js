const express = require('express');
const router = express.Router();
const engagementController = require('../../controllers/engagementAnalyticsController');
const optionalAuthenticate = require('../../middleware/optionalAuthenticate');

router.post('/track', optionalAuthenticate, engagementController.trackEngagementEvent);
router.get('/categories', engagementController.getCategoryAnalytics);
router.get('/content', engagementController.getContentAnalytics);
router.get('/journeys', engagementController.getJourneyAnalytics);
router.get('/funnels', engagementController.getFunnelAnalytics);
router.get('/realtime', engagementController.getRealTimeEngagement);
router.get('/audience', engagementController.getAudienceInsights);
router.get('/report', engagementController.getFullEngagementReport);

module.exports = (app) => {
  app.use('/api/v1/engagement', router);
};
