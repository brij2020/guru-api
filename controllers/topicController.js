const ApiError = require('../errors/apiError');
const topicService = require('../services/topicService');
const { logger } = require('../config/logger');
const { validateTopicCreation, validateTopicUpdate } = require('../validators/topicValidator');

const listTopics = async (req, res) => {
  const topics = await topicService.getAllTopics(req.user.id, req.query.categoryId);
  res.json({ data: topics });
};

const getTopic = async (req, res) => {
  const topic = await topicService.getTopic(req.params.id, req.user.id);
  if (!topic) {
    throw new ApiError(404, 'Topic not found');
  }
  res.json({ data: topic });
};

const createTopic = async (req, res) => {
  const payload = validateTopicCreation(req.body);
  if (payload.titles) {
    const topics = await topicService.createTopicsByTitles(payload, req.user.id);
    logger.info('Topics created', { count: topics.length });
    return res.status(201).json({ data: topics });
  }

  const topic = await topicService.createTopic(payload, req.user.id);
  logger.info('Topic created', { topicId: topic._id });
  return res.status(201).json({ data: topic });
};

const updateTopic = async (req, res) => {
  const payload = validateTopicUpdate(req.body);
  const topic = await topicService.updateTopic(req.params.id, payload, req.user.id);
  if (!topic) {
    throw new ApiError(404, 'Topic not found');
  }
  logger.info('Topic updated', { topicId: topic._id });
  res.json({ data: topic });
};

const deleteTopic = async (req, res) => {
  const topic = await topicService.deleteTopic(req.params.id, req.user.id);
  if (!topic) {
    throw new ApiError(404, 'Topic not found');
  }
  logger.info('Topic deleted', { topicId: topic._id });
  res.json({ message: 'Topic deleted' });
};

module.exports = {
  listTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
};
