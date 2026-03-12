const Joi = require('joi');
const ApiError = require('../errors/apiError');

const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/);

const createJobSchema = Joi.object({
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai').default('gemini'),
  payload: Joi.object({
    testId: Joi.string().trim().allow('').max(120).optional(),
    testTitle: Joi.string().trim().max(200).required(),
    domain: Joi.string().trim().allow('').max(160).optional(),
    attemptMode: Joi.string().trim().valid('practice', 'exam').default('exam'),
    difficulty: Joi.string().trim().max(60).default('medium'),
    topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
    questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
    examSlug: Joi.string().trim().allow('').max(120).optional(),
    stageSlug: Joi.string().trim().allow('').max(120).optional(),
    promptContext: Joi.string().trim().allow('').max(4000).optional(),
  }).required(),
  totalQuestions: Joi.number().integer().min(1).max(20000).required(),
  batchSize: Joi.number().integer().min(5).max(100).default(50),
  maxRetries: Joi.number().integer().min(0).max(10).default(2),
});

const listJobsQuerySchema = Joi.object({
  status: Joi.string().trim().valid('queued', 'running', 'completed', 'failed', 'cancelled').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const jobIdParamSchema = Joi.object({
  jobId: objectIdSchema.required(),
});

const processJobSchema = Joi.object({
  jobId: objectIdSchema.optional(),
});

const workerRunSchema = Joi.object({
  ownerId: objectIdSchema.required(),
  jobId: objectIdSchema.optional(),
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

const validateCreateJobPayload = (payload) => validatePayload(createJobSchema, payload);
const validateListJobsQuery = (payload) => validatePayload(listJobsQuerySchema, payload);
const validateJobIdParam = (payload) => validatePayload(jobIdParamSchema, payload);
const validateProcessJobPayload = (payload) => validatePayload(processJobSchema, payload);
const validateWorkerRunPayload = (payload) => validatePayload(workerRunSchema, payload);

module.exports = {
  validateCreateJobPayload,
  validateListJobsQuery,
  validateJobIdParam,
  validateProcessJobPayload,
  validateWorkerRunPayload,
};
