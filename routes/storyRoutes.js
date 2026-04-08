const express = require('express');
const router = express.Router();
const { getAll, getBySlug, getCategories, create, update, remove } = require('../controllers/storyController');
const { isAdmin } = require('../middleware/isAdmin');

router.get('/categories', getCategories);
router.get('/', getAll);
router.get('/:slug', getBySlug);

router.post('/', isAdmin, create);
router.put('/:id', isAdmin, update);
router.delete('/:id', isAdmin, remove);

module.exports = router;
