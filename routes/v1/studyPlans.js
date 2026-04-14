const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const studyPlanController = require('../../controllers/studyPlanController');

router.post('/', authenticate, studyPlanController.create);
router.get('/', authenticate, studyPlanController.getByDate);
router.get('/all', authenticate, studyPlanController.getAll);
router.put('/:id', authenticate, studyPlanController.update);
router.delete('/:id', authenticate, studyPlanController.delete);

module.exports = (app) => {
  app.use('/api/v1/studyPlans', router);
};
