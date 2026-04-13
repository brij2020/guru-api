const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const {
  add,
  remove,
  toggle,
  list,
  check,
  checkMany
} = require('../../controllers/bookmarkController');

router.post('/', authenticate, add);
router.delete('/:questionId', authenticate, remove);
router.post('/toggle', authenticate, toggle);
router.get('/', authenticate, list);
router.get('/check/:questionId', authenticate, check);
router.post('/check-many', authenticate, checkMany);

module.exports = (app) => {
  app.use('/api/v1/bookmarks', router);
};
