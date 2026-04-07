const mongoose = require('mongoose');
const TestAttempt = require('../models/testAttempt');
const QuestionBank = require('../models/questionBank');
const ApiError = require('../errors/apiError');
const aiCurationService = require('./aiCurationService');

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

const sanitizeAssetsForRef = (assets = []) =>
  (Array.isArray(assets) ? assets : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        kind: String(item.kind || 'image').trim(),
        url: String(item.url || '').trim(),
        alt: String(item.alt || '').trim(),
        width: Number.isFinite(Number(item.width)) ? Number(item.width) : null,
        height: Number.isFinite(Number(item.height)) ? Number(item.height) : null,
        caption: String(item.caption || '').trim(),
        sourcePage: Number.isFinite(Number(item.sourcePage)) ? Number(item.sourcePage) : null,
      };
    })
    .filter((item) => item && item.url)
    .slice(0, 8);

const sanitizeQuestionRef = (question = {}) => {
  const rawId = String(question.id || '').trim();
  const sourceQuestionId = mongoose.isValidObjectId(rawId) ? rawId : '';
  const keepFallbackContent = !sourceQuestionId;

  return {
    sourceQuestionId,
    id: rawId,
    type: String(question.type || 'mcq').trim(),
    difficulty: String(question.difficulty || 'medium').trim(),
    question: String(question.question || '').trim(),
    section: String(question.section || '').trim(),
    topic: String(question.topic || '').trim(),
    groupType: String(question.groupType || 'none').trim(),
    groupId: String(question.groupId || '').trim(),
    groupTitle: String(question.groupTitle || '').trim(),
    passageText: keepFallbackContent ? String(question.passageText || '').trim() : '',
groupOrder: (Number.isFinite(Number(question.groupOrder)) && Number(question.groupOrder) >= 1) ? Number(question.groupOrder) : null,
    hasVisual: Boolean(question.hasVisual),
    assets: keepFallbackContent ? sanitizeAssetsForRef(question.assets) : [],
    options: Array.isArray(question.options) ? question.options.map((item) => String(item)).slice(0, 5) : [],
    answer: String(question.answer || '').trim(),
    explanation: keepFallbackContent ? String(question.explanation || '').trim() : '',
    inputOutput: keepFallbackContent ? String(question.inputOutput || '').trim() : '',
    solutionApproach: keepFallbackContent ? String(question.solutionApproach || '').trim() : '',
    sampleSolution: keepFallbackContent ? String(question.sampleSolution || '').trim() : '',
    complexity: keepFallbackContent ? String(question.complexity || '').trim() : '',
    code: keepFallbackContent ? String(question.code || '').trim() : '',
    expectedOutput: keepFallbackContent ? String(question.expectedOutput || '').trim() : '',
    idealSolution: keepFallbackContent ? String(question.idealSolution || '').trim() : '',
    keyConsiderations: keepFallbackContent && Array.isArray(question.keyConsiderations)
      ? question.keyConsiderations.map((item) => String(item))
      : [],
  };
};

const sanitizeQuestionRefs = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((item) => sanitizeQuestionRef(item))
    .filter((item) => item.sourceQuestionId || item.question);

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
    questionRefs: sanitizeQuestionRefs(plain.questionRefs),
    sectionPlan: sanitizeSectionPlan(plain.sectionPlan),
  };
};

const selectQuestionFieldsForHydration =
  '_id type difficulty question section topic groupType groupId groupTitle passageText groupOrder hasVisual assets options answer explanation inputOutput solutionApproach sampleSolution complexity code expectedOutput idealSolution keyConsiderations';

const mapQuestionRefToFallbackQuestion = (ref = {}) =>
  sanitizeQuestion({
    id: String(ref.id || ref.sourceQuestionId || '').trim(),
    type: ref.type,
    difficulty: ref.difficulty,
    question: ref.question,
    section: ref.section,
    topic: ref.topic,
    groupType: ref.groupType,
    groupId: ref.groupId,
    groupTitle: ref.groupTitle,
    passageText: ref.passageText,
    groupOrder: ref.groupOrder,
    hasVisual: ref.hasVisual,
    assets: ref.assets,
    options: ref.options,
    answer: ref.answer,
    explanation: ref.explanation,
    inputOutput: ref.inputOutput,
    solutionApproach: ref.solutionApproach,
    sampleSolution: ref.sampleSolution,
    complexity: ref.complexity,
    code: ref.code,
    expectedOutput: ref.expectedOutput,
    idealSolution: ref.idealSolution,
    keyConsiderations: ref.keyConsiderations,
  });

const hydrateQuestionsFromRefs = async (questionRefs = []) => {
  const refs = sanitizeQuestionRefs(questionRefs);
  if (refs.length === 0) return [];

  const sourceIds = Array.from(
    new Set(
      refs
        .map((item) => String(item.sourceQuestionId || '').trim())
        .filter((item) => mongoose.isValidObjectId(item))
    )
  );

  const hydratedMap = new Map();
  if (sourceIds.length > 0) {
    const rows = await QuestionBank.find({ _id: { $in: sourceIds } })
      .select(selectQuestionFieldsForHydration)
      .lean();

    rows.forEach((row) => {
      hydratedMap.set(String(row._id), row);
    });
  }

  return refs
    .map((ref) => {
      const sourceId = String(ref.sourceQuestionId || '').trim();
      if (sourceId && hydratedMap.has(sourceId)) {
        const row = hydratedMap.get(sourceId) || {};
        return sanitizeQuestion({
          id: String(ref.id || sourceId),
          type: ref.type || row.type,
          difficulty: ref.difficulty || row.difficulty,
          question: row.question || ref.question || '',
          section: ref.section || row.section || '',
          topic: ref.topic || row.topic || '',
          groupType: ref.groupType || row.groupType || 'none',
          groupId: ref.groupId || row.groupId || '',
          groupTitle: ref.groupTitle || row.groupTitle || '',
          passageText: row.passageText || ref.passageText || '',
          groupOrder: Number.isFinite(Number(ref.groupOrder)) ? Number(ref.groupOrder) : row.groupOrder,
          hasVisual: Boolean(ref.hasVisual || row.hasVisual),
          assets: Array.isArray(row.assets) && row.assets.length > 0 ? row.assets : ref.assets,
          options: Array.isArray(ref.options) && ref.options.length > 0 ? ref.options : row.options,
          answer: ref.answer || row.answer || '',
          explanation: row.explanation || ref.explanation || '',
          inputOutput: row.inputOutput || ref.inputOutput || '',
          solutionApproach: row.solutionApproach || ref.solutionApproach || '',
          sampleSolution: row.sampleSolution || ref.sampleSolution || '',
          complexity: row.complexity || ref.complexity || '',
          code: row.code || ref.code || '',
          expectedOutput: row.expectedOutput || ref.expectedOutput || '',
          idealSolution: row.idealSolution || ref.idealSolution || '',
          keyConsiderations:
            Array.isArray(row.keyConsiderations) && row.keyConsiderations.length > 0
              ? row.keyConsiderations
              : ref.keyConsiderations,
        });
      }

      return mapQuestionRefToFallbackQuestion(ref);
    })
    .filter((item) => item.question);
};

const resolvedTotalQuestionsFromPayload = (payload, questions = []) => {
  if (questions.length > 0) return questions.length;
  if (Number(payload.totalQuestions || 0) > 0) return Number(payload.totalQuestions);
  return String(payload.questionCount || '').trim().toLowerCase() === 'all'
    ? 0
    : Number(payload.questionCount || 0) || 0;
};

const startTestAttempt = async (payload, userId) => {
  let questions = sanitizeQuestions(payload.questions);
  const hadInputQuestions = questions.length > 0;
  const sectionPlan = sanitizeSectionPlan(payload.sectionPlan);
  let estimatedDurationMinutes = Number(payload.duration || 0);
  let curationStatus = 'skipped';

  if (questions.length === 0) {
    try {
      const curated = await aiCurationService.curateQuestions({
        payload: {
          testId: payload.testId || '',
          testTitle: payload.testTitle,
          domain: payload.domain || '',
          difficulty: payload.difficulty || 'all',
          topics: payload.topics || [],
          questionStyles: payload.questionStyles || [],
          questionCount: payload.questionCount || 'all',
          totalQuestions: Number(payload.totalQuestions || 0),
          attemptMode: payload.attemptMode || 'exam',
          promptContext: payload.promptContext || '',
        },
        provider: payload.provider,
        userId,
      });

      questions = sanitizeQuestions(curated?.questions || []);
      estimatedDurationMinutes = Number(curated?.estimatedDurationMinutes || estimatedDurationMinutes);
      curationStatus = 'completed';
    } catch (error) {
      curationStatus = 'failed';
    }
  }
  const questionRefs = sanitizeQuestionRefs(questions);

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
    paperQuestions: [],
    questionRefs,
    sectionPlan,
  });

  const savedAttempt = sanitizeStoredAttempt(await attempt.save());
  const responseAttempt = { ...savedAttempt };
  delete responseAttempt.questionRefs;

  return {
    ...responseAttempt,
    curatedQuestions: hadInputQuestions ? [] : questions,
    estimatedDurationMinutes,
    curationStatus,
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

const getTestAttempt = async (attemptId, userId, options = {}) => {
  const attempt = await getAttemptOrThrow(attemptId, userId);
  const sanitized = sanitizeStoredAttempt(attempt);
  const hydrate = options && options.hydrate !== false;
  const fallbackQuestions = sanitized.questionRefs
    .map((item) => mapQuestionRefToFallbackQuestion(item))
    .filter((item) => item.question);
  const hydratedQuestions = sanitized.paperQuestions.length > 0
    ? sanitized.paperQuestions
    : hydrate
      ? await hydrateQuestionsFromRefs(sanitized.questionRefs)
      : fallbackQuestions;

  const { questionRefs, ...rest } = sanitized;
  return {
    ...rest,
    paperQuestions: hydratedQuestions,
  };
};

const completeTestAttempt = async (payload, userId) => {
  const attempt = await getAttemptOrThrow(payload.attemptId, userId);
  const questions = sanitizeQuestions(payload.questions);
  const questionRefs = sanitizeQuestionRefs(questions);
  const sectionPlan = sanitizeSectionPlan(payload.sectionPlan);
  const now = new Date();

  if (questionRefs.length > 0) {
    attempt.paperQuestions = [];
    attempt.questionRefs = questionRefs;
    attempt.totalQuestions = questionRefs.length;
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

  const savedAttempt = sanitizeStoredAttempt(await attempt.save());
  const responseAttempt = { ...savedAttempt };
  delete responseAttempt.questionRefs;
  return responseAttempt;
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
