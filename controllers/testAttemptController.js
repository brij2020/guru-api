const Joi = require('joi');
const { logger } = require('../config/logger');
const testAttemptService = require('../services/testAttemptService');
const { validateStartTestAttempt } = require('../validators/testAttemptValidator');

const completeTestAttemptSchema = Joi.object({
  attemptId: Joi.string().required(),
  autoSubmitted: Joi.boolean().default(false),
  score: Joi.number().min(0).required(),
  percentage: Joi.number().min(0).max(100).required(),
  correctCount: Joi.number().min(0).required(),
  incorrectCount: Joi.number().min(0).required(),
  unattemptedCount: Joi.number().min(0).required(),
  attemptedCount: Joi.number().min(0).required(),
  timeSpent: Joi.number().min(0).required(),
  sectionScores: Joi.array().items(
    Joi.object({
      section: Joi.string().allow(''),
      correct: Joi.number().min(0),
      total: Joi.number().min(0),
      percentage: Joi.number().min(0).max(100),
    })
  ).default([]),
  difficultyBreakdown: Joi.array().items(
    Joi.object({
      difficulty: Joi.string().allow(''),
      correct: Joi.number().min(0),
      total: Joi.number().min(0),
      percentage: Joi.number().min(0).max(100),
    })
  ).default([]),
  typeBreakdown: Joi.array().items(
    Joi.object({
      type: Joi.string().allow(''),
      correct: Joi.number().min(0),
      total: Joi.number().min(0),
      percentage: Joi.number().min(0).max(100),
    })
  ).default([]),
});

const validateCompleteTestAttempt = (payload) => {
  const { error, value } = completeTestAttemptSchema.validate(payload, { abortEarly: false });
  if (error) {
    const message = error.details.map(d => d.message).join(', ');
    throw new Error(message);
  }
  return value;
};

const startTestAttempt = async (req, res) => {
  console.log('[Controller] startTestAttempt called');
  console.log('[Controller] req.body:', JSON.stringify(req.body, null, 2));
  console.log('[Controller] req.user.id:', req.user.id);
  
  const payload = validateStartTestAttempt(req.body);
  console.log('[Controller] Validated payload:', JSON.stringify(payload, null, 2));
  
  const attempt = await testAttemptService.startTestAttempt(payload, req.user.id);
  console.log('[Controller] Test attempt started, _id:', attempt._id);
  
  logger.info('Test attempt started', { attemptId: attempt._id, userId: req.user.id });
  res.status(201).json({ data: attempt });
};

const completeTestAttempt = async (req, res) => {
  console.log('[Controller] completeTestAttempt called with:', JSON.stringify(req.body, null, 2));
  const payload = validateCompleteTestAttempt(req.body);
  console.log('[Controller] Validated payload:', JSON.stringify(payload, null, 2));
  const attempt = await testAttemptService.completeTestAttempt(payload.attemptId, req.user.id, payload);
  console.log('[Controller] Test attempt completed:', JSON.stringify(attempt, null, 2));
  logger.info('Test attempt completed', { attemptId: payload.attemptId, userId: req.user.id, score: payload.score });
  res.status(200).json({ data: attempt });
};

const getTestAttempts = async (req, res) => {
  console.log('[Controller] getTestAttempts called for user:', req.user.id);
  const attempts = await testAttemptService.getTestAttemptsByUser(req.user.id);
  res.status(200).json({ data: attempts });
};

module.exports = {
  startTestAttempt,
  completeTestAttempt,
  getTestAttempts,
};
