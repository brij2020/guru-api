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
  console.log("===========E")
  const query = validateBlueprintQuery(req.query || {});
  logger.info('[paper-blueprints:get] request', {
    examSlug: query.examSlug || '',
    stageSlug: query.stageSlug || '',
    hasExam: Boolean(query.examSlug),
    hasStage: Boolean(query.stageSlug),
  });

  if (!query.examSlug || !query.stageSlug) {
    const blueprints = await paperBlueprintService.listActiveBlueprints();
    logger.info('[paper-blueprints:get] list-active', {
      count: Array.isArray(blueprints) ? blueprints.length : 0,
    });
    res.json({ data: blueprints || [] });
    return;
  }
  const blueprint = await paperBlueprintService.getActiveBlueprint(query.examSlug, query.stageSlug);
  logger.info('[paper-blueprints:get] single-active', {
    examSlug: query.examSlug,
    stageSlug: query.stageSlug,
    found: Boolean(blueprint),
    blueprintId: blueprint?._id?.toString?.() || null,
    sectionsCount: Array.isArray(blueprint?.sections) ? blueprint.sections.length : 0,
    isActive: blueprint?.isActive ?? null,
    owner: blueprint?.owner?.toString?.() || null,
  });
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
