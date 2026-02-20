const Joi = require('joi');
const ApiError = require('../errors/apiError');

const objectId = Joi.string().trim().hex().length(24);

const createQuestionStyleSchema = Joi.object({
  style: Joi.string().trim().min(2).max(120),
  styles: Joi.array().items(Joi.string().trim().min(2).max(120)).min(1),
  categoryId: objectId.required(),
}).xor('style', 'styles');

const updateQuestionStyleSchema = Joi.object({
  style: Joi.string().trim().min(2).max(120),
  categoryId: objectId,
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

const validateQuestionStyleCreation = (payload) => validatePayload(createQuestionStyleSchema, payload);
const validateQuestionStyleUpdate = (payload) => validatePayload(updateQuestionStyleSchema, payload);

module.exports = {
  validateQuestionStyleCreation,
  validateQuestionStyleUpdate,
};
