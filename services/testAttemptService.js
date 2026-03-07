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
  const allowFallback =
    process.env.NODE_ENV === 'test' || payload?.allowFallback === true;

  let curatedQuestions = [];
  let estimatedDurationMinutes = 0;
  try {
    const curated = await aiCurationService.curateQuestions({
      payload,
      provider: payload.provider,
    });
    curatedQuestions = Array.isArray(curated?.questions) ? curated.questions : [];
    estimatedDurationMinutes = Number(curated?.estimatedDurationMinutes) > 0
      ? Math.round(Number(curated.estimatedDurationMinutes))
      : 0;
  } catch (error) {
    if (!allowFallback) {
      throw new ApiError(
        error?.statusCode || 502,
        `AI curation failed: ${error?.message || 'Unable to generate questions from provider'}`
      );
    }
    curatedQuestions = buildFallbackQuestions(payload);
  }

  const resolvedTotalQuestions =
    curatedQuestions.length > 0 ? curatedQuestions.length : payload.totalQuestions || 0;

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

  try {
    await questionBankService.ingestQuestions({
      ownerId: userId,
      sourceAttemptId: savedAttempt._id,
      payload,
      provider: payload.provider || '',
      questions: curatedQuestions,
    });
  } catch (error) {
    // Question bank ingestion should not block test start flow.
  }

  return {
    ...savedAttempt.toObject(),
    curatedQuestions,
    estimatedDurationMinutes,
  };
};

module.exports = {
  startTestAttempt,
};
