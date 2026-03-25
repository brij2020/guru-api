const Joi = require('joi');
const ApiError = require('../errors/apiError');

const curateQuestionsSchema = Joi.object({
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai').optional(),
  payload: Joi.object({
    testId: Joi.string().trim().allow('').max(120).optional(),
    testTitle: Joi.string().trim().max(200).required(),
    domain: Joi.string().trim().allow('').max(120).optional(),
    attemptMode: Joi.string().trim().valid('practice', 'exam').default('exam'),
    difficulty: Joi.string().trim().max(60).default('all'),
    topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
    questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
    questionCount: Joi.alternatives()
      .try(Joi.string().trim().max(20), Joi.number().integer().min(1).max(1000))
      .default('all'),
  }).required(),
}).required();

const curateGovQuestionsSchema = Joi.object({
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai').optional(),
  payload: Joi.object({
    examSlug: Joi.string().trim().max(120).required(),
    examName: Joi.string().trim().max(160).required(),
    stageSlug: Joi.string().trim().max(120).required(),
    stageName: Joi.string().trim().max(160).required(),
    goalSlug: Joi.string().trim().max(120).required(),
    goalName: Joi.string().trim().max(160).required(),
    planId: Joi.string().trim().max(120).required(),
    planName: Joi.string().trim().max(160).required(),
    struggleFocus: Joi.string().trim().allow('').max(160).optional(),
    alignmentTarget: Joi.number().integer().min(70).max(90).default(85),
    currentAffairsMonths: Joi.number().integer().valid(3, 6, 12).default(6),
    language: Joi.string().trim().valid('English', 'Hindi').default('English'),
    questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
    questionCount: Joi.number().integer().min(5).max(100).default(25),
    difficulty: Joi.string().trim().max(60).default('medium'),
  }).required(),
}).required();

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

const validateCurateQuestionsRequest = (payload) => validatePayload(curateQuestionsSchema, payload);
const validateCurateGovQuestionsRequest = (payload) => validatePayload(curateGovQuestionsSchema, payload);

module.exports = {
  validateCurateQuestionsRequest,
  validateCurateGovQuestionsRequest,
};
