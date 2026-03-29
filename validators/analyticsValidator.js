const Joi = require('joi');
const ApiError = require('../errors/apiError');

const baseSessionSchema = Joi.object({
  sessionId: Joi.string().trim().max(120).required(),
  visitorId: Joi.string().trim().max(120).required(),
  path: Joi.string().trim().max(300).required(),
  pageTitle: Joi.string().trim().allow('').max(200).default(''),
  pageType: Joi.string().trim().allow('').max(80).default('page'),
  lang: Joi.string().trim().allow('').max(10).default('en'),
  examSlug: Joi.string().trim().allow('').max(120).default(''),
  categoryKey: Joi.string().trim().allow('').max(120).default(''),
  testId: Joi.string().trim().allow('').max(120).default(''),
  referrer: Joi.string().trim().allow('').max(500).default(''),
  userAgent: Joi.string().trim().allow('').max(500).default(''),
  deviceType: Joi.string().trim().valid('desktop', 'mobile', 'tablet', 'unknown').default('unknown'),
});

const sessionStartSchema = baseSessionSchema;

const sessionUpdateSchema = Joi.object({
  sessionId: Joi.string().trim().max(120).required(),
  activeTimeMsDelta: Joi.number().integer().min(0).max(60 * 60 * 1000).default(0),
  clickCountDelta: Joi.number().integer().min(0).max(5000).default(0),
  interactionCountDelta: Joi.number().integer().min(0).max(5000).default(0),
  maxScrollPercent: Joi.number().min(0).max(100).default(0),
  pageTitle: Joi.string().trim().allow('').max(200).optional(),
  pageType: Joi.string().trim().allow('').max(80).optional(),
  examSlug: Joi.string().trim().allow('').max(120).optional(),
  categoryKey: Joi.string().trim().allow('').max(120).optional(),
  testId: Joi.string().trim().allow('').max(120).optional(),
  path: Joi.string().trim().max(300).optional(),
});

const analyticsSummarySchema = Joi.object({
  days: Joi.number().integer().min(1).max(90).default(7),
  path: Joi.string().trim().max(300).optional(),
});

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

module.exports = {
  validateAnalyticsSessionStart: (payload) => validatePayload(sessionStartSchema, payload),
  validateAnalyticsSessionUpdate: (payload) => validatePayload(sessionUpdateSchema, payload),
  validateAnalyticsQuery: (payload) => validatePayload(analyticsSummarySchema, payload),
  validateAnalyticsSummaryQuery: (payload) => validatePayload(analyticsSummarySchema, payload),
};
