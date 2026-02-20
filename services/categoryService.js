const Category = require('../models/category');
const topicService = require('./topicService');
const questionStyleService = require('./questionStyleService');

const getAllCategories = async (userId) => {
  return Category.find({ owner: userId }).sort({ createdAt: -1 });
};

const getCategory = async (id, userId) => {
  return Category.findOne({ _id: id, owner: userId });
};

const createCategory = async (payload, userId) => {
  const category = new Category({ ...payload, owner: userId });
  return category.save();
};

const updateCategory = async (id, updates, userId) => {
  return Category.findOneAndUpdate({ _id: id, owner: userId }, updates, {
    new: true,
    runValidators: true,
  });
};

const deleteCategory = async (id, userId) => {
  const category = await Category.findOneAndDelete({ _id: id, owner: userId });
  if (category) {
    await topicService.deleteTopicsByCategory(category._id, userId);
    await questionStyleService.deleteQuestionStylesByCategory(category._id, userId);
  }
  return category;
};

module.exports = {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
