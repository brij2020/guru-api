const Joi = require('joi');
const ApiError = require('../errors/apiError');

const createQuestionCountSchema = Joi.object({
  count: Joi.number().integer().min(1).max(500).required(),
});

const updateQuestionCountSchema = Joi.object({
  count: Joi.number().integer().min(1).max(500),
}).min(1);

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

const validateQuestionCountCreation = (payload) => validatePayload(createQuestionCountSchema, payload);
const validateQuestionCountUpdate = (payload) => validatePayload(updateQuestionCountSchema, payload);

module.exports = {
  validateQuestionCountCreation,
  validateQuestionCountUpdate,
};
