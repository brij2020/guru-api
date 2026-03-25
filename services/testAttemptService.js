const TestAttempt = require('../models/testAttempt');
const aiCurationService = require('./aiCurationService');
const questionBankService = require('./questionBankService');
const ApiError = require('../errors/apiError');

const DEFAULT_QUESTION_COUNT = 20;
const TYPE_FALLBACK = ['mcq', 'theory', 'coding', 'output', 'scenario'];

const normalizeCount = (value) => {
  if (String(value || '').trim().toLowerCase() === 'all') return DEFAULT_QUESTION_COUNT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_QUESTION_COUNT;
  return Math.min(Math.floor(parsed), 100);
};

const buildFallbackQuestions = (payload) => {
  const normalized = aiCurationService._internal.normalizeInput(payload);
  const questionCount = normalized.questionCount || normalizeCount(payload.questionCount);
  const topics = normalized.topics.length > 0 ? normalized.topics : ['general'];
  const difficulties = ['easy', 'medium', 'hard'];
  const activeTypes = Object.keys(normalized.typePlan || {});
  const plannedTypes = activeTypes.length > 0 ? activeTypes : TYPE_FALLBACK;

  const plannedSequence = [];
  for (const type of plannedTypes) {
    const count = normalized.typePlan?.[type] || 0;
    for (let i = 0; i < count; i += 1) {
      plannedSequence.push(type);
    }
  }

  while (plannedSequence.length < questionCount) {
    plannedSequence.push(TYPE_FALLBACK[plannedSequence.length % TYPE_FALLBACK.length]);
  }

  return plannedSequence.slice(0, questionCount).map((type, index) => {
    const topic = topics[index % topics.length];
    const difficulty = difficulties[index % difficulties.length];
    const base = {
      id: `q${index + 1}`,
      type,
      difficulty,
      topic,
      question: `[Fallback] ${normalized.testTitle || 'Mock Test'} - ${topic} - Q${index + 1}`,
      answer: `Model answer for ${topic} (${type})`,
      explanation: `Fallback explanation for ${type} question ${index + 1}.`,
      options: [],
    };

    if (type === 'mcq' || type === 'output') {
      base.options = [
        `Option A (${topic})`,
        `Option B (${topic})`,
        `Option C (${topic})`,
        `Option D (${topic})`,
      ];
      base.answer = base.options[0];
    }

    if (type === 'coding') {
      base.inputOutput = `Input: ${topic}, Output: expected result`;
      base.solutionApproach = 'Break down the problem and optimize for readability.';
      base.sampleSolution = '// sample solution';
      base.complexity = 'O(n)';
    }

    return base;
  });
};

const startTestAttempt = async (payload, userId) => {
  console.log('[Service] startTestAttempt called with userId:', userId);
  console.log('[Service] Payload:', JSON.stringify(payload, null, 2));
  
  const allowFallback =
    process.env.NODE_ENV === 'test' || payload?.allowFallback === true;
  const skipCuration = payload?.skipCuration === true;

  let curatedQuestions = [];
  let estimatedDurationMinutes = 0;
  let curationError = null;
  let questionBankEmptyWarning = '';
  
  if (!skipCuration) {
    try {
      const curated = await aiCurationService.curateQuestions({
        payload,
        provider: payload.provider,
      });
      curatedQuestions = Array.isArray(curated?.questions) ? curated.questions : [];
      estimatedDurationMinutes = Number(curated?.estimatedDurationMinutes) > 0
        ? Math.round(Number(curated.estimatedDurationMinutes))
        : 0;
        
      // Check if questions were returned
      if (curatedQuestions.length === 0) {
        curationError = new ApiError(503, 'No questions available. Question bank is empty.');
      }
    } catch (error) {
      console.error('[Service] AI curation failed:', error?.message);
      curationError = error;
      const errorMessage = String(error?.message || '');
      const isQuestionBankEmpty =
        errorMessage.includes('empty') || errorMessage.includes('Question bank');
      
      if (!allowFallback) {
        if (isQuestionBankEmpty) {
          questionBankEmptyWarning =
            'Question bank is empty. Please add questions through the admin panel.';
        } else {
          throw new ApiError(
            error?.statusCode || 502,
            errorMessage || 'Unable to generate questions. Please try again later.'
          );
        }
      }
      if (allowFallback) {
        curatedQuestions = buildFallbackQuestions(payload);
      }
    }
  } else {
    console.log('[Service] skipCuration=true, creating attempt without AI curation.');
  }

  const resolvedTotalQuestions =
    curatedQuestions.length > 0 ? curatedQuestions.length : payload.totalQuestions || 0;

  // Don't create test attempt if no questions available
  if (resolvedTotalQuestions === 0 && !allowFallback && !questionBankEmptyWarning) {
    throw new ApiError(503, 'No questions available. Question bank is empty.');
  }

  const attempt = new TestAttempt({
    owner: userId,
    testId: payload.testId || '',
    testTitle: payload.testTitle,
    domain: payload.domain || '',
    difficulty: payload.difficulty || 'all',
    topics: payload.topics || [],
    questionStyles: payload.questionStyles || [],
    questionCount: String(payload.questionCount || 'all'),
    totalQuestions: resolvedTotalQuestions,
    duration: payload.duration || estimatedDurationMinutes || 0,
    status: 'started',
  });

  const savedAttempt = await attempt.save();
  console.log('[Service] TestAttempt created with _id:', savedAttempt._id);

  try {
    await questionBankService.ingestQuestions({
      ownerId: userId,
      sourceAttemptId: savedAttempt._id,
      payload,
      provider: payload.provider || '',
      questions: curatedQuestions,
    });
  } catch (error) {
    console.error('[Service] Question bank ingestion failed (non-blocking):', error?.message);
  }

  const result = {
    ...savedAttempt.toObject(),
    curatedQuestions,
    estimatedDurationMinutes,
    warning: questionBankEmptyWarning || undefined,
    curationStatus: questionBankEmptyWarning ? 'empty_question_bank' : 'ok',
  };
  console.log('[Service] startTestAttempt returning:', JSON.stringify(result, null, 2));
  
  return result;
};

const completeTestAttempt = async (attemptId, userId, resultData) => {
  console.log('[Service] completeTestAttempt called with attemptId:', attemptId, 'userId:', userId);
  console.log('[Service] resultData:', JSON.stringify(resultData, null, 2));
  
  const attempt = await TestAttempt.findOne({ _id: attemptId, owner: userId });
  
  if (!attempt) {
    console.error('[Service] Test attempt not found for attemptId:', attemptId, 'userId:', userId);
    throw new ApiError(404, 'Test attempt not found');
  }
  
  console.log('[Service] Found attempt:', JSON.stringify(attempt, null, 2));
  
  if (attempt.status === 'completed') {
    console.warn('[Service] Test attempt already completed:', attemptId);
    throw new ApiError(400, 'Test attempt already completed');
  }
  
  attempt.status = 'completed';
  attempt.completedAt = new Date();
  attempt.autoSubmitted = resultData.autoSubmitted || false;
  
  // Score metrics
  attempt.score = resultData.score;
  attempt.percentage = resultData.percentage;
  attempt.correctCount = resultData.correctCount;
  attempt.incorrectCount = resultData.incorrectCount;
  attempt.unattemptedCount = resultData.unattemptedCount;
  attempt.attemptedCount = resultData.attemptedCount;
  
  // Time metrics
  attempt.timeSpent = resultData.timeSpent;
  
  // Breakdown data
  if (resultData.sectionScores && resultData.sectionScores.length > 0) {
    attempt.sectionScores = resultData.sectionScores;
  }
  if (resultData.difficultyBreakdown && resultData.difficultyBreakdown.length > 0) {
    attempt.difficultyBreakdown = resultData.difficultyBreakdown;
  }
  if (resultData.typeBreakdown && resultData.typeBreakdown.length > 0) {
    attempt.typeBreakdown = resultData.typeBreakdown;
  }
  
  await attempt.save();
  console.log('[Service] Test attempt saved successfully:', attempt._id);
  
  return attempt;
};

const getTestAttemptsByUser = async (userId, options = {}) => {
  const { status, limit = 50, skip = 0 } = options;
  
  const query = { owner: userId };
  if (status) {
    query.status = status;
  }
  
  const attempts = await TestAttempt.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const total = await TestAttempt.countDocuments(query);
  
  return {
    attempts,
    total,
    count: attempts.length,
  };
};

module.exports = {
  startTestAttempt,
  completeTestAttempt,
  getTestAttemptsByUser,
};
