const questionBankService = require('../services/questionBankService');
const { assemblePaper, assembleItPaper } = require('../services/questionPaperAssemblerService');
const {
  validateBulkCreate,
  validateReviewListQuery,
  validateReviewStatusUpdate,
  validateReviewQuestionUpdate,
  validateCoverageQuery,
  validateListQuestionsQuery,
} = require('../validators/questionBankValidator');
const ApiError = require('../errors/apiError');

const isAdminLike = (role) => ['admin', 'super_admin'].includes(role);

const requirePermission = (user, permission) => {
  if (isAdminLike(user?.role)) return true;
  return user?.adminPermissions?.[permission] === 'write' || user?.adminPermissions?.[permission] === 'read';
};

const requireWritePermission = (user, permission) => {
  if (isAdminLike(user?.role)) return true;
  return user?.adminPermissions?.[permission] === 'write';
};

const pullSimilarQuestions = async (req, res) => {
  const result = await questionBankService.pullSimilarQuestions(req.body);
  res.json({ data: result });
};

const assemblePaperHandler = async (req, res) => {
  const result = await assemblePaper({ ownerId: req.user.id, payload: req.body });
  res.json({ data: result });
};

const assembleItPaperHandler = async (req, res) => {
  const result = await assembleItPaper({ ownerId: req.user.id, payload: req.body });
  res.json({ data: result });
};

const importJson = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionImport')) {
    throw new ApiError(403, 'You do not have permission to import questions');
  }

  const payload = validateBulkCreate(req.body || {});
  const result = await questionBankService.importQuestionsFromJson({
    ownerId: req.user.id,
    payload,
  });

  res.json({ data: { success: true, ...result } });
};

const bulkCreateQuestions = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionPublisher')) {
    throw new ApiError(403, 'You do not have permission to create questions');
  }

  const payload = validateBulkCreate(req.body || {});
  const result = await questionBankService.importQuestionsFromJson({
    ownerId: req.user.id,
    payload,
  });

  res.json({ data: { success: true, ...result } });
};

const listForReview = async (req, res) => {
  if (!requirePermission(req.user, 'questionReview')) {
    throw new ApiError(403, 'You do not have permission to review questions');
  }

  const filters = validateReviewListQuery(req.query || {});
  const result = await questionBankService.listQuestionsForReview({
    ownerId: req.user.id,
    isAdmin: isAdminLike(req.user.role),
    filters,
  });
  res.json({ data: result });
};

const updateReviewStatus = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionReview')) {
    throw new ApiError(403, 'You do not have permission to review questions');
  }

  const { id, status } = validateReviewStatusUpdate(req.body || {});
  const result = await questionBankService.bulkUpdateReviewStatus({
    id,
    status,
    reviewerId: req.user.id,
  });

  res.json({ data: result });
};

const updateReviewQuestion = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionEditor')) {
    throw new ApiError(403, 'You do not have permission to edit questions');
  }

  const { id, ...updates } = validateReviewQuestionUpdate(req.body || {});
  const result = await questionBankService.updateQuestionForReview({
    id,
    ...updates,
    editorId: req.user.id,
  });

  res.json({ data: result });
};

const aiReviewQuestion = async (req, res) => {
  if (!requirePermission(req.user, 'questionReview')) {
    throw new ApiError(403, 'You do not have permission to run AI review');
  }

  const { id } = req.params;
  const result = await questionBankService.aiReviewQuestion({ id });

  res.json({ data: result });
};

const getCoverage = async (req, res) => {
  if (!requirePermission(req.user, 'questionCoverage')) {
    throw new ApiError(403, 'You do not have permission to view coverage');
  }

  const filters = validateCoverageQuery(req.query || {});
  const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
  const result = await questionBankService.getCoverageSnapshot({ filters, isAdmin });

  res.json({ data: result });
};

const listQuestions = async (req, res) => {
  const filters = validateListQuestionsQuery(req.query || {});
  const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
  const result = await questionBankService.listQuestions({ filters, isAdmin });

  res.json({ data: result });
};

const getTodaysQuestionsBySection = async (req, res) => {
  const result = await questionBankService.getTodaysQuestionsBySection();
  res.json({ data: result });
};

const getQuestionById = async (req, res) => {
  if (!requirePermission(req.user, 'questionEditor')) {
    throw new ApiError(403, 'You do not have permission to edit questions');
  }
  const { id } = req.params;
  const result = await questionBankService.getQuestionByIdForReview({
    ownerId: req.user.id,
    isAdmin: isAdminLike(req.user.role),
    id,
  });
  if (!result) throw new ApiError(404, 'Question not found');
  res.json({ data: result });
};

const updateQuestionById = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionEditor')) {
    throw new ApiError(403, 'You do not have permission to edit questions');
  }
  const { id } = req.params;
  const updates = validateReviewQuestionUpdate({ ...(req.body || {}), id });
  const { id: _, ...rest } = updates;
  const result = await questionBankService.updateQuestionForReview({
    ownerId: req.user.id,
    reviewerId: req.user.id,
    isAdmin: isAdminLike(req.user.role),
    id,
    updates: rest,
  });
  if (!result) throw new ApiError(404, 'Question not found');
  res.json({ data: result });
};

const deleteQuestionById = async (req, res) => {
  if (!requireWritePermission(req.user, 'questionEditor')) {
    throw new ApiError(403, 'You do not have permission to delete questions');
  }
  const { id } = req.params;
  const result = await questionBankService.deleteQuestionForReview({
    ownerId: req.user.id,
    isAdmin: isAdminLike(req.user.role),
    id,
  });
  if (!result) throw new ApiError(404, 'Question not found');
  res.json({ data: result });
};

const getQuestionsByIds = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    throw new ApiError(400, 'ids array is required');
  }
  const result = await questionBankService.getQuestionsByIds(ids);
  res.json({ data: result });
};

module.exports = {
  pullSimilarQuestions,
  assemblePaper: assemblePaperHandler,
  assembleItPaper: assembleItPaperHandler,
  importJson,
  bulkCreateQuestions,
  listForReview,
  updateReviewStatus,
  updateReviewQuestion,
  aiReviewQuestion,
  getCoverage,
  listQuestions,
  getTodaysQuestionsBySection,
  getQuestionById,
  updateQuestionById,
  deleteQuestionById,
  getQuestionsByIds,
};
