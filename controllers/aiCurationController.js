const { logger } = require('../config/logger');
const aiCurationService = require('../services/aiCurationService');
const aiEvaluationService = require('../services/aiEvaluationService');
const { validateCurateQuestionsRequest } = require('../validators/aiCurationValidator');
const { validateEvaluateTestRequest } = require('../validators/aiEvaluationValidator');

const curateQuestions = async (req, res) => {
  const validated = validateCurateQuestionsRequest(req.body);
  const curated = await aiCurationService.curateQuestions({
    ...validated,
    userId: req.user?.id || null,
  });

  logger.info('Questions curated by AI provider', {
    userId: req.user.id,
    provider: validated.provider || 'default',
    count: Array.isArray(curated?.questions) ? curated.questions.length : 0,
  });

  res.status(200).json({
    data: curated,
  });
};

const evaluateTest = async (req, res) => {
  const validated = validateEvaluateTestRequest(req.body);
  const evaluation = await aiEvaluationService.evaluateTest(validated);

  logger.info('Test evaluated by AI provider', {
    userId: req.user.id,
    provider: validated.provider || 'default',
    totalQuestions: Number(evaluation?.summary?.totalQuestions || 0),
    score: Number(evaluation?.summary?.score || 0),
  });

  res.status(200).json({
    data: evaluation,
  });
};

module.exports = {
  curateQuestions,
  evaluateTest,
};
