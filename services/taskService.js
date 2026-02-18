const Task = require("../models/task");

const getAllTasks = async () => {
  return Task.find().sort({ createdAt: -1 });
};

const getTask = async (id) => {
  return Task.findById(id);
};

const createTask = async (payload) => {
  const task = new Task(payload);
  return task.save();
};

const updateTask = async (id, updates) => {
  return Task.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });
};

const deleteTask = async (id) => {
  return Task.findByIdAndDelete(id);
};

module.exports = {
  getAllTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
};
