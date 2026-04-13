const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const {
  getRecommendations,
  getAllRecommendations,
  getTopicPerformance,
  markCompleted,
  dismiss,
  refresh,
  syncAndGenerate,
  logAnswer
} = require('../../controllers/recommendationController');

router.get('/', authenticate, getRecommendations);
router.get('/all', authenticate, getAllRecommendations);
router.get('/topic-performance', authenticate, getTopicPerformance);
router.post('/refresh', authenticate, refresh);
router.post('/sync', authenticate, syncAndGenerate);
router.post('/answer', authenticate, logAnswer);
router.post('/:id/complete', authenticate, markCompleted);
router.post('/:id/dismiss', authenticate, dismiss);

module.exports = (app) => {
  app.use('/api/v1/recommendations', router);
};
