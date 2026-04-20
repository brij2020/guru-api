const ApiError = require('../errors/apiError');
const { logger } = require('../config/logger');
const paperBlueprintService = require('../services/paperBlueprintService');
const {
  validateBlueprintUpsert,
  validateBlueprintQuery,
} = require('../validators/paperBlueprintValidator');

const ensureAdmin = (req) => {
  const adminRoles = ['admin', 'super_admin'];
  if (!adminRoles.includes(req.user?.role)) {
    throw new ApiError(403, 'Only admin users can manage paper blueprints');
  }
};

const getBlueprint = async (req, res) => {
  const query = validateBlueprintQuery(req.query || {});
  if (!query.examSlug || !query.stageSlug) {
    const blueprints = await paperBlueprintService.listActiveBlueprints();
    res.json({ data: blueprints || [] });
    return;
  }
  const blueprint = await paperBlueprintService.getActiveBlueprint(query.examSlug, query.stageSlug);
  res.json({ data: blueprint || null });
};

const getBlueprintById = async (req, res) => {
  ensureAdmin(req);
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Blueprint ID required' });
  }
  const blueprint = await paperBlueprintService.getBlueprintById(id);
  if (!blueprint) {
    return res.status(404).json({ success: false, error: 'Blueprint not found' });
  }
  res.json({ success: true, data: blueprint });
};

const listAllBlueprints = async (req, res) => {
  ensureAdmin(req);
  const { examSlug, stageSlug, isActive, limit = 50, page = 1 } = req.query;
  const filter = {};
  if (examSlug) filter.examSlug = examSlug;
  if (stageSlug) filter.stageSlug = stageSlug;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  const blueprints = await paperBlueprintService.listAllBlueprints(filter, parseInt(limit), parseInt(page));
  res.json({ success: true, data: blueprints });
};

const deleteBlueprint = async (req, res) => {
  ensureAdmin(req);
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Blueprint ID required' });
  }
  const deleted = await paperBlueprintService.deleteBlueprint(id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Blueprint not found' });
  }
  logger.info('Paper blueprint deleted', { blueprintId: id, deletedBy: req.user.id });
  res.json({ success: true, message: 'Blueprint deleted' });
};

const upsertBlueprint = async (req, res) => {
  ensureAdmin(req);
  const payload = validateBlueprintUpsert(req.body || {});
  const blueprint = await paperBlueprintService.upsertBlueprint(req.user.id, payload);
  logger.info('Paper blueprint upserted', {
    owner: req.user.id,
    blueprintId: blueprint?._id?.toString(),
    examSlug: payload.examSlug,
    stageSlug: payload.stageSlug,
  });
  res.json({ data: blueprint });
};

module.exports = {
  getBlueprint,
  getBlueprintById,
  listAllBlueprints,
  deleteBlueprint,
  upsertBlueprint,
};
