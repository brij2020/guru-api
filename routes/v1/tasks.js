const express = require('express');
const tasksController = require('../../../controllers/tasksController');
const asyncHandler = require('../../../middleware/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(tasksController.listTasks));
router.get('/:id', asyncHandler(tasksController.getTask));
router.post('/', asyncHandler(tasksController.createTask));
router.put('/:id', asyncHandler(tasksController.updateTask));
router.delete('/:id', asyncHandler(tasksController.deleteTask));

module.exports = router;
