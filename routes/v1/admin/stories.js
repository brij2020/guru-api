const express = require('express');
const router = express.Router();
const asyncHandler = require('../../../middleware/asyncHandler');
const isAdmin = require('../../../middleware/isAdmin');
const { getAll, getById, getCategories, create, update, remove } = require('../../../controllers/storyController');

router.get('/categories', asyncHandler(getCategories));
router.get('/', asyncHandler(getAll));
router.get('/:id', asyncHandler(getById));
router.post('/', isAdmin, asyncHandler(create));
router.put('/:id', isAdmin, asyncHandler(update));
router.delete('/:id', isAdmin, asyncHandler(remove));

module.exports = (app) => {
  app.use('/api/v1/admin/stories', router);
};
