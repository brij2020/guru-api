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

const listActiveBlueprints = async () =>
  PaperBlueprint.find({ isActive: true }).sort({ examSlug: 1, stageSlug: 1, updatedAt: -1 });

const upsertBlueprint = async (ownerId, payload) => {
  const examSlug = normalizeSlug(payload.examSlug);
  const stageSlug = normalizeSlug(payload.stageSlug);
  const totalQuestions = Number(payload.totalQuestions || 0);
  const durationMinutes = Number(payload.durationMinutes || 60);
  const examStageQuestions = Number(payload.examStageQuestions || totalQuestions || 1);

  return PaperBlueprint.findOneAndUpdate(
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
};

module.exports = {
  getActiveBlueprint,
  listActiveBlueprints,
  upsertBlueprint,
};
