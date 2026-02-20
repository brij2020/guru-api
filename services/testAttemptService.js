const TestAttempt = require('../models/testAttempt');

const startTestAttempt = async (payload, userId) => {
  const attempt = new TestAttempt({
    owner: userId,
    testId: payload.testId || '',
    testTitle: payload.testTitle,
    domain: payload.domain || '',
    difficulty: payload.difficulty || 'all',
    topics: payload.topics || [],
    questionStyles: payload.questionStyles || [],
    questionCount: String(payload.questionCount || 'all'),
    totalQuestions: payload.totalQuestions || 0,
    duration: payload.duration || 0,
    status: 'started',
  });

  return attempt.save();
};

module.exports = {
  startTestAttempt,
};
