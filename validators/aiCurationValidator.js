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

module.exports = {
  validateCurateQuestionsRequest,
};
