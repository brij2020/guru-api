const difficultyService = require('../services/difficultyService');

const listDifficulties = async (req, res) => {
  const difficulties = await difficultyService.getDifficultyLevels();
  res.json({ data: difficulties });
};

module.exports = {
  listDifficulties,
};
