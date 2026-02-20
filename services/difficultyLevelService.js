const DifficultyLevel = require('../models/difficultyLevel');

const getAllDifficultyLevels = async (userId) => {
  return DifficultyLevel.find({ owner: userId }).sort({ createdAt: -1 });
};

const getDifficultyLevel = async (id, userId) => {
  return DifficultyLevel.findOne({ _id: id, owner: userId });
};

const createDifficultyLevel = async (payload, userId) => {
  const difficultyLevel = new DifficultyLevel({
    level: payload.level,
    owner: userId,
  });
  return difficultyLevel.save();
};

const updateDifficultyLevel = async (id, updates, userId) => {
  return DifficultyLevel.findOneAndUpdate({ _id: id, owner: userId }, updates, {
    new: true,
    runValidators: true,
  });
};

const deleteDifficultyLevel = async (id, userId) => {
  return DifficultyLevel.findOneAndDelete({ _id: id, owner: userId });
};

module.exports = {
  getAllDifficultyLevels,
  getDifficultyLevel,
  createDifficultyLevel,
  updateDifficultyLevel,
  deleteDifficultyLevel,
};
