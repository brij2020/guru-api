const mongoose = require('mongoose');
const TestAttempt = require('../models/testAttempt');
const ApiError = require('../errors/apiError');

const toPlainObject = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value);

const sanitizeQuestion = (question = {}) => ({
  id: String(question.id || '').trim(),
  type: String(question.type || 'mcq').trim(),
  difficulty: String(question.difficulty || 'medium').trim(),
  question: String(question.question || '').trim(),
  section: String(question.section || '').trim(),
  topic: String(question.topic || '').trim(),
  groupType: String(question.groupType || 'none').trim(),
  groupId: String(question.groupId || '').trim(),
  groupTitle: String(question.groupTitle || '').trim(),
  passageText: String(question.passageText || '').trim(),
  groupOrder: Number.isFinite(Number(question.groupOrder)) ? Number(question.groupOrder) : null,
  hasVisual: Boolean(question.hasVisual),
  assets: Array.isArray(question.assets) ? question.assets : [],
  options: Array.isArray(question.options) ? question.options.map((item) => String(item)) : [],
  answer: String(question.answer || '').trim(),
  explanation: String(question.explanation || '').trim(),
  inputOutput: String(question.inputOutput || '').trim(),
  solutionApproach: String(question.solutionApproach || '').trim(),
  sampleSolution: String(question.sampleSolution || '').trim(),
  complexity: String(question.complexity || '').trim(),
  code: String(question.code || '').trim(),
  expectedOutput: String(question.expectedOutput || '').trim(),
  idealSolution: String(question.idealSolution || '').trim(),
  keyConsiderations: Array.isArray(question.keyConsiderations)
    ? question.keyConsiderations.map((item) => String(item))
    : [],
});

const sanitizeQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((item) => sanitizeQuestion(item))
    .filter((item) => item.question);

const sanitizeSectionPlan = (sectionPlan = []) =>
  (Array.isArray(sectionPlan) ? sectionPlan : [])
    .map((item) => ({
      section: String(item?.section || '').trim(),
      targetCount: Math.max(0, Number(item?.targetCount || 0)),
      servedCount: Math.max(0, Number(item?.servedCount || 0)),
    }))
    .filter((item) => item.section);

const sanitizeStoredAttempt = (attempt) => {
  const plain = toPlainObject(attempt) || {};
  return {
    ...plain,
    paperQuestions: sanitizeQuestions(plain.paperQuestions),
    sectionPlan: sanitizeSectionPlan(plain.sectionPlan),
  };
};

const resolvedTotalQuestionsFromPayload = (payload, questions = []) => {
  if (questions.length > 0) return questions.length;
  if (Number(payload.totalQuestions || 0) > 0) return Number(payload.totalQuestions);
  return String(payload.questionCount || '').trim().toLowerCase() === 'all'
    ? 0
    : Number(payload.questionCount || 0) || 0;
};

const startTestAttempt = async (payload, userId) => {
  const questions = sanitizeQuestions(payload.questions);
  const sectionPlan = sanitizeSectionPlan(payload.sectionPlan);
  const attempt = new TestAttempt({
    owner: userId,
    testId: payload.testId || '',
    testTitle: payload.testTitle,
    domain: payload.domain || '',
    difficulty: payload.difficulty || 'all',
    topics: payload.topics || [],
    questionStyles: payload.questionStyles || [],
    questionCount: String(payload.questionCount || 'all'),
    totalQuestions: resolvedTotalQuestionsFromPayload(payload, questions),
    duration: Number(payload.duration || 0),
    status: 'started',
    paperQuestions: questions,
    sectionPlan,
  });

  const savedAttempt = await attempt.save();
  return {
    ...sanitizeStoredAttempt(savedAttempt),
    curatedQuestions: questions,
    estimatedDurationMinutes: Number(payload.duration || 0),
    curationStatus: 'skipped',
  };
};

const getAttemptOrThrow = async (attemptId, userId) => {
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new ApiError(400, 'Invalid attempt id');
  }

  const attempt = await TestAttempt.findOne({ _id: attemptId, owner: userId });
  if (!attempt) {
    throw new ApiError(404, 'Test attempt not found');
  }
  return attempt;
};

const getTestAttempt = async (attemptId, userId) => sanitizeStoredAttempt(await getAttemptOrThrow(attemptId, userId));

const completeTestAttempt = async (payload, userId) => {
  const attempt = await getAttemptOrThrow(payload.attemptId, userId);
  const questions = sanitizeQuestions(payload.questions);
  const sectionPlan = sanitizeSectionPlan(payload.sectionPlan);
  const now = new Date();

  if (questions.length > 0) {
    attempt.paperQuestions = questions;
    attempt.totalQuestions = questions.length;
  }
  if (sectionPlan.length > 0) {
    attempt.sectionPlan = sectionPlan;
  }

  attempt.status = 'completed';
  attempt.completedAt = now;
  attempt.completion = {
    autoSubmitted: Boolean(payload.autoSubmitted),
    score: Number(payload.score || 0),
    percentage: Number(payload.percentage || 0),
    correctCount: Number(payload.correctCount || 0),
    incorrectCount: Number(payload.incorrectCount || 0),
    unattemptedCount: Number(payload.unattemptedCount || 0),
    attemptedCount: Number(payload.attemptedCount || 0),
    timeSpent: Number(payload.timeSpent || 0),
    sectionScores: Array.isArray(payload.sectionScores) ? payload.sectionScores : [],
    difficultyBreakdown: Array.isArray(payload.difficultyBreakdown) ? payload.difficultyBreakdown : [],
    typeBreakdown: Array.isArray(payload.typeBreakdown) ? payload.typeBreakdown : [],
    userAnswers: payload.userAnswers && typeof payload.userAnswers === 'object' ? payload.userAnswers : {},
    questionTimeSpent:
      payload.questionTimeSpent && typeof payload.questionTimeSpent === 'object' ? payload.questionTimeSpent : {},
    questionStatus: payload.questionStatus && typeof payload.questionStatus === 'object' ? payload.questionStatus : {},
    aiEvaluation: payload.aiEvaluation && typeof payload.aiEvaluation === 'object' ? payload.aiEvaluation : null,
    submittedAt: now,
  };

  const savedAttempt = await attempt.save();
  return sanitizeStoredAttempt(savedAttempt);
};

const listTestAttempts = async (userId) => {
  const rows = await TestAttempt.find({ owner: userId })
    .sort({ updatedAt: -1 })
    .lean();

  const attempts = rows.map((attempt) => ({
    _id: String(attempt._id),
    testId: String(attempt.testId || ''),
    testTitle: String(attempt.testTitle || ''),
    domain: String(attempt.domain || ''),
    difficulty: String(attempt.difficulty || ''),
    status: String(attempt.status || 'started'),
    totalQuestions: Number(attempt.totalQuestions || 0),
    duration: Number(attempt.duration || 0),
    startedAt: attempt.startedAt || null,
    completedAt: attempt.completedAt || null,
    updatedAt: attempt.updatedAt || null,
    completion: attempt.completion
      ? {
          score: Number(attempt.completion.score || 0),
          percentage: Number(attempt.completion.percentage || 0),
          attemptedCount: Number(attempt.completion.attemptedCount || 0),
          correctCount: Number(attempt.completion.correctCount || 0),
          timeSpent: Number(attempt.completion.timeSpent || 0),
          submittedAt: attempt.completion.submittedAt || null,
        }
      : null,
  }));

  return {
    total: attempts.length,
    attempts,
  };
};

module.exports = {
  startTestAttempt,
  getTestAttempt,
  completeTestAttempt,
  listTestAttempts,
};
