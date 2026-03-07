const crypto = require('crypto');
const QuestionBank = require('../models/questionBank');

const TYPE_ALIASES = {
  coding: 'coding',
  code: 'coding',
  'problem-solving': 'coding',
  'problem solving': 'coding',
  algorithmic: 'coding',
  mcq: 'mcq',
  multiplechoice: 'mcq',
  'multiple-choice': 'mcq',
  theory: 'theory',
  conceptual: 'theory',
  output: 'output',
  'output-based': 'output',
  outputbased: 'output',
  io: 'output',
  scenario: 'scenario',
  situational: 'scenario',
  case: 'scenario',
};

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const DEFAULT_PULL_COUNT = 20;
const MAX_PULL_COUNT = 100;

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeQuestionType = (value) => {
  const key = normalizeText(value).toLowerCase().replace(/\s+/g, '-');
  return TYPE_ALIASES[key] || 'mcq';
};

const normalizeDifficulty = (value) => {
  const key = normalizeText(value).toLowerCase();
  if (DIFFICULTIES.has(key)) return key;
  return 'medium';
};

const normalizeList = (values) => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
};

const buildFingerprint = (questionText, type) => {
  const normalized = `${normalizeQuestionType(type)}::${normalizeText(questionText).toLowerCase()}`;
  return crypto.createHash('sha1').update(normalized).digest('hex');
};

const toQuestionBankDoc = (question, payload, ownerId, sourceAttemptId, provider) => {
  const questionText = normalizeText(question?.question || question?.questionText || question?.prompt);
  if (!questionText) return null;

  const type = normalizeQuestionType(question?.type);
  const difficulty = normalizeDifficulty(question?.difficulty || payload?.difficulty);
  const topic = normalizeText(question?.topic || question?.category || question?.subtopic);
  const options = Array.isArray(question?.options)
    ? question.options.map((item) => normalizeText(item)).filter(Boolean).slice(0, 4)
    : [];
  const tags = normalizeList([...(payload?.topics || []), topic, ...(payload?.questionStyles || [])]);

  return {
    owner: ownerId,
    sourceAttempt: sourceAttemptId || null,
    provider: normalizeText(provider),
    testId: normalizeText(payload?.testId),
    testTitle: normalizeText(payload?.testTitle),
    domain: normalizeText(payload?.domain),
    difficulty,
    type,
    topic,
    tags,
    promptContext: normalizeText(payload?.promptContext),
    question: questionText,
    options,
    answer: normalizeText(question?.answer || question?.correctAnswer || question?.expectedAnswer),
    explanation: normalizeText(question?.explanation || question?.rationale),
    inputOutput: normalizeText(question?.inputOutput),
    solutionApproach: normalizeText(question?.solutionApproach),
    sampleSolution: normalizeText(question?.sampleSolution),
    complexity: normalizeText(question?.complexity),
    keyConsiderations: normalizeList(question?.keyConsiderations),
    fingerprint: buildFingerprint(questionText, type),
    lastUsedAt: new Date(),
  };
};

const ingestQuestions = async ({ ownerId, sourceAttemptId, payload, provider, questions }) => {
  if (!ownerId || !Array.isArray(questions) || questions.length === 0) {
    return { insertedOrUpdated: 0 };
  }

  const docs = questions
    .map((question) => toQuestionBankDoc(question, payload, ownerId, sourceAttemptId, provider))
    .filter(Boolean);

  if (docs.length === 0) return { insertedOrUpdated: 0 };

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { owner: doc.owner, fingerprint: doc.fingerprint },
      update: {
        $setOnInsert: doc,
        $set: {
          lastUsedAt: doc.lastUsedAt,
          provider: doc.provider,
          domain: doc.domain,
          testId: doc.testId,
          testTitle: doc.testTitle,
          difficulty: doc.difficulty,
          type: doc.type,
          topic: doc.topic,
          tags: doc.tags,
          promptContext: doc.promptContext,
          answer: doc.answer,
          explanation: doc.explanation,
          options: doc.options,
          inputOutput: doc.inputOutput,
          solutionApproach: doc.solutionApproach,
          sampleSolution: doc.sampleSolution,
          complexity: doc.complexity,
          keyConsiderations: doc.keyConsiderations,
          sourceAttempt: sourceAttemptId || null,
        },
        $inc: { timesSeen: 1 },
      },
      upsert: true,
    },
  }));

  const result = await QuestionBank.bulkWrite(operations, { ordered: false });
  const upserts = Array.isArray(result?.upsertedIds) ? result.upsertedIds.length : Object.keys(result?.upsertedIds || {}).length;
  const modified = Number(result?.modifiedCount || 0);
  return {
    insertedOrUpdated: upserts + modified,
  };
};

const buildTypeFilters = (styles) => {
  const normalized = normalizeList(styles)
    .map((item) => normalizeQuestionType(item))
    .filter(Boolean);
  if (normalized.length === 0) return [];
  return Array.from(new Set(normalized));
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildTopicMatch = (topics) => {
  if (!Array.isArray(topics) || topics.length === 0) return null;
  const regexList = topics
    .map((topic) => normalizeText(topic))
    .filter(Boolean)
    .map((topic) => new RegExp(escapeRegex(topic), 'i'));
  if (regexList.length === 0) return null;
  return {
    $or: [{ topic: { $in: regexList } }, { tags: { $in: regexList } }],
  };
};

const sampleQuestions = async (query, count) => {
  return QuestionBank.aggregate([
    { $match: query },
    { $sample: { size: count } },
    {
      $project: {
        _id: 0,
        id: '$_id',
        type: 1,
        difficulty: 1,
        topic: 1,
        question: 1,
        options: 1,
        answer: 1,
        explanation: 1,
        inputOutput: 1,
        solutionApproach: 1,
        sampleSolution: 1,
        complexity: 1,
        keyConsiderations: 1,
      },
    },
  ]);
};

const pullSimilarQuestions = async ({ ownerId, filters = {} }) => {
  const countRaw = Number(filters.questionCount || filters.count || DEFAULT_PULL_COUNT);
  const count = Math.min(MAX_PULL_COUNT, Math.max(1, Number.isFinite(countRaw) ? Math.floor(countRaw) : DEFAULT_PULL_COUNT));
  const difficulty = normalizeText(filters.difficulty).toLowerCase();
  const domain = normalizeText(filters.domain);
  const topics = normalizeList(filters.topics);
  const typeFilters = buildTypeFilters(filters.questionStyles);
  const baseQuery = { owner: ownerId };
  const strictQuery = { ...baseQuery };
  const wideQuery = { ...baseQuery };
  const broadQuery = { ...baseQuery };

  if (domain) {
    const domainRegex = new RegExp(escapeRegex(domain), 'i');
    strictQuery.domain = domainRegex;
    wideQuery.domain = domainRegex;
  }

  if (DIFFICULTIES.has(difficulty)) {
    strictQuery.difficulty = difficulty;
    broadQuery.difficulty = difficulty;
  }

  if (typeFilters.length > 0) {
    strictQuery.type = { $in: typeFilters };
    wideQuery.type = { $in: typeFilters };
    broadQuery.type = { $in: typeFilters };
  }

  const topicMatch = buildTopicMatch(topics);
  if (topicMatch) {
    Object.assign(strictQuery, topicMatch);
    Object.assign(wideQuery, topicMatch);
  }

  const queryCandidates = [strictQuery, wideQuery, broadQuery, baseQuery];
  let matches = [];
  let matchedBy = 'none';

  for (const query of queryCandidates) {
    matches = await sampleQuestions(query, count);
    if (matches.length > 0) {
      matchedBy = JSON.stringify(query);
      break;
    }
  }

  return {
    questions: matches,
    count: matches.length,
    matchedBy,
  };
};

module.exports = {
  ingestQuestions,
  pullSimilarQuestions,
};
