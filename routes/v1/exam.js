const express = require('express');
const examController = require('../../controllers/examController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(examController.listExams));
  router.get('/:slug', asyncHandler(examController.getExam));

  router.use(authenticate);

  router.post('/', asyncHandler(examController.createExam));
  router.put('/:slug', asyncHandler(examController.updateExam));
  router.delete('/:slug', asyncHandler(examController.deleteExam));

  app.use('/api/v1/exams', router);
};
