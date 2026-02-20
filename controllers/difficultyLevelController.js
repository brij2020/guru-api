const ApiError = require('../errors/apiError');
const difficultyLevelService = require('../services/difficultyLevelService');
const { logger } = require('../config/logger');
const {
  validateDifficultyLevelCreation,
  validateDifficultyLevelUpdate,
} = require('../validators/difficultyLevelValidator');

const listDifficultyLevels = async (req, res) => {
  const difficulties = await difficultyLevelService.getAllDifficultyLevels(req.user.id);
  res.json({ data: difficulties });
};

const getDifficultyLevel = async (req, res) => {
  const difficulty = await difficultyLevelService.getDifficultyLevel(req.params.id, req.user.id);
  if (!difficulty) {
    throw new ApiError(404, 'Difficulty level not found');
  }
  res.json({ data: difficulty });
};

const createDifficultyLevel = async (req, res) => {
  const payload = validateDifficultyLevelCreation(req.body);
  const difficulty = await difficultyLevelService.createDifficultyLevel(payload, req.user.id);
  logger.info('Difficulty level created', { difficultyId: difficulty._id });
  res.status(201).json({ data: difficulty });
};

const updateDifficultyLevel = async (req, res) => {
  const payload = validateDifficultyLevelUpdate(req.body);
  const difficulty = await difficultyLevelService.updateDifficultyLevel(req.params.id, payload, req.user.id);
  if (!difficulty) {
    throw new ApiError(404, 'Difficulty level not found');
  }
  logger.info('Difficulty level updated', { difficultyId: difficulty._id });
  res.json({ data: difficulty });
};

const deleteDifficultyLevel = async (req, res) => {
  const difficulty = await difficultyLevelService.deleteDifficultyLevel(req.params.id, req.user.id);
  if (!difficulty) {
    throw new ApiError(404, 'Difficulty level not found');
  }
  logger.info('Difficulty level deleted', { difficultyId: difficulty._id });
  res.json({ message: 'Difficulty level deleted' });
};

module.exports = {
  listDifficultyLevels,
  getDifficultyLevel,
  createDifficultyLevel,
  updateDifficultyLevel,
  deleteDifficultyLevel,
};
