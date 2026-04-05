const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const isAdmin = require('../../middleware/isAdmin');
const subscriptionPlanController = require('../../controllers/subscriptionPlanController');

router.get('/', asyncHandler(subscriptionPlanController.listPlans));

router.get('/:idOrSlug', asyncHandler(subscriptionPlanController.getPlan));

router.post('/',
  authenticate,
  isAdmin,
  asyncHandler(subscriptionPlanController.createPlan)
);

router.put('/:id',
  authenticate,
  isAdmin,
  asyncHandler(subscriptionPlanController.updatePlan)
);

router.delete('/:id',
  authenticate,
  isAdmin,
  asyncHandler(subscriptionPlanController.deletePlan)
);

router.post('/reorder',
  authenticate,
  isAdmin,
  asyncHandler(subscriptionPlanController.reorderPlans)
);

router.post('/:id/duplicate',
  authenticate,
  isAdmin,
  asyncHandler(subscriptionPlanController.duplicatePlan)
);

module.exports = (app) => {
  app.use('/api/v1/subscription-plans', router);
};
