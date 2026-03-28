const express = require('express');
const categoryController = require('../../controllers/categoryController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.get('/', asyncHandler(categoryController.listCategories));
  router.get('/:id', asyncHandler(categoryController.getCategory));
  router.post('/', authenticate, asyncHandler(categoryController.createCategory));
  router.put('/:id', authenticate, asyncHandler(categoryController.updateCategory));
  router.delete('/:id', authenticate, asyncHandler(categoryController.deleteCategory));

  app.use('/api/v1/categories', router);
};
