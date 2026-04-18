const StudyPlan = require('../models/studyPlan');
const User = require('../models/user');
const WeeklyTest = require('../models/weeklyTest');
const MockPaper = require('../models/mockPaper');
const { assembleWeeklyTest } = require('./weeklyTestAssemblerService');
const { notifyWeeklyTestReady } = require('./notificationService');

const LOCK_DAYS = {
  friday: 5,
  saturday: 6,
};

const getWeekBounds = (lockDay, referenceDate = new Date()) => {
  const now = new Date(referenceDate);
  const targetDay = LOCK_DAYS[lockDay] || LOCK_DAYS.friday;

  const lockDate = new Date(now);
  lockDate.setHours(0, 0, 0, 0);
  const daysSinceTarget = (lockDate.getDay() - targetDay + 7) % 7;
  lockDate.setDate(lockDate.getDate() - daysSinceTarget);

  // Calculate weekStart as Monday (day 1) of the week
  const dayOfWeek = lockDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(lockDate);
  weekStart.setDate(lockDate.getDate() - daysToMonday - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(lockDate);
  weekEnd.setDate(lockDate.getDate() + 2);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd, lockDate };
};

const collectTopicsFromPlans = async (userId, weekStart, weekEnd, examSlug = '', stageSlug = '') => {
  const query = {
    userId,
    date: { $gte: weekStart, $lte: weekEnd },
    isBreak: false,
  };

  // Use exam/stage-aware filtering for newly created plans.
  // Keep a fallback path for older rows that don't have these fields yet.
  if (examSlug) {
    query.$or = [
      { examSlug },
      { examSlug: { $exists: false } },
      { examSlug: '' },
    ];
  }
  if (stageSlug) {
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { stageSlug },
          { stageSlug: { $exists: false } },
          { stageSlug: '' },
        ],
      },
    ];
  }

  const plans = await StudyPlan.find(query).lean();
  
  const topicMap = new Map();
  
  for (const plan of plans) {
    const subject = String(plan.subject || '').trim();
    const topic = String(plan.topic || '').trim();
    if (!subject) continue;

    const normalizedSubject = subject.toLowerCase();
    const normalizedTopic = topic.toLowerCase();
    const key = `${normalizedSubject}:${normalizedTopic || '__no_topic__'}`;

    if (!topicMap.has(key)) {
      topicMap.set(key, {
        subject,
        topic: topic || subject,
        subjectId: plan.subjectId || null,
      });
    }
  }
  
  return Array.from(topicMap.values());
};

const normalizeProvidedTopics = (topics = []) => {
  if (!Array.isArray(topics)) return [];
  const dedupe = new Map();
  for (const item of topics) {
    const subject = String(item?.subject || '').trim();
    if (!subject) continue;
    const topic = String(item?.topic || '').trim() || subject;
    const key = `${subject.toLowerCase()}:${topic.toLowerCase()}`;
    if (!dedupe.has(key)) {
      dedupe.set(key, {
        subject,
        topic,
        subjectId: item?.subjectId || null,
      });
    }
  }
  return Array.from(dedupe.values());
};

const generateWeeklyTest = async (userId, lockDay = 'friday', examSlug = 'ssc-cgl', stageSlug = 'tier-1', payload = {}) => {
  console.log('=== [generateWeeklyTest] START ===');
  console.log('Input params - userId:', userId, 'lockDay:', lockDay, 'examSlug:', examSlug, 'stageSlug:', stageSlug);
  console.log('Payload sectionsWithTopics:', payload?.sectionsWithTopics?.length || 0);
  
  const { weekStart, weekEnd, lockDate } = getWeekBounds(lockDay);
  console.log('[generateWeeklyTest] Week bounds - lockDate:', lockDate);
  
  // Check if test already exists for this lockDate
  const existingTest = await WeeklyTest.findOne({
    userId: String(userId),
    lockDate: lockDate,
  }).lean();
  console.log('[generateWeeklyTest] existingTest check - lockDate:', lockDate.toISOString(), 'found:', !!existingTest);
  
  if (existingTest) {
    console.log('[generateWeeklyTest] SKIPPING - test already exists for this week');
    return { success: true, test: existingTest, skipped: true, reason: 'already_generated' };
  }
  
  const sectionsWithTopics = payload?.sectionsWithTopics || [];
  console.log('[generateWeeklyTest] sectionsWithTopics:', sectionsWithTopics.length, 'sections');
  
  if (sectionsWithTopics.length === 0) {
    console.log('[generateWeeklyTest] RETURN - No sectionsWithTopics');
    return { success: false, skipped: true, reason: 'no_topics' };
  }

  console.log('[generateWeeklyTest] Calling assembleWeeklyTest with:', { ownerId: userId, examSlug, stageSlug, sectionsWithTopicsCount: sectionsWithTopics.length });
  try {
    const result = await assembleWeeklyTest({
      ownerId: userId,
      examSlug,
      stageSlug,
      sectionsWithTopics,
      questionCount: 50
    });
    
    const allTopics = sectionsWithTopics.flatMap(s => (s.topics || []).map(t => ({
      subject: s.section,
      topic: t,
      subjectId: null,
    })));
    
    const weeklyTest = new WeeklyTest({
      userId,
      lockDate,
      weekStart,
      weekEnd,
      examSlug,
      stageSlug,
      topics: allTopics,
      paperId: result.paper?.paperId,
      totalQuestions: result.paper?.servedQuestions || 0,
      status: 'generated',
    });
    
    await weeklyTest.save();
    
    try {
      await notifyWeeklyTestReady(userId, weeklyTest._id, weekStart, {
        examSlug,
        stageSlug,
        paperId: weeklyTest.paperId,
        sections: sectionsWithTopics.map(s => s.section),
        redirectUrl: `/en/users/study-planner/test/${weeklyTest._id}`,
      });
      weeklyTest.status = 'notified';
      weeklyTest.notificationSent = true;
      weeklyTest.notificationSentAt = new Date();
      await weeklyTest.save();
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }
    
    return {
      success: true,
      test: weeklyTest,
      paperId: result.paper?.paperId,
      diagnostics: result.diagnostics,
    };
  } catch (error) {
    console.error('Error generating weekly test:', error);
    return { success: false, error: error.message };
  }
};

const processAllUsersForLockDay = async (lockDay = 'friday') => {
  const users = await User.find({
    'preferences.lockDay': lockDay,
  }).select('_id name email preferences').lean();
  
  const results = [];
  
  for (const user of users) {
    try {
      const examSlug = user.preferences?.examSlug || 'ssc-cgl';
      const stageSlug = user.preferences?.stageSlug || 'tier-1';
      const result = await generateWeeklyTest(user._id.toString(), lockDay, examSlug, stageSlug);
      results.push({
        userId: user._id.toString(),
        userName: user.name,
        ...result,
      });
    } catch (error) {
      results.push({
        userId: user._id.toString(),
        userName: user.name,
        success: false,
        error: error.message,
      });
    }
  }
  
  return results;
};

const getUserWeeklyTests = async (userId) => {
  return WeeklyTest.find({ userId })
    .sort({ lockDate: -1 })
    .limit(10)
    .lean();
};

const getWeeklyTestById = async (userId, testId) => {
  const test = await WeeklyTest.findOne({ _id: testId, userId }).lean();
  
  if (!test) {
    return null;
  }
  
  let questions = [];
  
  if (test.paperId) {
    const mockPaper = await MockPaper.findById(test.paperId).lean();
    if (mockPaper && mockPaper.questions) {
      questions = mockPaper.questions;
    }
  }
  
  return {
    _id: test._id,
    userId: test.userId,
    examSlug: test.examSlug,
    stageSlug: test.stageSlug,
    lockDate: test.lockDate,
    weekStart: test.weekStart,
    weekEnd: test.weekEnd,
    topics: test.topics,
    paperId: test.paperId,
    totalQuestions: test.totalQuestions,
    questions: questions,
    status: test.status,
    isCompleted: test.isCompleted,
    completedAt: test.completedAt,
    createdAt: test.createdAt,
  };
};

const markTestAsNotified = async (testId) => {
  return WeeklyTest.findByIdAndUpdate(testId, {
    notificationSent: true,
    notificationSentAt: new Date(),
  }, { new: true });
};

module.exports = {
  getWeekBounds,
  collectTopicsFromPlans,
  generateWeeklyTest,
  processAllUsersForLockDay,
  getUserWeeklyTests,
  getWeeklyTestById,
  markTestAsNotified,
};
