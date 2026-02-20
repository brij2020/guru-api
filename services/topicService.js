const Topic = require('../models/topic');
const Category = require('../models/category');
const ApiError = require('../errors/apiError');

const ensureOwnedCategory = async (categoryId, userId) => {
  const category = await Category.findOne({ _id: categoryId, owner: userId });
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  return category;
};

const getAllTopics = async (userId, categoryId) => {
  const query = { owner: userId };
  if (categoryId) query.category = categoryId;
  return Topic.find(query).sort({ createdAt: -1 });
};

const getTopic = async (id, userId) => {
  return Topic.findOne({ _id: id, owner: userId });
};

const createTopic = async (payload, userId) => {
  await ensureOwnedCategory(payload.categoryId, userId);
  const topic = new Topic({
    name: payload.name,
    description: payload.description,
    category: payload.categoryId,
    owner: userId,
  });
  return topic.save();
};

const createTopicsByTitles = async (payload, userId) => {
  await ensureOwnedCategory(payload.categoryId, userId);
  const description = payload.description || '';

  return Promise.all(
    payload.titles.map((title) =>
      Topic.findOneAndUpdate(
        {
          owner: userId,
          category: payload.categoryId,
          name: title,
        },
        {
          $setOnInsert: {
            description,
          },
        },
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

const updateTopic = async (id, updates, userId) => {
  const nextUpdates = { ...updates };
  if (updates.categoryId) {
    await ensureOwnedCategory(updates.categoryId, userId);
    nextUpdates.category = updates.categoryId;
    delete nextUpdates.categoryId;
  }
  return Topic.findOneAndUpdate({ _id: id, owner: userId }, nextUpdates, {
    new: true,
    runValidators: true,
  });
};

const deleteTopic = async (id, userId) => {
  return Topic.findOneAndDelete({ _id: id, owner: userId });
};

const deleteTopicsByCategory = async (categoryId, userId) => {
  return Topic.deleteMany({ category: categoryId, owner: userId });
};

module.exports = {
  getAllTopics,
  getTopic,
  createTopic,
  createTopicsByTitles,
  updateTopic,
  deleteTopic,
  deleteTopicsByCategory,
};
