const PaperBlueprint = require('../models/paperBlueprint');

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const blueprintCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const getCacheKey = (examSlug, stageSlug) => `${examSlug}::${stageSlug}`;

const invalidateCache = (examSlug, stageSlug) => {
  const key = getCacheKey(examSlug, stageSlug);
  blueprintCache.delete(key);
};

const getActiveBlueprint = async (examSlug, stageSlug) => {
  const exam = normalizeSlug(examSlug);
  const stage = normalizeSlug(stageSlug);
  if (!exam || !stage) return null;

  const cacheKey = getCacheKey(exam, stage);
  const cached = blueprintCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await PaperBlueprint.findOne({
    examSlug: exam,
    stageSlug: stage,
    isActive: true,
  }).sort({ updatedAt: -1 });

  blueprintCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
};

const listActiveBlueprints = async () =>
  PaperBlueprint.find({ isActive: true }).sort({ examSlug: 1, stageSlug: 1, updatedAt: -1 });

const upsertBlueprint = async (ownerId, payload) => {
  const examSlug = normalizeSlug(payload.examSlug);
  const stageSlug = normalizeSlug(payload.stageSlug);
  const totalQuestions = Number(payload.totalQuestions || 0);
  const durationMinutes = Number(payload.durationMinutes || 60);
  const examStageQuestions = Number(payload.examStageQuestions || totalQuestions || 1);

  const result = await PaperBlueprint.findOneAndUpdate(
    { owner: ownerId, examSlug, stageSlug },
    {
      $set: {
        name: payload.name || '',
        examName: payload.examName || '',
        durationMinutes,
        examStageQuestions,
        totalQuestions,
        sections: payload.sections,
        difficultyMix: payload.difficultyMix,
        isActive: payload.isActive !== false,
      },
      $setOnInsert: {
        owner: ownerId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  invalidateCache(examSlug, stageSlug);

  return result;
};

module.exports = {
  getActiveBlueprint,
  listActiveBlueprints,
  upsertBlueprint,
  invalidateCache,
};
