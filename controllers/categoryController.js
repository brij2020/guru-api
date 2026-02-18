const ApiError = require('../errors/apiError');
const categoryService = require('../services/categoryService');
const { logger } = require('../config/logger');
const {
  validateCategoryCreation,
  validateCategoryUpdate,
} = require('../validators/categoryValidator');

const listCategories = async (req, res) => {
  const categories = await categoryService.getAllCategories(req.user.id);
  res.json({ data: categories });
};

const getCategory = async (req, res) => {
  const category = await categoryService.getCategory(req.params.id, req.user.id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  res.json({ data: category });
};

const createCategory = async (req, res) => {
  const payload = validateCategoryCreation(req.body);
  const category = await categoryService.createCategory(payload, req.user.id);
  logger.info('Category created', { categoryId: category._id });
  res.status(201).json({ data: category });
};

const updateCategory = async (req, res) => {
  const payload = validateCategoryUpdate(req.body);
  const category = await categoryService.updateCategory(req.params.id, payload, req.user.id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  logger.info('Category updated', { categoryId: category._id });
  res.json({ data: category });
};

const deleteCategory = async (req, res) => {
  const category = await categoryService.deleteCategory(req.params.id, req.user.id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  logger.info('Category deleted', { categoryId: category._id });
  res.json({ message: 'Category deleted' });
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
