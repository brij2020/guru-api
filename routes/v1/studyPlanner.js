const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const studyPlanSchedulerController = require('../../controllers/studyPlanSchedulerController');

module.exports = (app) => {
  const router = express.Router();

  router.get('/week-info', asyncHandler(studyPlanSchedulerController.getWeekInfo));

  router.get('/my-tests', authenticate, asyncHandler(studyPlanSchedulerController.getUserWeeklyTests));

  router.get('/my-tests/:testId', authenticate, asyncHandler(studyPlanSchedulerController.getWeeklyTestById));

  router.post('/generate', authenticate, asyncHandler(studyPlanSchedulerController.generateForUser));

  router.post('/assemble-weekly-test', authenticate, asyncHandler(studyPlanSchedulerController.assembleWeeklyTest));

  router.post('/trigger', authenticate, asyncHandler(studyPlanSchedulerController.triggerWeeklyTestGeneration));

  app.use('/api/v1/study-planner', router);
};
