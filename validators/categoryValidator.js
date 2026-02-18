const Joi = require('joi');
const ApiError = require('../errors/apiError');

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
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

const validateCategoryCreation = (payload) => validatePayload(createCategorySchema, payload);
const validateCategoryUpdate = (payload) => validatePayload(updateCategorySchema, payload);

module.exports = {
  validateCategoryCreation,
  validateCategoryUpdate,
};
