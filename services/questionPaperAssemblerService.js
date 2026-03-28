const QuestionBank = require('../models/questionBank');
const QuestionBankUsage = require('../models/questionBankUsage');
const MockPaper = require('../models/mockPaper');
const ApiError = require('../errors/apiError');
const aiCurationService = require('./aiCurationService');
const questionBankService = require('./questionBankService');
const paperBlueprintService = require('./paperBlueprintService');
const {
  questionBankMode,
  questionAssemblyMode,
  questionBankRecentExcludeCount,
  questionBankApprovedOnly,
} = require('../config/env');

const DEFAULT_TOTAL_QUESTIONS = 100;
const DEFAULT_DIFFICULTY_MIX = { easy: 0.3, medium: 0.5, hard: 0.2 };
const SUPPORTED_TYPES = new Set(['mcq', 'output', 'theory', 'coding', 'scenario']);
const AI_TOPUP_CHUNK_SIZE = 20;
const MIN_RC_GROUP_SIZE = 2;

const BLUEPRINTS = {
  'ssc-cgl:tier-1': {
    totalQuestions: 100,
    sections: [
      { key: 'general-intelligence-reasoning', label: 'General Intelligence & Reasoning', count: 25 },
      { key: 'general-awareness', label: 'General Awareness', count: 25 },
      { key: 'quantitative-aptitude', label: 'Quantitative Aptitude', count: 25 },
      { key: 'english-comprehension', label: 'English Comprehension', count: 25 },
    ],
    difficultyMix: DEFAULT_DIFFICULTY_MIX,
  },
  'sbi-clerk:prelims': {
    totalQuestions: 100,
    sections: [
      { key: 'english-language', label: 'English Language', count: 30 },
      { key: 'numerical-ability', label: 'Numerical Ability', count: 35 },
      { key: 'reasoning-ability', label: 'Reasoning Ability', count: 35 },
    ],
    difficultyMix: DEFAULT_DIFFICULTY_MIX,
  },
  'rrb-ntpc:cbt-1': {
    totalQuestions: 100,
    sections: [
      { key: 'general-awareness', label: 'General Awareness', count: 40 },
      { key: 'mathematics', label: 'Mathematics', count: 30 },
      { key: 'general-intelligence-reasoning', label: 'General Intelligence & Reasoning', count: 30 },
    ],
    difficultyMix: DEFAULT_DIFFICULTY_MIX,
  },
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeQuestionKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildServeStatusConstraint = () => (questionBankApprovedOnly ? { reviewStatus: 'approved' } : {});

const toCompactPromptContext = (payload) => {
  const exam = normalizeText(payload.examSlug || payload.domain || 'Government Exam');
  const stage = normalizeText(payload.stageSlug || 'stage');
  const goal = normalizeText(payload.goalSlug || 'mock test');
  const plan = normalizeText(payload.planId || 'default plan');
  const styles = Array.isArray(payload.questionStyles) ? payload.questionStyles.join(', ') : 'MCQ';
  const topics = Array.isArray(payload.topics) ? payload.topics.join(', ') : '';
  const pieces = [
    `Create realistic ${exam} (${stage}) ${goal} questions.`,
    `Plan: ${plan}.`,
    `Styles: ${styles || 'MCQ'}.`,
    topics ? `Topics: ${topics}.` : '',
    'Keep questions concise with plausible options and clear answer.',
  ].filter(Boolean);
  return pieces.join(' ').slice(0, 600);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeQuestionType = (values) => {
  if (!Array.isArray(values) || values.length === 0) return ['mcq'];
  const normalized = Array.from(
    new Set(
      values
        .map((value) => normalizeText(value).toLowerCase())
        .map((value) => {
          if (value.includes('mcq') || value.includes('single') || value.includes('statement') || value.includes('assertion')) {
            return 'mcq';
          }
          if (value.includes('output') || value === 'io') return 'output';
          if (value.includes('theory')) return 'theory';
          if (value.includes('coding') || value.includes('problem-solving')) return 'coding';
          if (value.includes('scenario')) return 'scenario';
          return 'mcq';
        })
        .filter((value) => SUPPORTED_TYPES.has(value))
    )
  );

  return normalized.length > 0 ? normalized : ['mcq'];
};

const getBlueprint = (examSlug, stageSlug) => BLUEPRINTS[`${examSlug}:${stageSlug}`] || null;

const isGovContextPayload = (payload = {}) => {
  const testId = normalizeText(payload.testId || '').toLowerCase();
  const domain = normalizeText(payload.domain || '').toLowerCase();
  const examSlug = normalizeText(payload.examSlug || '').toLowerCase();
  return (
    testId.startsWith('gov-') ||
    domain.includes('government exam') ||
    /(ssc|upsc|rrb|ibps|sbi)/.test(examSlug)
  );
};

const buildDifficultyTargets = (count, difficultyMix) => {
  const easy = Math.floor(count * (difficultyMix.easy || 0));
  const medium = Math.floor(count * (difficultyMix.medium || 0));
  const hard = Math.floor(count * (difficultyMix.hard || 0));
  let allocated = easy + medium + hard;
  const targets = { easy, medium, hard };

  while (allocated < count) {
    targets.medium += 1;
    allocated += 1;
  }

  return targets;
};

const scaleSectionsToTotal = (sections, totalQuestions) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [{ key: 'mixed', label: 'Mixed', count: totalQuestions }];
  }
  const sourceTotal = sections.reduce((sum, section) => sum + Number(section.count || 0), 0);
  if (sourceTotal <= 0) {
    return [{ key: 'mixed', label: 'Mixed', count: totalQuestions }];
  }
  if (sourceTotal === totalQuestions) {
    return sections.map((section) => ({
      key: section.key,
      label: section.label,
      count: Number(section.count || 0),
    }));
  }

  const scaled = sections.map((section) => {
    const raw = (Number(section.count || 0) / sourceTotal) * totalQuestions;
    return {
      key: section.key,
      label: section.label,
      count: Math.max(0, Math.floor(raw)),
      remainder: raw - Math.floor(raw),
    };
  });

  let allocated = scaled.reduce((sum, section) => sum + section.count, 0);
  while (allocated < totalQuestions) {
    scaled.sort((a, b) => b.remainder - a.remainder);
    for (const section of scaled) {
      if (allocated >= totalQuestions) break;
      section.count += 1;
      allocated += 1;
    }
  }

  return scaled.map(({ key, label, count }) => ({ key, label, count }));
};

const toProjectedQuestion = (question) => ({
  id: String(question._id || question.id || ''),
  type: question.type,
  difficulty: question.difficulty,
  section: question.section || '',
  groupType: question.groupType || 'none',
  groupId: question.groupId || '',
  groupTitle: question.groupTitle || '',
  passageText: question.passageText || '',
  groupOrder: question.groupOrder || null,
  topic: question.topic,
  questionNumber: question.questionNumber || null,
  source: question.source || {},
  question: question.question,
  options: question.options || [],
  optionObjects: question.optionObjects || [],
  hasVisual: Boolean(question.hasVisual),
  assets: Array.isArray(question.assets) ? question.assets : [],
  answer: question.answer || '',
  answerKey: question.answerKey || '',
  explanation: question.explanation || '',
  inputOutput: question.inputOutput || '',
  code: question.code || '',
  expectedOutput: question.expectedOutput || '',
  idealSolution: question.idealSolution || '',
  solutionApproach: question.solutionApproach || '',
  sampleSolution: question.sampleSolution || '',
  complexity: question.complexity || '',
  keyConsiderations: Array.isArray(question.keyConsiderations) ? question.keyConsiderations : [],
});

const bindQuestionToSection = (question, sectionLabel, sectionKey = '') => ({
  ...question,
  // Only assign section if question doesn't already have one from DB
  section: normalizeText(question?.section || sectionKey || sectionLabel || ''),
  topic: normalizeText(question?.topic || sectionLabel || sectionKey || ''),
});

const bindQuestionsByBlueprintRanges = (questions = [], sections = []) => {
  if (!Array.isArray(questions) || questions.length === 0 || !Array.isArray(sections) || sections.length === 0) {
    return Array.isArray(questions) ? questions : [];
  }

  const ranges = [];
  let cursor = 0;
  for (const section of sections) {
    const count = Math.max(0, Number(section?.count || 0));
    if (count <= 0) continue;
    ranges.push({
      start: cursor,
      end: cursor + count,
      label: normalizeText(section?.label || section?.key || ''),
      key: normalizeText(section?.key || ''),
    });
    cursor += count;
  }
  if (ranges.length === 0) return questions;

  return questions.map((question, index) => {
    if (normalizeText(question?.section || '')) {
      return question;
    }
    const range = ranges.find((row) => index >= row.start && index < row.end) || ranges[ranges.length - 1];
    return bindQuestionToSection(question, range?.label, range?.key);
  });
};

const isRcGroupedQuestion = (question) =>
  String(question?.groupType || '').toLowerCase() === 'rc_passage' &&
  normalizeText(question?.groupId);

const hasValidRcContext = (question) =>
  isRcGroupedQuestion(question) &&
  normalizeText(question?.passageText || '').length > 0;

const toQuestionId = (question) => String(question?._id || question?.id || '');

const sortRcGroupRows = (rows = []) =>
  [...rows].sort((a, b) => {
    const orderA = Number(a?.groupOrder || 0);
    const orderB = Number(b?.groupOrder || 0);
    if (orderA > 0 || orderB > 0) return orderA - orderB;
    const qNoA = Number(a?.questionNumber || 0);
    const qNoB = Number(b?.questionNumber || 0);
    if (qNoA > 0 || qNoB > 0) return qNoA - qNoB;
    return String(a?._id || a?.id || '').localeCompare(String(b?._id || b?.id || ''));
  });

const packWithoutBreakingRcGroups = (questions = [], targetCount = 0) => {
  if (!Array.isArray(questions) || questions.length === 0 || targetCount <= 0) return [];
  const packed = [];
  const seenIds = new Set();
  const seenGroups = new Set();

  for (const question of questions) {
    const id = toQuestionId(question);
    if (!id || seenIds.has(id)) continue;

    const groupId = normalizeText(question?.groupId || '');
    const isRc = hasValidRcContext(question);
    if (!isRc || !groupId) {
      if (packed.length >= targetCount) continue;
      packed.push(question);
      seenIds.add(id);
      continue;
    }

    if (seenGroups.has(groupId)) continue;
    const block = sortRcGroupRows(
      questions.filter((row) => hasValidRcContext(row) && normalizeText(row?.groupId || '') === groupId)
    ).filter((row) => {
      const rowId = toQuestionId(row);
      return rowId && !seenIds.has(rowId);
    });

    if (block.length < MIN_RC_GROUP_SIZE) continue;
    const canFit = packed.length + block.length <= targetCount;
    if (!canFit && packed.length > 0) continue;

    for (const row of block) {
      const rowId = toQuestionId(row);
      if (!rowId || seenIds.has(rowId)) continue;
      packed.push(row);
      seenIds.add(rowId);
    }
    seenGroups.add(groupId);
  }

  return packed;
};

const sampleFromPool = async ({ query, size, usedIds }) => {
  if (size <= 0) return [];
  const serveStatusConstraint = buildServeStatusConstraint();
  const pipeline = [{ $match: { ...query, ...serveStatusConstraint } }];

  if (usedIds.size > 0) {
    pipeline.push({
      $match: {
        _id: { $nin: Array.from(usedIds) },
      },
    });
  }

  pipeline.push({ $sample: { size } });
  return QuestionBank.aggregate(pipeline);
};

const getRecentExcludedIds = async ({ ownerId, examSlug, stageSlug, limit }) => {
  if (!ownerId || limit <= 0) {
    return { excludedQuestionIds: new Set(), excludedGroupIds: new Set() };
  }
  const query = { owner: ownerId };
  if (examSlug) query.examSlug = examSlug;
  if (stageSlug) query.stageSlug = stageSlug;

  const rows = await QuestionBankUsage.find(query)
    .sort({ lastServedAt: -1 })
    .limit(limit)
    .select('questionBankId groupId')
    .lean();

  return {
    excludedQuestionIds: new Set(rows.map((row) => String(row.questionBankId)).filter(Boolean)),
    excludedGroupIds: new Set(rows.map((row) => normalizeText(row.groupId)).filter(Boolean)),
  };
};

const trackServedQuestions = async ({ ownerId, examSlug, stageSlug, questions }) => {
  if (!ownerId || !Array.isArray(questions) || questions.length === 0) return;
  const now = new Date();
  const ops = questions
    .map((question) => ({
      id: String(question?.id || ''),
      groupId: normalizeText(question?.groupId || ''),
    }))
    .filter((item) => /^[a-fA-F0-9]{24}$/.test(item.id))
    .map((item) => ({
    updateOne: {
      filter: { owner: ownerId, questionBankId: item.id },
      update: {
        $set: {
          lastServedAt: now,
          examSlug: examSlug || '',
          stageSlug: stageSlug || '',
          groupId: item.groupId,
        },
        $inc: { timesServed: 1 },
      },
      upsert: true,
    },
  }));
  if (ops.length === 0) return;
  await QuestionBankUsage.bulkWrite(ops, { ordered: false });
};

const buildOwnerQueries = ({
  ownerId,
  examSlug,
  stageSlug,
  domainRegex,
  typeFilters,
  sectionRegex,
  topicRegexes,
  difficulty,
}) => {
  const base = {};
  if (ownerId) base.owner = ownerId;
  if (examSlug) base.examSlug = examSlug;
  if (stageSlug) base.stageSlug = stageSlug;

  const strict = { ...base, type: { $in: typeFilters }, difficulty };
  const medium = { ...base, type: { $in: typeFilters }, difficulty };
  const broad = { ...base, type: { $in: typeFilters }, difficulty };
  const fallback = { ...base, type: { $in: typeFilters } };

  if (domainRegex) {
    strict.domain = domainRegex;
    medium.domain = domainRegex;
  }

  const topicOr = [];
  if (sectionRegex) {
    topicOr.push({ section: sectionRegex }, { topic: sectionRegex }, { tags: { $in: [sectionRegex] } });
  }
  if (Array.isArray(topicRegexes) && topicRegexes.length > 0) {
    topicOr.push({ topic: { $in: topicRegexes } }, { tags: { $in: topicRegexes } });
  }

  if (topicOr.length > 0) {
    strict.$or = topicOr;
    medium.$or = topicOr;
  }

  return [strict, medium, broad, fallback, base];
};

const pullFromQueries = async ({
  queries,
  targetCount,
  usedIds,
  usedQuestionKeys,
  excludedGroupIds = new Set(),
  selectedGroupIds = new Set(),
  rcGroupCache = new Map(),
}) => {
  const selected = [];
  let matchedTier = 'none';

  for (let i = 0; i < queries.length; i += 1) {
    if (selected.length >= targetCount) break;
    const missing = targetCount - selected.length;
    const candidates = await sampleFromPool({
      query: queries[i],
      size: missing,
      usedIds,
    });

    if (candidates.length > 0 && matchedTier === 'none') {
      matchedTier = `tier_${i + 1}`;
    }

    for (const candidate of candidates) {
      const id = String(candidate._id);
      const questionKey = normalizeQuestionKey(candidate?.question || '');
      if (usedIds.has(id)) continue;
      if (questionKey && usedQuestionKeys.has(questionKey)) continue;
      if (hasValidRcContext(candidate)) {
        const groupId = normalizeText(candidate?.groupId || '');
        if (!groupId) continue;
        if (excludedGroupIds.has(groupId) || selectedGroupIds.has(groupId)) continue;

        const owner = candidate?.owner || null;
        const cacheKey = `${String(owner || '')}::${normalizeText(candidate?.examSlug)}::${normalizeText(
          candidate?.stageSlug
        )}::${groupId}`;
        let groupRows = rcGroupCache.get(cacheKey);
        if (!groupRows) {
          const serveStatusConstraint = buildServeStatusConstraint();
          groupRows = await QuestionBank.find({
            ...(owner ? { owner } : {}),
            examSlug: candidate?.examSlug || '',
            stageSlug: candidate?.stageSlug || '',
            groupType: 'rc_passage',
            groupId,
            ...serveStatusConstraint,
          }).lean();
          rcGroupCache.set(cacheKey, groupRows);
        }

        const validGroupRows = sortRcGroupRows(groupRows || []).filter((row) => {
          if (!hasValidRcContext(row)) return false;
          const rowId = String(row?._id || '');
          if (!rowId || usedIds.has(rowId)) return false;
          const rowKey = normalizeQuestionKey(row?.question || '');
          if (rowKey && usedQuestionKeys.has(rowKey)) return false;
          return true;
        });

        if (validGroupRows.length < MIN_RC_GROUP_SIZE) continue;
        for (const row of validGroupRows) {
          const rowId = String(row?._id || '');
          const rowKey = normalizeQuestionKey(row?.question || '');
          usedIds.add(rowId);
          if (rowKey) usedQuestionKeys.add(rowKey);
          selected.push(row);
        }
        selectedGroupIds.add(groupId);
      } else {
        usedIds.add(id);
        if (questionKey) usedQuestionKeys.add(questionKey);
        selected.push(candidate);
      }
      if (selected.length >= targetCount) break;
    }
  }

  return { selected, matchedTier };
};

const topUpWithAI = async ({
  ownerId,
  payload,
  missingCount,
  existingQuestions,
  sectionContext = null,
}) => {
  if (missingCount <= 0) {
    return { aiQuestions: [], aiTopupCount: 0 };
  }

  const topics = Array.isArray(payload.topics) ? payload.topics : [];
  const sectionTopics = sectionContext
    ? [sectionContext.label, sectionContext.key].filter(Boolean)
    : [];
  const dedupe = new Set(
    existingQuestions
      .map((item) => normalizeQuestionKey(item.question))
      .filter(Boolean)
  );
  const allAiQuestions = [];
  let remaining = missingCount;
  const maxIterations = Math.max(1, Math.ceil(missingCount / AI_TOPUP_CHUNK_SIZE) + 2);
  let iterations = 0;

  while (remaining > 0 && iterations < maxIterations) {
    iterations += 1;
    const requestCount = Math.min(AI_TOPUP_CHUNK_SIZE, remaining);
    const aiPayload = {
      testId: normalizeText(payload.testId) || `gov-${normalizeText(payload.examSlug)}-${normalizeText(payload.stageSlug)}-topup`,
      testTitle: normalizeText(payload.testTitle) || `${normalizeText(payload.examSlug)} ${normalizeText(payload.stageSlug)} Mock`,
      domain: normalizeText(payload.domain),
      difficulty: normalizeText(payload.difficulty || 'medium').toLowerCase(),
      topics: Array.from(new Set([...topics, ...sectionTopics])),
      questionStyles: Array.isArray(payload.questionStyles) ? payload.questionStyles : ['mcq'],
      questionCount: requestCount,
      attemptMode: 'exam',
      promptContext: sectionContext
        ? `${toCompactPromptContext(payload)} Focus section: ${sectionContext.label} (${sectionContext.key}).`
        : toCompactPromptContext(payload),
      examSlug: normalizeText(payload.examSlug).toLowerCase(),
      stageSlug: normalizeText(payload.stageSlug).toLowerCase(),
    };

    const curated = await aiCurationService.curateQuestions({
      payload: aiPayload,
      provider: payload.provider || 'openai',
    });

    const aiQuestionsRaw = Array.isArray(curated?.questions) ? curated.questions : [];
    const aiQuestions = aiQuestionsRaw.map((item) => ({
      ...item,
      section: sectionContext?.key || sectionContext?.label || item?.section || '',
      topic: item?.topic || sectionContext?.label || item?.topic || '',
    }));

    if (aiQuestions.length > 0) {
      await questionBankService.ingestQuestions({
        ownerId,
        sourceAttemptId: null,
        payload: aiPayload,
        provider: payload.provider || 'openai',
        questions: aiQuestions,
      });
    }

    let acceptedInChunk = 0;
    for (const item of aiQuestions) {
      const key = normalizeQuestionKey(item?.question);
      if (!key || dedupe.has(key)) continue;
      dedupe.add(key);
      allAiQuestions.push(item);
      acceptedInChunk += 1;
      if (allAiQuestions.length >= missingCount) break;
    }

    if (acceptedInChunk === 0) {
      break;
    }
    remaining = missingCount - allAiQuestions.length;
  }

  const filtered = allAiQuestions.slice(0, missingCount);

  return {
    aiQuestions: filtered,
    aiTopupCount: filtered.length,
  };
};

const topUpFromDbFinalPass = async ({
  ownerId,
  examSlug,
  stageSlug,
  typeFilters,
  targetCount,
  existingQuestions,
  allowGlobalFallback = false,
  rcGroupCache = new Map(),
}) => {
  if (!Array.isArray(existingQuestions) || existingQuestions.length >= targetCount) {
    return { questions: existingQuestions || [], topupCount: 0, usedGlobal: false };
  }

  const serveStatusConstraint = buildServeStatusConstraint();
  const selected = [...existingQuestions];
  const selectedIds = new Set(selected.map((q) => String(q?.id || '')).filter(Boolean));
  const selectedKeys = new Set(
    selected.map((q) => normalizeQuestionKey(q?.question || '')).filter(Boolean)
  );
  const selectedGroupIds = new Set(
    selected.map((q) => normalizeText(q?.groupId || '')).filter(Boolean)
  );

  const pushSingle = (row) => {
    const projected = toProjectedQuestion(row);
    const id = String(projected?.id || '');
    const key = normalizeQuestionKey(projected?.question || '');
    if (!id || selectedIds.has(id)) return false;
    if (key && selectedKeys.has(key)) return false;
    selected.push(projected);
    selectedIds.add(id);
    if (key) selectedKeys.add(key);
    const groupId = normalizeText(projected?.groupId || '');
    if (groupId) selectedGroupIds.add(groupId);
    return true;
  };

  const pushRcGroup = async (seedRow) => {
    const groupId = normalizeText(seedRow?.groupId || '');
    if (!groupId || selectedGroupIds.has(groupId)) return 0;
    const ownerKey = seedRow?.owner || null;
    const cacheKey = `${String(ownerKey || '')}::${normalizeText(seedRow?.examSlug)}::${normalizeText(
      seedRow?.stageSlug
    )}::${groupId}`;
    let groupRows = rcGroupCache.get(cacheKey);
    if (!groupRows) {
      groupRows = [];
      rcGroupCache.set(cacheKey, groupRows);
    }
    if (groupRows.length === 0) {
      groupRows = await QuestionBank.find({
        ...(ownerKey ? { owner: ownerKey } : {}),
        examSlug: seedRow?.examSlug || '',
        stageSlug: seedRow?.stageSlug || '',
        groupType: 'rc_passage',
        groupId,
        ...serveStatusConstraint,
      }).lean();
      rcGroupCache.set(cacheKey, groupRows);
    }

    const validRows = sortRcGroupRows(groupRows).filter((row) => {
      if (!hasValidRcContext(row)) return false;
      const id = String(row?._id || '');
      if (!id || selectedIds.has(id)) return false;
      const key = normalizeQuestionKey(row?.question || '');
      if (key && selectedKeys.has(key)) return false;
      return true;
    });

    if (validRows.length < MIN_RC_GROUP_SIZE) return 0;
    if (selected.length + validRows.length > targetCount) return 0;

    let added = 0;
    for (const row of validRows) {
      if (pushSingle(row)) added += 1;
    }
    if (added > 0) selectedGroupIds.add(groupId);
    return added;
  };

  const queryTiers = [
    {
      query: {
        owner: ownerId,
        examSlug,
        stageSlug,
        type: { $in: typeFilters },
      },
      scope: 'owner',
    },
    {
      query: {
        owner: ownerId,
        examSlug,
        stageSlug,
      },
      scope: 'owner',
    },
  ];

  if (allowGlobalFallback) {
    queryTiers.push(
      {
        query: {
          examSlug,
          stageSlug,
          type: { $in: typeFilters },
        },
        scope: 'global',
      },
      {
        query: {
          examSlug,
          stageSlug,
        },
        scope: 'global',
      }
    );
  }

  let usedGlobal = false;
  for (const tier of queryTiers) {
    if (selected.length >= targetCount) break;
    const missing = targetCount - selected.length;
    const sampleSize = Math.min(300, Math.max(missing * 8, 40));
    const candidates = await QuestionBank.aggregate([
      {
        $match: {
          ...tier.query,
          ...serveStatusConstraint,
          _id: { $nin: Array.from(selectedIds) },
        },
      },
      { $sample: { size: sampleSize } },
    ]);

    for (const candidate of candidates) {
      if (selected.length >= targetCount) break;
      if (hasValidRcContext(candidate)) {
        // eslint-disable-next-line no-await-in-loop
        const added = await pushRcGroup(candidate);
        if (added > 0 && tier.scope === 'global') usedGlobal = true;
        continue;
      }
      const addedSingle = pushSingle(candidate);
      if (addedSingle && tier.scope === 'global') usedGlobal = true;
    }
  }

  return {
    questions: selected,
    topupCount: Math.max(0, selected.length - existingQuestions.length),
    usedGlobal,
  };
};

const savePaperSnapshot = async ({ ownerId, payload, paper, diagnostics, sourceBreakdown }) => {
  const snapshot = await MockPaper.create({
    owner: ownerId,
    examSlug: normalizeText(payload.examSlug).toLowerCase(),
    stageSlug: normalizeText(payload.stageSlug).toLowerCase(),
    goalSlug: normalizeText(payload.goalSlug).toLowerCase(),
    planId: normalizeText(payload.planId).toLowerCase(),
    title: normalizeText(payload.testTitle) || `${normalizeText(payload.examSlug)} ${normalizeText(payload.stageSlug)} Mock`,
    requestedQuestions: Number(paper.totalQuestions || 0),
    servedQuestions: Number(paper.servedQuestions || 0),
    sectionPlan: Array.isArray(paper.sectionPlan) ? paper.sectionPlan : [],
    questionIds: Array.isArray(paper.questions) ? paper.questions.map((q) => String(q.id || '')).filter(Boolean) : [],
    sourceBreakdown,
    diagnostics,
    promptContext: normalizeText(payload.promptContext),
  });

  return String(snapshot._id);
};

const assemblePaper = async ({ ownerId, payload }) => {
  const examSlug = normalizeText(payload.examSlug).toLowerCase();
  const stageSlug = normalizeText(payload.stageSlug).toLowerCase();
  const dbBlueprint = await paperBlueprintService.getActiveBlueprint(examSlug, stageSlug);
  const staticBlueprint = getBlueprint(examSlug, stageSlug);
  const blueprint = dbBlueprint
    ? {
        examStageQuestions: dbBlueprint.examStageQuestions,
        totalQuestions: dbBlueprint.totalQuestions,
        sections: dbBlueprint.sections,
        difficultyMix: dbBlueprint.difficultyMix,
      }
    : staticBlueprint;
  const typeFilters = normalizeQuestionType(payload.questionStyles);
  const requestedCount = Number(payload.questionCount);
  const totalQuestions = Number.isFinite(requestedCount) && requestedCount > 0
    ? Math.floor(requestedCount)
    : blueprint?.totalQuestions || DEFAULT_TOTAL_QUESTIONS;
  const difficultyMix = blueprint?.difficultyMix || DEFAULT_DIFFICULTY_MIX;
  const sections = Array.isArray(blueprint?.sections) && blueprint.sections.length > 0
    ? blueprint.sections
    : [{ key: 'mixed', label: 'Mixed', count: totalQuestions }];
  const effectiveSections = scaleSectionsToTotal(sections, totalQuestions);

  const topics = Array.isArray(payload.topics)
    ? payload.topics.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const topicRegexes = topics.map((topic) => new RegExp(escapeRegex(topic), 'i'));
  const domain = normalizeText(payload.domain);
  const domainRegex = domain ? new RegExp(escapeRegex(domain), 'i') : null;
  const assemblyMode = (payload.assemblyMode || questionAssemblyMode || 'flex').toLowerCase() === 'strict'
    ? 'strict'
    : 'flex';

  const sectionPlan = [];
  const selectedQuestions = [];
  const usedIds = new Set();
  const usedQuestionKeys = new Set();
  const selectedGroupIds = new Set();
  const rcGroupCache = new Map();
  let aiTopupCount = 0;
  const diagnostics = {
    mode: questionBankMode,
    assemblyMode,
    blueprintSource: dbBlueprint ? 'database' : staticBlueprint ? 'static' : 'fallback',
    perSection: [],
    scope: 'owner',
  };

  const scopedBaseQuery = {};
  if (examSlug) scopedBaseQuery.examSlug = examSlug;
  if (stageSlug) scopedBaseQuery.stageSlug = stageSlug;

  const serveStatusConstraint = buildServeStatusConstraint();
  const ownerPoolCount = await QuestionBank.countDocuments({ owner: ownerId, ...scopedBaseQuery, ...serveStatusConstraint });
  const globalPoolCount = await QuestionBank.countDocuments({ ...scopedBaseQuery, ...serveStatusConstraint });
  const canUseGlobalFallback =
    globalPoolCount > ownerPoolCount &&
    (questionBankMode === 'hybrid' || (questionBankMode === 'db_first' && ownerPoolCount === 0));
  diagnostics.ownerPoolCount = ownerPoolCount;
  diagnostics.globalPoolCount = globalPoolCount;
  diagnostics.approvedOnly = questionBankApprovedOnly;

  const recentExcludeLimitRaw = Number(payload.recentExclusionCount || questionBankRecentExcludeCount || 0);
  const recentExcludeLimit = Math.max(0, Number.isFinite(recentExcludeLimitRaw) ? Math.floor(recentExcludeLimitRaw) : 0);
  const { excludedQuestionIds: recentExcludedIds, excludedGroupIds: recentExcludedGroupIds } = await getRecentExcludedIds({
    ownerId,
    examSlug,
    stageSlug,
    limit: recentExcludeLimit,
  });
  for (const id of recentExcludedIds) usedIds.add(String(id));
  for (const groupId of recentExcludedGroupIds) selectedGroupIds.add(String(groupId));

  for (const section of effectiveSections) {
    const sectionCount = Number(section.count) || 0;
    const targets = buildDifficultyTargets(sectionCount, difficultyMix);
    const sectionPattern = [String(section.key || ''), String(section.label || '')]
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .map((value) => escapeRegex(value))
      .join('|');
    const sectionRegex = sectionPattern ? new RegExp(sectionPattern, 'i') : null;
    const sectionCollected = [];
    const tierHits = [];

    for (const difficulty of ['easy', 'medium', 'hard']) {
      const target = targets[difficulty];
      if (target <= 0) continue;

      const queries = buildOwnerQueries({
        ownerId,
        examSlug,
        stageSlug,
        domainRegex,
        typeFilters,
        sectionRegex,
        topicRegexes,
        difficulty,
      });

      const { selected, matchedTier } = await pullFromQueries({
        queries,
        targetCount: target,
        usedIds,
        usedQuestionKeys,
        excludedGroupIds: recentExcludedGroupIds,
        selectedGroupIds,
        rcGroupCache,
      });

      let finalSelected = selected;
      let finalMatchedTier = matchedTier;
      if (
        finalSelected.length < target &&
        canUseGlobalFallback
      ) {
        const globalQueries = buildOwnerQueries({
          ownerId: null,
          examSlug,
          stageSlug,
          domainRegex,
          typeFilters,
          sectionRegex,
          topicRegexes,
          difficulty,
        });
        const globalResult = await pullFromQueries({
          queries: globalQueries,
          targetCount: target - finalSelected.length,
          usedIds,
          usedQuestionKeys,
          excludedGroupIds: recentExcludedGroupIds,
          selectedGroupIds,
          rcGroupCache,
        });
        finalSelected = finalSelected.concat(globalResult.selected);
        finalMatchedTier =
          finalMatchedTier === 'none'
            ? `global_${globalResult.matchedTier}`
            : `${finalMatchedTier}+global_${globalResult.matchedTier}`;
        diagnostics.scope = 'global';
      }
      sectionCollected.push(...finalSelected);
      tierHits.push({ difficulty, target, got: finalSelected.length, matchedTier: finalMatchedTier });
    }

    if (sectionCollected.length < sectionCount) {
      const topUpQueries = buildOwnerQueries({
        ownerId,
        examSlug,
        stageSlug,
        domainRegex,
        typeFilters,
        sectionRegex,
        topicRegexes,
        difficulty: 'medium',
      });
      const missing = sectionCount - sectionCollected.length;
      const { selected, matchedTier } = await pullFromQueries({
        queries: topUpQueries,
        targetCount: missing,
        usedIds,
        usedQuestionKeys,
        excludedGroupIds: recentExcludedGroupIds,
        selectedGroupIds,
        rcGroupCache,
      });
      let topupSelected = selected;
      let topupMatchedTier = matchedTier;
      if (
        topupSelected.length < missing &&
        canUseGlobalFallback
      ) {
        const globalTopupQueries = buildOwnerQueries({
          ownerId: null,
          examSlug,
          stageSlug,
          domainRegex,
          typeFilters,
          sectionRegex,
          topicRegexes,
          difficulty: 'medium',
        });
        const globalTopup = await pullFromQueries({
          queries: globalTopupQueries,
          targetCount: missing - topupSelected.length,
          usedIds,
          usedQuestionKeys,
          excludedGroupIds: recentExcludedGroupIds,
          selectedGroupIds,
          rcGroupCache,
        });
        topupSelected = topupSelected.concat(globalTopup.selected);
        topupMatchedTier =
          topupMatchedTier === 'none'
            ? `global_${globalTopup.matchedTier}`
            : `${topupMatchedTier}+global_${globalTopup.matchedTier}`;
        diagnostics.scope = 'global';
      }
      sectionCollected.push(...topupSelected);
      tierHits.push({ difficulty: 'topup', target: missing, got: topupSelected.length, matchedTier: topupMatchedTier });
    }

    if (assemblyMode === 'flex' && sectionCollected.length < sectionCount) {
      const flexQueries = buildOwnerQueries({
        ownerId,
        examSlug,
        stageSlug,
        domainRegex,
        typeFilters,
        sectionRegex: null,
        topicRegexes: [],
        difficulty: 'medium',
      });
      const missing = sectionCount - sectionCollected.length;
      const { selected, matchedTier } = await pullFromQueries({
        queries: flexQueries,
        targetCount: missing,
        usedIds,
        usedQuestionKeys,
        excludedGroupIds: recentExcludedGroupIds,
        selectedGroupIds,
        rcGroupCache,
      });
      let flexSelected = selected;
      let flexMatchedTier = matchedTier;

      if (flexSelected.length < missing && canUseGlobalFallback) {
        const globalFlexQueries = buildOwnerQueries({
          ownerId: null,
          examSlug,
          stageSlug,
          domainRegex,
          typeFilters,
          sectionRegex: null,
          topicRegexes: [],
          difficulty: 'medium',
        });
        const globalFlex = await pullFromQueries({
          queries: globalFlexQueries,
          targetCount: missing - flexSelected.length,
          usedIds,
          usedQuestionKeys,
          excludedGroupIds: recentExcludedGroupIds,
          selectedGroupIds,
          rcGroupCache,
        });
        flexSelected = flexSelected.concat(globalFlex.selected);
        flexMatchedTier =
          flexMatchedTier === 'none'
            ? `global_${globalFlex.matchedTier}`
            : `${flexMatchedTier}+global_${globalFlex.matchedTier}`;
        diagnostics.scope = 'global';
      }

      sectionCollected.push(...flexSelected);
      tierHits.push({ difficulty: 'flex_topup', target: missing, got: flexSelected.length, matchedTier: flexMatchedTier });
    }

    let finalSectionQuestions = packWithoutBreakingRcGroups(sectionCollected, sectionCount);

    // AI section top-up: generate in 20-question chunks so providers with low per-call limits can still fill full tests.
    if (
      (questionBankMode === 'hybrid' || questionBankMode === 'ai_only') &&
      finalSectionQuestions.length < sectionCount
    ) {
      const sectionMissing = sectionCount - finalSectionQuestions.length;
      try {
        const { aiQuestions, aiTopupCount: sectionAiTopup } = await topUpWithAI({
          ownerId,
          payload,
          missingCount: sectionMissing,
          existingQuestions: finalSectionQuestions,
          sectionContext: {
            key: section.key,
            label: section.label,
          },
        });

        if (sectionAiTopup > 0) {
          finalSectionQuestions = packWithoutBreakingRcGroups(
            finalSectionQuestions.concat(aiQuestions.map(toProjectedQuestion)),
            sectionCount
          );
          aiTopupCount += sectionAiTopup;
        }
      } catch (error) {
        diagnostics.aiTopupError = normalizeText(error?.message || 'AI top-up failed');
      }
    }

    const sectionBoundQuestions = finalSectionQuestions.map((question) =>
      bindQuestionToSection(toProjectedQuestion(question), section.label, section.key)
    );
    selectedQuestions.push(...sectionBoundQuestions);
    sectionPlan.push({
      section: section.label,
      targetCount: sectionCount,
      servedCount: sectionBoundQuestions.length,
    });
    diagnostics.perSection.push({
      section: section.key,
      shortfall: Math.max(0, sectionCount - finalSectionQuestions.length),
      tierHits,
    });
  }

  const seenFinalKeys = new Set();
  let finalQuestions = selectedQuestions
    .map(toProjectedQuestion)
    .filter((question) => {
      const key = normalizeQuestionKey(question?.question || '');
      if (!key || seenFinalKeys.has(key)) return false;
      seenFinalKeys.add(key);
      return true;
    });
  finalQuestions = packWithoutBreakingRcGroups(finalQuestions, totalQuestions);
  const dbCount = finalQuestions.length;

  let finalDbTopupCount = 0;
  if (finalQuestions.length < totalQuestions && questionBankMode !== 'ai_only') {
    const dbTopup = await topUpFromDbFinalPass({
      ownerId,
      examSlug,
      stageSlug,
      typeFilters,
      targetCount: totalQuestions,
      existingQuestions: finalQuestions,
      allowGlobalFallback: canUseGlobalFallback,
      rcGroupCache,
    });
    finalQuestions = dbTopup.questions;
    finalDbTopupCount = dbTopup.topupCount;
    if (dbTopup.usedGlobal) diagnostics.scope = 'global';
  }

  if ((questionBankMode === 'hybrid' || questionBankMode === 'ai_only') && finalQuestions.length < totalQuestions) {
    const missingCount = totalQuestions - finalQuestions.length;
    try {
      const { aiQuestions, aiTopupCount: topupCount } = await topUpWithAI({
        ownerId,
        payload,
        missingCount,
        existingQuestions: finalQuestions,
      });
      aiTopupCount += topupCount;
      finalQuestions = packWithoutBreakingRcGroups(
        finalQuestions.concat(aiQuestions.map(toProjectedQuestion)),
        totalQuestions
      );
    } catch (error) {
      diagnostics.aiTopupError = normalizeText(error?.message || 'AI top-up failed');
    }
  }

  finalQuestions = bindQuestionsByBlueprintRanges(finalQuestions, effectiveSections);

  await trackServedQuestions({
    ownerId,
    examSlug,
    stageSlug,
    questions: finalQuestions,
  });

  diagnostics.recentExcludedCount = recentExcludedIds.size;
  diagnostics.recentExcludedGroupCount = recentExcludedGroupIds.size;
  diagnostics.finalServed = finalQuestions.length;
  diagnostics.dbCount = dbCount;
  diagnostics.finalDbTopupCount = finalDbTopupCount;
  diagnostics.aiTopupCount = aiTopupCount;

  const paper = {
    examSlug,
    stageSlug,
    examStageQuestions: blueprint.examStageQuestions || null,
    totalQuestions: totalQuestions,
    servedQuestions: finalQuestions.length,
    sectionPlan,
    questions: finalQuestions,
  };

  const paperId = await savePaperSnapshot({
    ownerId,
    payload,
    paper,
    diagnostics,
    sourceBreakdown: {
      dbCount,
      aiTopupCount,
    },
  });

  return {
    paper: {
      ...paper,
      paperId,
    },
    diagnostics,
  };
};

const assembleItPaper = async ({ ownerId, payload }) => {
  if (isGovContextPayload(payload)) {
    throw new ApiError(400, 'assemble-it-paper endpoint is only for non-government tests.');
  }
  return assemblePaper({ ownerId, payload });
};

module.exports = {
  assemblePaper,
  assembleItPaper,
  _internal: {
    getBlueprint,
    buildDifficultyTargets,
    normalizeQuestionType,
  },
};
