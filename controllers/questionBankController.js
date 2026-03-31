const questionBankService = require('../services/questionBankService');
const questionPaperAssemblerService = require('../services/questionPaperAssemblerService');
const ApiError = require('../errors/apiError');
const {
  validatePullSimilarQuestions,
  validateAssemblePaper,
  validateImportQuestionBank,
  validateReviewListQuery,
  validateReviewStatusUpdate,
  validateReviewQuestionUpdate,
  validateAiReviewQuestion,
  validateCoverageQuery,
  validateBulkCreate,
} = require('../validators/questionBankValidator');

const pullSimilarQuestions = async (req, res) => {
  const filters = validatePullSimilarQuestions(req.body || {});
  const result = await questionBankService.pullSimilarQuestions({
    ownerId: req.user.id,
    filters,
  });

  res.json({
    data: result,
  });
};

const assemblePaper = async (req, res) => {
  const payload = validateAssemblePaper(req.body || {});
  const result = await questionPaperAssemblerService.assemblePaper({
    ownerId: req.user?.id || null,
    payload,
  });

  res.json({
    data: result,
  });
};

const assembleItPaper = async (req, res) => {
  const payload = validateAssemblePaper(req.body || {});
  const result = await questionPaperAssemblerService.assembleItPaper({
    ownerId: req.user.id,
    payload,
  });

  res.json({
    data: result,
  });
};

const importJson = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can import question bank JSON');
  }

  const payload = validateImportQuestionBank(req.body || {});
  const result = await questionBankService.importQuestionsFromJson({
    ownerId: req.user.id,
    payload,
  });

  res.json({
    data: result,
  });
};

const bulkCreateQuestions = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can create questions');
  }

  const payload = validateBulkCreate(req.body || {});
  const result = await questionBankService.importQuestionsFromJson({
    ownerId: req.user.id,
    payload,
  });

  res.json({
    data: {
      success: true,
      ...result,
    },
  });
};

const listForReview = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can review question bank items');
  }
  const filters = validateReviewListQuery(req.query || {});
const result = await questionBankService.listQuestionsForReview({
    ownerId: req.user.id,
    isAdmin: true,
    filters,
  });
  res.json({ data: result });
};

const updateReviewStatus = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can review question bank items');
  }
  const payload = validateReviewStatusUpdate(req.body || {});
  const result = await questionBankService.bulkUpdateReviewStatus({
    ownerId: req.user.id,
    reviewerId: req.user.id,
    isAdmin: true,
    ids: payload.ids,
    reviewStatus: payload.reviewStatus,
  });
  res.json({ data: result });
};

const updateReviewQuestion = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can edit question bank items');
  }

  const payload = validateReviewQuestionUpdate({
    ...(req.body || {}),
    id: req.params?.id,
  });

  try {
    const result = await questionBankService.updateQuestionForReview({
      ownerId: req.user.id,
      reviewerId: req.user.id,
      isAdmin: true,
      id: payload.id,
      updates: payload,
    });

    if (!result) {
      throw new ApiError(404, 'Question not found');
    }

    res.json({ data: result });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'Duplicate question detected after edit. Please adjust wording.');
    }
    throw error;
  }
};

const getCoverage = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can view question coverage');
  }

  const filters = validateCoverageQuery(req.query || {});
  const result = await questionBankService.getCoverageSnapshot({
    ownerId: req.user.id,
    filters,
  });
  res.json({ data: result });
};

const aiReviewQuestion = async (req, res) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can run AI review for question bank items');
  }

  const payload = validateAiReviewQuestion({
    ...(req.body || {}),
    id: req.params?.id,
  });

  const result = await questionBankService.aiReviewQuestion({
    ownerId: req.user.id,
    reviewerId: req.user.id,
    isAdmin: true,
    id: payload.id,
    provider: payload.provider,
    applyStatus: payload.applyStatus,
    applyEdits: payload.applyEdits,
  });

  if (!result) {
    throw new ApiError(404, 'Question not found');
  }

  res.json({ data: result });
};

const getTodaysQuestionsBySection = async (req, res) => {
  const sections = req.query.sections ? JSON.parse(req.query.sections) : [];
  const result = await questionBankService.getTodaysQuestionsBySection({ sections });
  res.json({ data: result });
};

module.exports = {
  pullSimilarQuestions,
  assemblePaper,
  assembleItPaper,
  importJson,
  bulkCreateQuestions,
  listForReview,
  updateReviewStatus,
  updateReviewQuestion,
  aiReviewQuestion,
  getCoverage,
  getTodaysQuestionsBySection,
};
