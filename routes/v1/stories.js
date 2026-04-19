const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const { getAll, getBySlug, getCategories, search, getRelated, getFeatured, incrementView } = require('../../controllers/storyController');

router.get('/categories', asyncHandler(getCategories));
router.get('/', asyncHandler(getAll));
router.get('/search', asyncHandler(search));
router.get('/featured', asyncHandler(getFeatured));
router.get('/related/:id', asyncHandler(getRelated));
router.get('/:slug', asyncHandler(getBySlug));
router.post('/:id/view', asyncHandler(incrementView));

module.exports = (app) => {
  app.use('/api/v1/stories', router);
};
