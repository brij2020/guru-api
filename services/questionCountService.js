const QuestionCount = require('../models/questionCount');

const getAllQuestionCounts = async (userId) => {
  return QuestionCount.find({ owner: userId }).sort({ count: 1 });
};

const getQuestionCount = async (id, userId) => {
  return QuestionCount.findOne({ _id: id, owner: userId });
};

const createQuestionCount = async (payload, userId) => {
  const questionCount = new QuestionCount({
    count: payload.count,
    owner: userId,
  });
  return questionCount.save();
};

const updateQuestionCount = async (id, updates, userId) => {
  return QuestionCount.findOneAndUpdate({ _id: id, owner: userId }, updates, {
    new: true,
    runValidators: true,
  });
};

const deleteQuestionCount = async (id, userId) => {
  return QuestionCount.findOneAndDelete({ _id: id, owner: userId });
};

module.exports = {
  getAllQuestionCounts,
  getQuestionCount,
  createQuestionCount,
  updateQuestionCount,
  deleteQuestionCount,
};
