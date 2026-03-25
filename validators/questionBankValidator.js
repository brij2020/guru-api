const Joi = require('joi');
const ApiError = require('../errors/apiError');

const pullSimilarQuestionsSchema = Joi.object({
  count: Joi.number().integer().min(1).max(100).optional(),
  questionCount: Joi.number().integer().min(1).max(100).optional(),
  difficulty: Joi.string().trim().max(40).optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
  questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
}).xor('count', 'questionCount');

const assemblePaperSchema = Joi.object({
  examSlug: Joi.string().trim().max(80).required(),
  stageSlug: Joi.string().trim().max(80).required(),
  goalSlug: Joi.string().trim().max(80).optional(),
  planId: Joi.string().trim().max(120).optional(),
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai', 'local').optional(),
  testId: Joi.string().trim().max(160).allow('').optional(),
  testTitle: Joi.string().trim().max(220).allow('').optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  difficulty: Joi.string().trim().max(40).optional(),
  topics: Joi.array().items(Joi.string().trim().max(120)).default([]),
  questionStyles: Joi.array().items(Joi.string().trim().max(120)).default([]),
  questionCount: Joi.number().integer().min(1).max(300).optional(),
  promptContext: Joi.string().trim().max(4000).allow('').optional(),
  assemblyMode: Joi.string().trim().valid('flex', 'strict').optional(),
  recentExclusionCount: Joi.number().integer().min(0).max(1000).optional(),
});

const importQuestionItemSchema = Joi.object({
  examSlug: Joi.string().trim().max(80).allow('').optional(),
  stageSlug: Joi.string().trim().max(80).allow('').optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  language: Joi.string().trim().max(16).allow('').optional(),
  section: Joi.string().trim().max(120).allow('').optional(),
  groupType: Joi.string().trim().valid('none', 'rc_passage').optional(),
  groupId: Joi.string().trim().max(120).allow('').optional(),
  groupTitle: Joi.string().trim().max(300).allow('').optional(),
  passageText: Joi.string().trim().max(12000).allow('').optional(),
  groupOrder: Joi.number().integer().min(1).max(200).allow(null).optional(),
  questionNumber: Joi.number().integer().min(1).max(2000).optional(),
  hasVisual: Joi.boolean().optional(),
  assets: Joi.array()
    .items(
      Joi.object({
        kind: Joi.string().trim().valid('image', 'chart_image', 'diagram_image', 'table_image', 'chart_data').optional(),
        url: Joi.string().trim().allow('').max(1200).optional(),
        alt: Joi.string().trim().allow('').max(500).optional(),
        width: Joi.number().integer().min(1).allow(null).optional(),
        height: Joi.number().integer().min(1).allow(null).optional(),
        caption: Joi.string().trim().allow('').max(800).optional(),
        sourcePage: Joi.number().integer().min(1).allow(null).optional(),
        data: Joi.object().unknown(true).allow(null).optional(),
      }).unknown(false)
    )
    .max(8)
    .optional(),
  source: Joi.object({
    exam: Joi.string().trim().max(120).allow('').optional(),
    year: Joi.number().integer().min(1900).max(2100).allow(null).optional(),
    shift: Joi.number().integer().min(0).max(20).allow(null).optional(),
    type: Joi.string().trim().max(60).allow('').optional(),
  })
    .optional()
    .default({}),
  topic: Joi.string().trim().max(160).allow('').optional(),
  difficulty: Joi.string().trim().max(40).allow('').optional(),
  type: Joi.string().trim().max(60).allow('').optional(),
  question: Joi.string().trim().max(6000).required(),
  options: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().trim().max(5000),
        Joi.object({
          id: Joi.string().trim().max(8).allow('').optional(),
          text: Joi.string().trim().max(5000).required(),
        })
      )
    )
    .default([]),
  answer: Joi.string().trim().allow('').max(2000).optional(),
  answerKey: Joi.string().trim().allow('').max(8).optional(),
  correctAnswer: Joi.string().trim().allow('').max(2000).optional(),
  correct_option: Joi.string().trim().allow('').max(2000).optional(),
  explanation: Joi.string().trim().allow('').max(6000).optional(),
  promptContext: Joi.string().trim().allow('').max(4000).optional(),
  testId: Joi.string().trim().allow('').max(160).optional(),
  testTitle: Joi.string().trim().allow('').max(220).optional(),
  reviewStatus: Joi.string().trim().valid('draft', 'reviewed', 'approved', 'rejected').optional(),
});

const importQuestionBankSchema = Joi.object({
  examSlug: Joi.string().trim().max(80).allow('').optional(),
  stageSlug: Joi.string().trim().max(80).allow('').optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  language: Joi.string().trim().max(16).allow('').optional(),
  provider: Joi.string().trim().max(32).default('openai-import'),
  testId: Joi.string().trim().allow('').max(160).optional(),
  testTitle: Joi.string().trim().allow('').max(220).optional(),
  reviewStatus: Joi.string().trim().valid('draft', 'reviewed', 'approved', 'rejected').optional(),
  promptContext: Joi.string().trim().allow('').max(4000).optional(),
  questions: Joi.array().items(importQuestionItemSchema).min(1).max(5000).required(),
});

const bulkCreateSchema = Joi.object({
  examSlug: Joi.string().trim().max(80).allow('').optional(),
  stageSlug: Joi.string().trim().max(80).allow('').optional(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  language: Joi.string().trim().max(16).allow('').optional(),
  provider: Joi.string().trim().max(32).default('manual-publisher'),
  testId: Joi.string().trim().allow('').max(160).optional(),
  testTitle: Joi.string().trim().allow('').max(220).optional(),
  reviewStatus: Joi.string().trim().valid('draft', 'reviewed', 'approved', 'rejected').optional(),
  promptContext: Joi.string().trim().allow('').max(4000).optional(),
  questions: Joi.array().items(importQuestionItemSchema).min(1).max(500).required(),
});

const reviewListQuerySchema = Joi.object({
  scope: Joi.string().trim().valid('owner', 'global').default('global'),
  reviewStatus: Joi.string().trim().valid('draft', 'reviewed', 'approved', 'rejected').optional(),
  examSlug: Joi.string().trim().max(80).allow('').optional(),
  stageSlug: Joi.string().trim().max(80).allow('').optional(),
  section: Joi.string().trim().max(120).allow('').optional(),
  search: Joi.string().trim().max(120).allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

const reviewStatusUpdateSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(1000)
    .required(),
  reviewStatus: Joi.string().trim().valid('draft', 'reviewed', 'approved', 'rejected').required(),
});

const reviewQuestionUpdateSchema = Joi.object({
  id: Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).required(),
  question: Joi.string().trim().max(6000).optional(),
  options: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().trim().max(5000),
        Joi.object({
          id: Joi.string().trim().max(8).allow('').optional(),
          text: Joi.string().trim().max(5000).required(),
        })
      )
    )
    .max(5)
    .optional(),
  answer: Joi.string().trim().allow('').max(2000).optional(),
  answerKey: Joi.string().trim().allow('').max(8).optional(),
  explanation: Joi.string().trim().allow('').max(6000).optional(),
  topic: Joi.string().trim().allow('').max(160).optional(),
  section: Joi.string().trim().allow('').max(120).optional(),
  groupType: Joi.string().trim().valid('none', 'rc_passage').optional(),
  groupId: Joi.string().trim().allow('').max(120).optional(),
  groupTitle: Joi.string().trim().allow('').max(300).optional(),
  passageText: Joi.string().trim().allow('').max(12000).optional(),
  groupOrder: Joi.number().integer().min(1).max(200).allow(null).optional(),
  applyRcToGroup: Joi.boolean().optional(),
  difficulty: Joi.string().trim().valid('easy', 'medium', 'hard').optional(),
  questionNumber: Joi.number().integer().min(1).max(2000).allow(null).optional(),
  hasVisual: Joi.boolean().optional(),
  assets: Joi.array()
    .items(
      Joi.object({
        kind: Joi.string().trim().valid('image', 'chart_image', 'diagram_image', 'table_image', 'chart_data').optional(),
        url: Joi.string().trim().allow('').max(1200).optional(),
        alt: Joi.string().trim().allow('').max(500).optional(),
        width: Joi.number().integer().min(1).allow(null).optional(),
        height: Joi.number().integer().min(1).allow(null).optional(),
        caption: Joi.string().trim().allow('').max(800).optional(),
        sourcePage: Joi.number().integer().min(1).allow(null).optional(),
        data: Joi.object().unknown(true).allow(null).optional(),
      }).unknown(false)
    )
    .max(8)
    .optional(),
})
  .or(
    'question',
    'options',
    'answer',
    'answerKey',
    'explanation',
    'topic',
    'section',
    'groupType',
    'groupId',
    'groupTitle',
    'passageText',
    'groupOrder',
    'difficulty',
    'questionNumber',
    'hasVisual',
    'assets'
  );

const aiReviewQuestionSchema = Joi.object({
  id: Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).required(),
  provider: Joi.string().trim().valid('gemini', 'chatgpt', 'openai', 'local').optional(),
  applyStatus: Joi.boolean().default(false),
  applyEdits: Joi.boolean().default(false),
});

const coverageQuerySchema = Joi.object({
  examSlug: Joi.string().trim().max(80).required(),
  stageSlug: Joi.string().trim().max(80).required(),
});

const createPdfJobSchema = Joi.object({
  examSlug: Joi.string().trim().max(80).required(),
  stageSlug: Joi.string().trim().max(80).required(),
  domain: Joi.string().trim().max(120).allow('').optional(),
  provider: Joi.string().trim().max(60).default('pyq-extractor'),
  testIdPrefix: Joi.string().trim().max(160).allow('').optional(),
  testTitlePrefix: Joi.string().trim().max(220).allow('').optional(),
  promptContext: Joi.string().trim().max(4000).allow('').optional(),
  paperFolder: Joi.string().trim().max(500).required(),
  outputFolder: Joi.string().trim().max(500).required(),
  chunkSize: Joi.number().integer().min(100).max(5000).default(1000),
});

const listPdfJobsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
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

const ensureRcIntegrity = (item, basePath = '') => {
  const groupType = String(item?.groupType || '').trim().toLowerCase();
  if (groupType !== 'rc_passage') return;
  const groupId = String(item?.groupId || '').trim();
  const passageText = String(item?.passageText || '').trim();
  const details = [];
  if (!groupId) {
    details.push({
      path: `${basePath}groupId`,
      message: '"groupId" is required when groupType is "rc_passage"',
    });
  }
  if (!passageText) {
    details.push({
      path: `${basePath}passageText`,
      message: '"passageText" is required when groupType is "rc_passage"',
    });
  }
  if (details.length > 0) {
    throw new ApiError(400, 'Invalid request payload', details);
  }
};

const validatePullSimilarQuestions = (payload) => validatePayload(pullSimilarQuestionsSchema, payload);
const validateAssemblePaper = (payload) => validatePayload(assemblePaperSchema, payload);
const validateImportQuestionBank = (payload) => {
  const value = validatePayload(importQuestionBankSchema, payload);
  const questions = Array.isArray(value?.questions) ? value.questions : [];
  questions.forEach((question, index) => ensureRcIntegrity(question, `questions.${index}.`));
  return value;
};
const validateReviewListQuery = (payload) => validatePayload(reviewListQuerySchema, payload);
const validateReviewStatusUpdate = (payload) => validatePayload(reviewStatusUpdateSchema, payload);
const validateReviewQuestionUpdate = (payload) => {
  const value = validatePayload(reviewQuestionUpdateSchema, payload);
  ensureRcIntegrity(value, '');
  return value;
};
const validateCoverageQuery = (payload) => validatePayload(coverageQuerySchema, payload);
const validateAiReviewQuestion = (payload) => validatePayload(aiReviewQuestionSchema, payload);
const validateCreatePdfJob = (payload) => validatePayload(createPdfJobSchema, payload);
const validateListPdfJobsQuery = (payload) => validatePayload(listPdfJobsQuerySchema, payload);
const validateBulkCreate = (payload) => validatePayload(bulkCreateSchema, payload);

module.exports = {
  validatePullSimilarQuestions,
  validateAssemblePaper,
  validateImportQuestionBank,
  validateBulkCreate,
  validateReviewListQuery,
  validateReviewStatusUpdate,
  validateReviewQuestionUpdate,
  validateAiReviewQuestion,
  validateCoverageQuery,
  validateCreatePdfJob,
  validateListPdfJobsQuery,
};
