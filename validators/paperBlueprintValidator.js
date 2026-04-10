const Joi = require('joi');
const ApiError = require('../errors/apiError');

const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

const sectionSchema = Joi.object({
  key: Joi.string().trim().min(1).max(120).required(),
  label: Joi.string().trim().min(1).max(180).required(),
  count: Joi.number().integer().min(1).required(),
  topics: Joi.array().items(Joi.string().trim().max(100).allow('')).default([]).allow(null),
});

const upsertBlueprintSchema = Joi.object({
  examSlug: slugSchema.required(),
  examName: Joi.string().trim().max(200).allow('').optional(),
  stageSlug: slugSchema.required(),
  name: Joi.string().trim().max(200).allow('').optional(),
  learningMode: Joi.string().trim().valid('foundation', 'intermediate', 'advanced', 'expert').default('foundation'),
  durationMinutes: Joi.number().integer().min(1).default(60),
  examStageQuestions: Joi.number().integer().min(1).default(Joi.ref('totalQuestions')),
  totalQuestions: Joi.number().integer().min(1).required(),
  sections: Joi.array().items(sectionSchema).min(1).required(),
  difficultyMix: Joi.object({
    easy: Joi.number().min(0).max(1).required(),
    medium: Joi.number().min(0).max(1).required(),
    hard: Joi.number().min(0).max(1).required(),
  }).required(),
  isActive: Joi.boolean().optional(),
});

const getBlueprintQuerySchema = Joi.object({
  examSlug: slugSchema.optional().allow(''),
  stageSlug: slugSchema.optional().allow(''),
});

const validatePayload = (schema, payload) => {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      path: detail.path.join('.') || detail.context?.key,
      message: detail.message,
    }));
    throw new ApiError(400, 'Invalid request payload', details);
  }

  return value;
};

const validateBlueprintUpsert = (payload) => validatePayload(upsertBlueprintSchema, payload);
const validateBlueprintQuery = (payload) => validatePayload(getBlueprintQuerySchema, payload);

module.exports = {
  validateBlueprintUpsert,
  validateBlueprintQuery,
};
