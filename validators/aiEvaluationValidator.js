const Joi = require('joi');
const ApiError = require('../errors/apiError');

const answerValueSchema = Joi.alternatives().try(
  Joi.string().allow(''),
  Joi.array().items(Joi.string().allow(''))
);

const evaluateTestSchema = Joi.object({
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai').optional(),
  payload: Joi.object({
    testInfo: Joi.object({
      title: Joi.string().trim().max(200).allow('').default('Test'),
      domain: Joi.string().trim().max(120).allow('').default('General'),
      duration: Joi.number().integer().min(0).default(0),
    }).default({}),
    questions: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().trim().allow('').optional(),
          type: Joi.string().trim().max(40).required(),
          difficulty: Joi.string().trim().max(40).allow('').default('medium'),
          question: Joi.string().trim().required(),
          answer: Joi.string().allow('').optional(),
          explanation: Joi.string().allow('').optional(),
        })
      )
      .min(1)
      .required(),
    userAnswers: Joi.object()
      .pattern(
        Joi.string(),
        Joi.object({
          type: Joi.string().trim().max(20).allow('').optional(),
          value: answerValueSchema.required(),
        })
      )
      .default({}),
    questionStatus: Joi.object().pattern(Joi.string(), Joi.string().trim().max(40)).default({}),
    questionTimeSpent: Joi.object().pattern(Joi.string(), Joi.number().min(0)).default({}),
    timeSpent: Joi.number().min(0).default(0),
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

const validateEvaluateTestRequest = (payload) => validatePayload(evaluateTestSchema, payload);

module.exports = {
  validateEvaluateTestRequest,
};

