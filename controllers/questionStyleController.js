const ApiError = require('../errors/apiError');
const questionStyleService = require('../services/questionStyleService');
const { logger } = require('../config/logger');
const {
  validateQuestionStyleCreation,
  validateQuestionStyleUpdate,
} = require('../validators/questionStyleValidator');

const listQuestionStyles = async (req, res) => {
  const questionStyles = await questionStyleService.getAllQuestionStyles(req.user.id, req.query.categoryId);
  res.json({ data: questionStyles });
};

const getQuestionStyle = async (req, res) => {
  const questionStyle = await questionStyleService.getQuestionStyle(req.params.id, req.user.id);
  if (!questionStyle) {
    throw new ApiError(404, 'Question style not found');
  }
  res.json({ data: questionStyle });
};

const createQuestionStyle = async (req, res) => {
  const payload = validateQuestionStyleCreation(req.body);
  if (payload.styles) {
    const questionStyles = await questionStyleService.createQuestionStylesByNames(payload, req.user.id);
    logger.info('Question styles created', { count: questionStyles.length });
    return res.status(201).json({ data: questionStyles });
  }

  const questionStyle = await questionStyleService.createQuestionStyle(payload, req.user.id);
  logger.info('Question style created', { questionStyleId: questionStyle._id });
  return res.status(201).json({ data: questionStyle });
};

const updateQuestionStyle = async (req, res) => {
  const payload = validateQuestionStyleUpdate(req.body);
  const questionStyle = await questionStyleService.updateQuestionStyle(req.params.id, payload, req.user.id);
  if (!questionStyle) {
    throw new ApiError(404, 'Question style not found');
  }
  logger.info('Question style updated', { questionStyleId: questionStyle._id });
  res.json({ data: questionStyle });
};

const deleteQuestionStyle = async (req, res) => {
  const questionStyle = await questionStyleService.deleteQuestionStyle(req.params.id, req.user.id);
  if (!questionStyle) {
    throw new ApiError(404, 'Question style not found');
  }
  logger.info('Question style deleted', { questionStyleId: questionStyle._id });
  res.json({ message: 'Question style deleted' });
};

module.exports = {
  listQuestionStyles,
  getQuestionStyle,
  createQuestionStyle,
  updateQuestionStyle,
  deleteQuestionStyle,
};
