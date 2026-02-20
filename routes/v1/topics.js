const express = require('express');
const topicController = require('../../controllers/topicController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(topicController.listTopics));
  router.get('/:id', asyncHandler(topicController.getTopic));
  router.post('/', asyncHandler(topicController.createTopic));
  router.put('/:id', asyncHandler(topicController.updateTopic));
  router.delete('/:id', asyncHandler(topicController.deleteTopic));

  app.use('/api/v1/topics', router);
};
