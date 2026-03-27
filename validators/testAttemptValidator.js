const Joi = require('joi');
const ApiError = require('../errors/apiError');

const startTestAttemptSchema = Joi.object({
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai').optional(),
  allowFallback: Joi.boolean().optional(),
  attemptMode: Joi.string().trim().valid('practice', 'exam').default('exam'),
  testId: Joi.string().trim().allow('').max(120),
  testTitle: Joi.string().trim().max(200).required(),
  domain: Joi.string().trim().allow('').max(120),
  difficulty: Joi.string().trim().max(60).default('all'),
  topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
  questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
  promptContext: Joi.string().trim().allow('').max(4000).optional(),
  questionCount: Joi.alternatives().try(
    Joi.string().trim().max(20),
    Joi.number().integer().min(1).max(1000)
  ),
  totalQuestions: Joi.number().integer().min(0).default(0),
  duration: Joi.number().integer().min(0).default(0),
  questions: Joi.array().items(Joi.object().unknown(true)).default([]),
  sectionPlan: Joi.array()
    .items(
      Joi.object({
        section: Joi.string().trim().allow('').default(''),
        targetCount: Joi.number().integer().min(0).default(0),
        servedCount: Joi.number().integer().min(0).default(0),
      }).unknown(true)
    )
    .default([]),
});

const completeTestAttemptSchema = Joi.object({
  attemptId: Joi.string().trim().required(),
  autoSubmitted: Joi.boolean().default(false),
  score: Joi.number().min(0).default(0),
  percentage: Joi.number().min(0).default(0),
  correctCount: Joi.number().integer().min(0).default(0),
  incorrectCount: Joi.number().integer().min(0).default(0),
  unattemptedCount: Joi.number().integer().min(0).default(0),
  attemptedCount: Joi.number().integer().min(0).default(0),
  timeSpent: Joi.number().min(0).default(0),
  sectionScores: Joi.array().items(Joi.object().unknown(true)).default([]),
  difficultyBreakdown: Joi.array().items(Joi.object().unknown(true)).default([]),
  typeBreakdown: Joi.array().items(Joi.object().unknown(true)).default([]),
  userAnswers: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  questionTimeSpent: Joi.object().pattern(Joi.string(), Joi.number()).default({}),
  questionStatus: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  aiEvaluation: Joi.any().allow(null).default(null),
  questions: Joi.array().items(Joi.object().unknown(true)).default([]),
  sectionPlan: Joi.array()
    .items(
      Joi.object({
        section: Joi.string().trim().allow('').default(''),
        targetCount: Joi.number().integer().min(0).default(0),
        servedCount: Joi.number().integer().min(0).default(0),
      }).unknown(true)
    )
    .default([]),
});

const validatePayload = (schema, payload) => {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      path: detail.path.join('.') || detail.context.key,
      message: detail.message,
    }));
    throw new ApiError(400, 'Invalid request payload', details);
  }

  return value;
};

const validateStartTestAttempt = (payload) => validatePayload(startTestAttemptSchema, payload);
const validateCompleteTestAttempt = (payload) => validatePayload(completeTestAttemptSchema, payload);

module.exports = {
  validateStartTestAttempt,
  validateCompleteTestAttempt,
};
