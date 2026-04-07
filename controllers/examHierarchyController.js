const ApiError = require('../errors/apiError');
const { logger } = require('../config/logger');
const examHierarchyService = require('../services/examHierarchyService');
const { validateExamHierarchyUpsert } = require('../validators/examHierarchyValidator');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const ensureAdmin = (req) => {
  if (!isAdmin(req.user?.role)) {
    throw new ApiError(403, 'Only admin users can manage exam hierarchy');
  }
};

const getExamHierarchy = async (req, res) => {
  const hierarchy = await examHierarchyService.getLatestExamHierarchy();
  res.json({ data: hierarchy || null });
};

const upsertExamHierarchy = async (req, res) => {
  ensureAdmin(req);
  const payload = validateExamHierarchyUpsert(req.body);
  const hierarchy = await examHierarchyService.upsertExamHierarchyByOwner(req.user.id, payload);
  logger.info('Exam hierarchy upserted', {
    owner: req.user.id,
    hierarchyId: hierarchy?._id?.toString(),
    treeRootCount: Array.isArray(payload.tree) ? payload.tree.length : 0,
  });
  res.json({ data: hierarchy });
};

module.exports = {
  getExamHierarchy,
  upsertExamHierarchy,
};
