const Joi = require('joi');
const ApiError = require('../errors/apiError');

const pullSimilarQuestionsSchema = Joi.object({
  count: Joi.number().integer().min(1).max(100).optional(),
  questionCount: Joi.number().integer().min(1).max(100).optional(),
  difficulty: Joi.string().trim().max(40).optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
  questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
}).xor('count', 'questionCount');

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

const validatePullSimilarQuestions = (payload) => validatePayload(pullSimilarQuestionsSchema, payload);

module.exports = {
  validatePullSimilarQuestions,
};
