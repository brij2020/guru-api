const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const navigationController = require('../../controllers/navigationController');

module.exports = (app) => {
  const router = express.Router();
  
  router.get('/portal', asyncHandler(navigationController.getPortalNavigation));
  router.get('/admin/list', asyncHandler(navigationController.getAdminList));
  
  router.use(authenticate);
  
  router.get('/', asyncHandler(navigationController.getNavigation));
  router.post('/item', asyncHandler(navigationController.upsertItem));
  router.put('/item/:itemId', asyncHandler(navigationController.upsertItem));
  router.delete('/item/:itemId', asyncHandler(navigationController.deleteItem));
  router.post('/reorder', asyncHandler(navigationController.reorder));
  router.post('/reset', asyncHandler(navigationController.resetDefault));
  
  app.use('/api/v1/navigation', router);
};