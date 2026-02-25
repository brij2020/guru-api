const express = require('express');
const examHierarchyController = require('../../controllers/examHierarchyController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(examHierarchyController.getExamHierarchy));
  router.use(authenticate);
  router.put('/', asyncHandler(examHierarchyController.upsertExamHierarchy));

  app.use('/api/v1/exam-hierarchy', router);
};
