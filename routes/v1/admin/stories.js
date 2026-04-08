const express = require('express');
const router = express.Router();
const isAdmin = require('../../../middleware/isAdmin');
const { getAll, getCategories, create, update, remove } = require('../../../controllers/storyController');

router.get('/categories', getCategories);
router.get('/', getAll);
router.post('/', isAdmin, create);
router.put('/:id', isAdmin, update);
router.delete('/:id', isAdmin, remove);

module.exports = (app) => {
  app.use('/api/v1/admin/stories', router);
};
