const Exam = require('../models/exam');
const ApiError = require('../errors/apiError');

const getExams = async (filter = {}) => {
  return Exam.find(filter).sort({ displayOrder: 1, name: 1 });
};

const getExamBySlug = async (slug) => {
  return Exam.findOne({ slug });
};

const getExamById = async (id) => {
  return Exam.findById(id);
};

const createExam = async (data) => {
  try {
    const exam = new Exam(data);
    await exam.save();
    return exam;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ');
      throw new ApiError(400, messages);
    }
    throw error;
  }
};

const updateExam = async (slug, data) => {
  try {
    return await Exam.findOneAndUpdate(
      { slug },
      { $set: data },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ');
      throw new ApiError(400, messages);
    }
    throw error;
  }
};

const deleteExam = async (slug) => {
  const result = await Exam.deleteOne({ slug });
  return result.deletedCount > 0;
};

module.exports = {
  getExams,
  getExamBySlug,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
};
