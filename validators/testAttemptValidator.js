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

module.exports = {
  validateStartTestAttempt,
};
