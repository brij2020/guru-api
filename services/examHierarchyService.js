const ExamHierarchy = require('../models/examHierarchy');

const getExamHierarchyByOwner = async (ownerId) => {
  return ExamHierarchy.findOne({ owner: ownerId });
};

const getLatestExamHierarchy = async () => {
  return ExamHierarchy.findOne({}).sort({ updatedAt: -1 });
};

const upsertExamHierarchyByOwner = async (ownerId, payload) => {
  return ExamHierarchy.findOneAndUpdate(
    { owner: ownerId },
    {
      $set: {
        tree: payload.tree,
        ...(payload.name ? { name: payload.name } : {}),
      },
      $setOnInsert: { owner: ownerId },
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
  getExamHierarchyByOwner,
  getLatestExamHierarchy,
  upsertExamHierarchyByOwner,
};
