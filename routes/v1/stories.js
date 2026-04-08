const express = require('express');
const router = express.Router();
const { getAll, getBySlug, getCategories } = require('../../controllers/storyController');

router.get('/categories', getCategories);
router.get('/', getAll);
router.get('/:slug', getBySlug);

module.exports = (app) => {
  app.use('/api/v1/stories', router);
};
