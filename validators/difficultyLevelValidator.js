const Joi = require('joi');
const ApiError = require('../errors/apiError');

const createDifficultyLevelSchema = Joi.object({
  level: Joi.string().trim().min(2).max(60).required(),
});

const updateDifficultyLevelSchema = Joi.object({
  level: Joi.string().trim().min(2).max(60),
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

const validateDifficultyLevelCreation = (payload) => validatePayload(createDifficultyLevelSchema, payload);
const validateDifficultyLevelUpdate = (payload) => validatePayload(updateDifficultyLevelSchema, payload);

module.exports = {
  validateDifficultyLevelCreation,
  validateDifficultyLevelUpdate,
};
