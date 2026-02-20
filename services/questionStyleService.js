const QuestionStyle = require('../models/questionStyle');
const Category = require('../models/category');
const ApiError = require('../errors/apiError');

const ensureOwnedCategory = async (categoryId, userId) => {
  const category = await Category.findOne({ _id: categoryId, owner: userId });
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  return category;
};

const getAllQuestionStyles = async (userId, categoryId) => {
  const query = { owner: userId };
  if (categoryId) query.category = categoryId;
  return QuestionStyle.find(query).sort({ createdAt: -1 });
};

const getQuestionStyle = async (id, userId) => {
  return QuestionStyle.findOne({ _id: id, owner: userId });
};

const createQuestionStyle = async (payload, userId) => {
  await ensureOwnedCategory(payload.categoryId, userId);
  const questionStyle = new QuestionStyle({
    style: payload.style,
    category: payload.categoryId,
    owner: userId,
  });
  return questionStyle.save();
};

const createQuestionStylesByNames = async (payload, userId) => {
  await ensureOwnedCategory(payload.categoryId, userId);

  return Promise.all(
    payload.styles.map((style) =>
      QuestionStyle.findOneAndUpdate(
        {
          owner: userId,
          category: payload.categoryId,
          style,
        },
        { $setOnInsert: {} },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        }
      )
    )
  );
};

const updateQuestionStyle = async (id, updates, userId) => {
  const nextUpdates = { ...updates };
  if (updates.categoryId) {
    await ensureOwnedCategory(updates.categoryId, userId);
    nextUpdates.category = updates.categoryId;
    delete nextUpdates.categoryId;
  }
  return QuestionStyle.findOneAndUpdate({ _id: id, owner: userId }, nextUpdates, {
    new: true,
    runValidators: true,
  });
};

const deleteQuestionStyle = async (id, userId) => {
  return QuestionStyle.findOneAndDelete({ _id: id, owner: userId });
};

const deleteQuestionStylesByCategory = async (categoryId, userId) => {
  return QuestionStyle.deleteMany({ category: categoryId, owner: userId });
};

module.exports = {
  getAllQuestionStyles,
  getQuestionStyle,
  createQuestionStyle,
  createQuestionStylesByNames,
  updateQuestionStyle,
  deleteQuestionStyle,
  deleteQuestionStylesByCategory,
};
