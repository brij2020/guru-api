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
  const payload = validateImportQuestionBank(req.body || {});
  const result = await questionBankService.importQuestionsFromJson({
    ownerId: req.user.id,
    payload,
  });

  res.json({
    data: result,
  });
};


const listForReview = async (req, res) => {
  const filters = validateReviewListQuery(req.query || {});
  const result = await questionBankService.listQuestionsForReview({
    ownerId: req.user.id,
    isAdmin: true,
    filters,
  });

  res.json({
    data: result,
  });
};

const updateReviewStatus = async (req, res) => {
  const payload = validateReviewStatusUpdate(req.body || {});
  const result = await questionBankService.updateReviewStatus({
    questionId: req.params.id,
    payload,
  });

  res.json({
    data: result,
  });
};

const updateReviewQuestion = async (req, res) => {
  const payload = validateReviewQuestionUpdate(req.body || {});
  const result = await questionBankService.updateReviewQuestion({
    questionId: req.params.id,
    payload,
  });

  res.json({
    data: result,
  });
};

const aiReviewQuestion = async (req, res) => {
  const payload = validateAiReviewQuestion(req.body || {});
  const result = await questionBankService.aiReviewQuestion({
    questionId: req.params.id,
    payload,
  });

  res.json({
    data: result,
  });
};

const getCoverage = async (req, res) => {
  const query = validateCoverageQuery(req.query || {});
  const result = await questionBankService.getCoverage({
    ownerId: req.user.id,
    query,
  });

  res.json({
    data: result,
  });
};

const bulkImport = async (req, res) => {
  const result = await questionBankService.bulkImport({
    ownerId: req.user.id,
    payload: req.body || {},
  });

  res.json({
    data: result,
  });
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
  bulkImport,
};
