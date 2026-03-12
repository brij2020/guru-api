const ApiError = require('../errors/apiError');
const { logger } = require('../config/logger');
const paperBlueprintService = require('../services/paperBlueprintService');
const {
  validateBlueprintUpsert,
  validateBlueprintQuery,
} = require('../validators/paperBlueprintValidator');

const ensureAdmin = (req) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Only admin users can manage paper blueprints');
  }
};

const getBlueprint = async (req, res) => {
  const query = validateBlueprintQuery(req.query || {});
  const blueprint = await paperBlueprintService.getActiveBlueprint(query.examSlug, query.stageSlug);
  res.json({ data: blueprint || null });
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
  upsertBlueprint,
};
