const Task = require('../models/task');

const getAllTasks = async (userId) => {
  return Task.find({ owner: userId }).sort({ createdAt: -1 });
};

const getTask = async (id, userId) => {
  return Task.findOne({ _id: id, owner: userId });
};

const createTask = async (payload, userId) => {
  const task = new Task({ ...payload, owner: userId });
  return task.save();
};

const updateTask = async (id, updates, userId) => {
  return Task.findOneAndUpdate({ _id: id, owner: userId }, updates, {
    new: true,
    runValidators: true,
  });
};

const deleteTask = async (id, userId) => {
  return Task.findOneAndDelete({ _id: id, owner: userId });
};

module.exports = {
  getAllTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
