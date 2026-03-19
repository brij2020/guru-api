const examService = require('../services/examService');

const listExams = async (req, res) => {
  const { active, search } = req.query;
  const filter = {};
  
  if (active === 'true') {
    filter.isActive = true;
  } else if (active === 'false') {
    filter.isActive = false;
  } else if (req.user && req.user.role !== 'admin') {
    filter.isActive = true;
  }
  
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }
  
  const exams = await examService.getExams(filter);
  res.json({ data: exams });
};

const getExam = async (req, res) => {
  const exam = await examService.getExamBySlug(req.params.slug);
  if (!exam) {
    return res.status(404).json({ error: 'Exam not found' });
  }
  res.json({ data: exam });
};

const createExam = async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin users can create exams' });
  }
  const exam = await examService.createExam(req.body);
  res.status(201).json({ data: exam });
};

const updateExam = async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin users can update exams' });
  }
  const exam = await examService.updateExam(req.params.slug, req.body);
  if (!exam) {
    return res.status(404).json({ error: 'Exam not found' });
  }
  res.json({ data: exam });
};

const deleteExam = async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin users can delete exams' });
  }
  const deleted = await examService.deleteExam(req.params.slug);
  if (!deleted) {
    return res.status(404).json({ error: 'Exam not found' });
  }
  res.json({ data: { success: true } });
};

module.exports = {
  listExams,
  getExam,
  createExam,
  updateExam,
  deleteExam,
};
