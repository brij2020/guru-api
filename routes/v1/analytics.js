const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const optionalAuthenticate = require('../../middleware/optionalAuthenticate');
const analyticsController = require('../../controllers/analyticsController');

module.exports = (app) => {
  const router = express.Router();

  router.post('/session/start', optionalAuthenticate, asyncHandler(analyticsController.startSession));
  router.post('/session/heartbeat', optionalAuthenticate, asyncHandler(analyticsController.heartbeat));
  router.post('/session/end', optionalAuthenticate, asyncHandler(analyticsController.endSession));

  router.get('/overview', authenticate, asyncHandler(analyticsController.getOverview));
  router.get('/pages', authenticate, asyncHandler(analyticsController.getPageAnalytics));
  router.get('/exams', authenticate, asyncHandler(analyticsController.getExamAnalytics));
  router.get('/engagement', authenticate, asyncHandler(analyticsController.getUserEngagement));
  router.get('/realtime', authenticate, asyncHandler(analyticsController.getRealTime));
  router.get('/summary', authenticate, asyncHandler(analyticsController.getSummary));

  router.post('/track', optionalAuthenticate, asyncHandler(async (req, res) => {
    const { event, path, pageTitle, pageType, lang, examSlug, timestamp } = req.body;
    console.log('[Analytics Track]', { event, path, pageTitle, pageType, lang, examSlug, timestamp });
    res.json({ success: true });
  }));

  app.use('/api/v1/analytics', router);
};
