const Joi = require('joi');
const ApiError = require('../errors/apiError');

const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  description: Joi.string().trim().max(1000).allow(''),
  status: Joi.string().valid('pending', 'in_progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  dueDate: Joi.date().iso().allow(null),
});

const updateTaskSchema = createTaskSchema.fork(
  ['title', 'description', 'status', 'priority', 'dueDate'],
  (schema) => schema.optional()
);

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

const validateTaskCreation = (payload) => validatePayload(createTaskSchema, payload);
const validateTaskUpdate = (payload) => validatePayload(updateTaskSchema, payload);

module.exports = {
  validateTaskCreation,
  validateTaskUpdate,
};
