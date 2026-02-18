const express = require('express');
const tasksController = require('../../controllers/tasksController');
const asyncHandler = require('../../middleware/asyncHandler');
const authenticate = require('../../middleware/authenticate');

module.exports = (app) => {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(tasksController.listTasks));
  router.get('/:id', asyncHandler(tasksController.getTask));
  router.post('/', asyncHandler(tasksController.createTask));
  router.put('/:id', asyncHandler(tasksController.updateTask));
  router.delete('/:id', asyncHandler(tasksController.deleteTask));

  app.use('/api/v1/tasks', router);
};
