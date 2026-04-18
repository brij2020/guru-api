const studyPlanSchedulerService = require('../services/studyPlanSchedulerService');
const User = require('../models/user');
const { assembleWeeklyTest } = require('../services/questionPaperAssemblerService');

exports.triggerWeeklyTestGeneration = async (req, res) => {
  try {
    const { lockDay } = req.query;
    const targetLockDay = lockDay === 'friday' || lockDay === 'saturday' ? lockDay : 'friday';
    
    const results = await studyPlanSchedulerService.processAllUsersForLockDay(targetLockDay);
    
    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success && !r.skipped).length;
    
    res.status(200).json({
      success: true,
      lockDay: targetLockDay,
      summary: {
        total: results.length,
        generated: successCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error) {
    console.error('Error in triggerWeeklyTestGeneration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateForUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('[generateForUser] userId:', userId, 'req.user:', req.user);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized - no user ID' });
    }
    
    const { lockDay, examSlug, stageSlug, sectionsWithTopics } = req.body || {};
    
    const user = await User.findById(userId).lean();
    const targetLockDay =
      lockDay === 'friday' || lockDay === 'saturday'
        ? lockDay
        : (user?.preferences?.lockDay || 'friday');
    const targetExamSlug = String(examSlug || user?.preferences?.examSlug || 'ssc-cgl').trim().toLowerCase();
    const targetStageSlug = String(stageSlug || user?.preferences?.stageSlug || 'tier-1').trim().toLowerCase();
    
    const result = await studyPlanSchedulerService.generateWeeklyTest(
      userId,
      targetLockDay,
      targetExamSlug,
      targetStageSlug,
      { sectionsWithTopics }
    );
    
    if (result.success) {
      res.status(200).json({ success: true, data: result.test, paperId: result.paperId });
    } else if (result.skipped) {
      res.status(200).json({
        success: true,
        skipped: true,
        reason: result.reason,
        message: result.reason === 'already_generated' 
          ? 'Weekly test already generated for this period'
          : 'No topics found in your study schedule for this week',
      });
    } else {
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assembleWeeklyTest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { examSlug, stageSlug, topics, questionCount } = req.body;
    
    console.log('[assembleWeeklyTest Controller]', { userId, examSlug, stageSlug, topics, questionCount });
    
    const result = await assembleWeeklyTest({
      ownerId: userId,
      examSlug: examSlug || 'ssc-cgl',
      stageSlug: stageSlug || 'tier-1',
      topics: topics || [],
      questionCount: questionCount || 50
    });
    
    res.status(200).json({
      success: true,
      paperId: result.paper?.paperId,
      totalQuestions: result.paper?.servedQuestions || 0,
      diagnostics: result.diagnostics
    });
  } catch (error) {
    console.error('Error in assembleWeeklyTest:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserWeeklyTests = async (req, res) => {
  try {
    const userId = req.user.id;
    const tests = await studyPlanSchedulerService.getUserWeeklyTests(userId);
    
    res.status(200).json({ success: true, data: tests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWeeklyTestById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;
    
    const test = await studyPlanSchedulerService.getWeeklyTestById(userId, testId);
    
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }
    
    res.status(200).json({ success: true, data: test });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWeekInfo = async (req, res) => {
  try {
    const { lockDay } = req.query;
    const targetLockDay = lockDay === 'friday' || lockDay === 'saturday' ? lockDay : 'friday';
    
    const bounds = studyPlanSchedulerService.getWeekBounds(targetLockDay);
    
    res.status(200).json({
      success: true,
      data: {
        lockDay: targetLockDay,
        weekStart: bounds.weekStart,
        weekEnd: bounds.weekEnd,
        lockDate: bounds.lockDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
