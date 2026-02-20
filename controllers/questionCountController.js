const ApiError = require('../errors/apiError');
const questionCountService = require('../services/questionCountService');
const { logger } = require('../config/logger');
const {
  validateQuestionCountCreation,
  validateQuestionCountUpdate,
} = require('../validators/questionCountValidator');

const listQuestionCounts = async (req, res) => {
  const questionCounts = await questionCountService.getAllQuestionCounts(req.user.id);
  res.json({ data: questionCounts });
};

const getQuestionCount = async (req, res) => {
  const questionCount = await questionCountService.getQuestionCount(req.params.id, req.user.id);
  if (!questionCount) {
    throw new ApiError(404, 'Question count not found');
  }
  res.json({ data: questionCount });
};

const createQuestionCount = async (req, res) => {
  const payload = validateQuestionCountCreation(req.body);
  const questionCount = await questionCountService.createQuestionCount(payload, req.user.id);
  logger.info('Question count created', { questionCountId: questionCount._id });
  res.status(201).json({ data: questionCount });
};

const updateQuestionCount = async (req, res) => {
  const payload = validateQuestionCountUpdate(req.body);
  const questionCount = await questionCountService.updateQuestionCount(req.params.id, payload, req.user.id);
  if (!questionCount) {
    throw new ApiError(404, 'Question count not found');
  }
  logger.info('Question count updated', { questionCountId: questionCount._id });
  res.json({ data: questionCount });
};

const deleteQuestionCount = async (req, res) => {
  const questionCount = await questionCountService.deleteQuestionCount(req.params.id, req.user.id);
  if (!questionCount) {
    throw new ApiError(404, 'Question count not found');
  }
  logger.info('Question count deleted', { questionCountId: questionCount._id });
  res.json({ message: 'Question count deleted' });
};

module.exports = {
  listQuestionCounts,
  getQuestionCount,
  createQuestionCount,
  updateQuestionCount,
  deleteQuestionCount,
};
