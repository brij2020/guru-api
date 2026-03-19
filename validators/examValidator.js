const Joi = require('joi');

const negativeMarkingSchema = Joi.object({
  enabled: Joi.boolean().optional(),
  perWrongAnswer: Joi.number().min(0).max(1).optional(),
});

const stageSchema = Joi.object({
  slug: Joi.string().required().trim().lowercase(),
  name: Joi.string().required().trim(),
  durationMinutes: Joi.number().min(0).default(60),
  questionCount: Joi.number().min(0).default(100),
  totalMarks: Joi.number().min(0).default(100),
  description: Joi.string().allow('').trim().optional(),
  negativeMarking: negativeMarkingSchema.optional(),
});

const examSchema = Joi.object({
  slug: Joi.string().required().trim().lowercase().pattern(/^[a-z0-9-]+$/),
  name: Joi.string().required().trim().min(1).max(100),
  description: Joi.string().allow('').trim().optional(),
  stages: Joi.array().items(stageSchema).optional(),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().min(0).optional(),
  negativeMarking: negativeMarkingSchema.optional(),
});

const validateCreateExam = (data) => {
  return examSchema.validate(data, { abortEarly: false });
};

const validateUpdateExam = (data) => {
  const updateSchema = examSchema.fork(['slug'], (schema) => schema.optional());
  return updateSchema.validate(data, { abortEarly: false });
};

module.exports = {
  validateCreateExam,
  validateUpdateExam,
};
