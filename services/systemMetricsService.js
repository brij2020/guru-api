const User = require('../models/user');
const QuestionBank = require('../models/questionBank');
const QuestionReviewAudit = require('../models/questionReviewAudit');
const AiGenerationJob = require('../models/aiGenerationJob');
const MockPaper = require('../models/mockPaper');

const getSystemMetrics = async () => {
  const [
    totalUsers,
    totalAdmins,
    totalQuestions,
    draftQuestions,
    approvedQuestions,
    reviewedQuestions,
    rejectedQuestions,
    totalPapers,
    totalReviewEvents,
    queuedJobs,
    runningJobs,
    failedJobs,
    completedJobs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'admin' }),
    QuestionBank.countDocuments({}),
    QuestionBank.countDocuments({ reviewStatus: 'draft' }),
    QuestionBank.countDocuments({ reviewStatus: 'approved' }),
    QuestionBank.countDocuments({ reviewStatus: 'reviewed' }),
    QuestionBank.countDocuments({ reviewStatus: 'rejected' }),
    MockPaper.countDocuments({}),
    QuestionReviewAudit.countDocuments({}),
    AiGenerationJob.countDocuments({ status: 'queued' }),
    AiGenerationJob.countDocuments({ status: 'running' }),
    AiGenerationJob.countDocuments({ status: 'failed' }),
    AiGenerationJob.countDocuments({ status: 'completed' }),
  ]);

  return {
    users: {
      total: totalUsers,
      admins: totalAdmins,
      learners: Math.max(0, totalUsers - totalAdmins),
    },
    questionBank: {
      total: totalQuestions,
      draft: draftQuestions,
      reviewed: reviewedQuestions,
      approved: approvedQuestions,
      rejected: rejectedQuestions,
      reviewEvents: totalReviewEvents,
    },
    papers: {
      total: totalPapers,
    },
    aiJobs: {
      queued: queuedJobs,
      running: runningJobs,
      failed: failedJobs,
      completed: completedJobs,
    },
  };
};

module.exports = {
  getSystemMetrics,
};
