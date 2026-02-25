const Joi = require('joi');
const ApiError = require('../errors/apiError');

const hierarchyItemSchema = Joi.object({
  id: Joi.alternatives(Joi.string().trim().min(1), Joi.number()).required(),
  title: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(180)
    .optional(),
  children: Joi.array().items(Joi.link('#hierarchyItem')).default([]),
}).id('hierarchyItem');

const upsertExamHierarchySchema = Joi.object({
  name: Joi.string().trim().max(120).optional(),
  tree: Joi.array().items(hierarchyItemSchema).required(),
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

const validateExamHierarchyUpsert = (payload) =>
  validatePayload(upsertExamHierarchySchema, payload);

module.exports = {
  validateExamHierarchyUpsert,
};
