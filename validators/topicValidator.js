const Joi = require('joi');
const ApiError = require('../errors/apiError');

const objectId = Joi.string().trim().hex().length(24);

const createTopicSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  titles: Joi.array().items(Joi.string().trim().min(2).max(120)).min(1),
  description: Joi.string().trim().max(1000).allow('').optional(),
  categoryId: objectId.required(),
}).xor('name', 'titles');

const updateTopicSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(1000).allow(''),
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

const validateTopicCreation = (payload) => validatePayload(createTopicSchema, payload);
const validateTopicUpdate = (payload) => validatePayload(updateTopicSchema, payload);

module.exports = {
  validateTopicCreation,
  validateTopicUpdate,
};
