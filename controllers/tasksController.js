const ApiError = require('../errors/apiError');
const taskService = require('../services/taskService');
const { logger } = require('../config/logger');
const {
  validateTaskCreation,
  validateTaskUpdate,
} = require('../validators/taskValidator');

const listTasks = async (req, res) => {
  const tasks = await taskService.getAllTasks(req.user.id);
  res.json({ data: tasks });
};

const getTask = async (req, res) => {
  const task = await taskService.getTask(req.params.id, req.user.id);
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }
  res.json({ data: task });
};

const createTask = async (req, res) => {
  const payload = validateTaskCreation(req.body);
  const task = await taskService.createTask(payload, req.user.id);
  logger.info('Task created', { taskId: task._id });
  res.status(201).json({ data: task });
};

const updateTask = async (req, res) => {
  const payload = validateTaskUpdate(req.body);
  const task = await taskService.updateTask(req.params.id, payload, req.user.id);
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }
  logger.info('Task updated', { taskId: task._id });
  res.json({ data: task });
};

const deleteTask = async (req, res) => {
  const task = await taskService.deleteTask(req.params.id, req.user.id);
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }
  logger.info('Task deleted', { taskId: task._id });
  res.json({ message: 'Task deleted' });
};

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
