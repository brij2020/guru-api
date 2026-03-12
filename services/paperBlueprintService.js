const PaperBlueprint = require('../models/paperBlueprint');

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const getActiveBlueprint = async (examSlug, stageSlug) => {
  const exam = normalizeSlug(examSlug);
  const stage = normalizeSlug(stageSlug);
  if (!exam || !stage) return null;

  return PaperBlueprint.findOne({
    examSlug: exam,
    stageSlug: stage,
    isActive: true,
  }).sort({ updatedAt: -1 });
};

const upsertBlueprint = async (ownerId, payload) => {
  const examSlug = normalizeSlug(payload.examSlug);
  const stageSlug = normalizeSlug(payload.stageSlug);

  return PaperBlueprint.findOneAndUpdate(
    { owner: ownerId, examSlug, stageSlug },
    {
      $set: {
        name: payload.name || '',
        totalQuestions: payload.totalQuestions,
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
};

module.exports = {
  getActiveBlueprint,
  upsertBlueprint,
};
