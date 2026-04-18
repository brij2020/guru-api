const QuestionBank = require('../models/questionBank');
const QuestionBankUsage = require('../models/questionBankUsage');
const MockPaper = require('../models/mockPaper');
const paperBlueprintService = require('./paperBlueprintService');
const aiCurationService = require('./aiCurationService');
const {
  questionBankMode,
  questionBankRecentExcludeCount,
  questionBankApprovedOnly,
} = require('../config/env');

const DEFAULT_TOTAL_QUESTIONS = 50;
const AI_TOPUP_CHUNK_SIZE = 20;

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildServeStatusConstraint = () => (questionBankApprovedOnly ? { reviewStatus: 'approved' } : {});

const sortRcGroupRows = (rows = []) =>
  [...rows].sort((a, b) => {
    const orderA = Number(a?.groupOrder || 0);
    const orderB = Number(b?.groupOrder || 0);
    if (orderA > 0 || orderB > 0) return orderA - orderB;
    return String(a?._id || a?.id || '').localeCompare(String(b?._id || b?.id || ''));
  });

const hasValidRcContext = (question) =>
  String(question?.groupType || '').toLowerCase() === 'rc_passage' &&
  normalizeText(question?.passageText || '').length > 0;

const toQuestionId = (question) => String(question?._id || question?.id || '');

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
  hasVisual: Boolean(question.hasVisual),
  assets: Array.isArray(question.assets) ? question.assets : [],
  answer: question.answer || '',
  answerKey: question.answerKey || '',
  explanation: question.explanation || '',
});

const sampleFromPool = async ({ query, size, usedIds }) => {
  if (size <= 0) return [];
  const serveStatusConstraint = buildServeStatusConstraint();
  const fullQuery = { ...query, ...serveStatusConstraint };
  
  console.log('[sampleFromPool] fullQuery:', JSON.stringify(fullQuery));
  
  const pipeline = [{ $match: fullQuery }];

  if (usedIds.size > 0) {
    pipeline.push({
      $match: {
        _id: { $nin: Array.from(usedIds) },
      },
    });
  }

  pipeline.push({ $sample: { size } });
  const results = await QuestionBank.aggregate(pipeline);
  console.log('[sampleFromPool] Requested:', size, 'Found:', results.length);
  return results;
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

    if (block.length < 2) continue;
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

const pullFromPool = async ({ query, size, usedIds, usedQuestionKeys, rcGroupCache }) => {
  const candidates = await sampleFromPool({ query, size, usedIds });
  const selected = [];

  for (const candidate of candidates) {
    const id = String(candidate._id);
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    selected.push(candidate);
  }

  return selected;
};

const assembleWeeklyTest = async ({ ownerId, examSlug, stageSlug, sectionsWithTopics, questionCount = 50 }) => {
  console.log('=== [weeklyTestAssembler] START ===');
  console.log('ownerId:', ownerId, 'examSlug:', examSlug, 'stageSlug:', stageSlug, 'sectionsCount:', sectionsWithTopics?.length);
  
  const effectiveExamSlug = normalizeText(examSlug || 'ssc-cgl').toLowerCase();
  const effectiveStageSlug = normalizeText(stageSlug || 'tier-1').toLowerCase();
  const totalQuestions = Math.min(Math.max(Number(questionCount) || 50, 1), 100);
  
  const sectionsData = Array.isArray(sectionsWithTopics) && sectionsWithTopics.length > 0
    ? sectionsWithTopics
    : [];

  if (sectionsData.length === 0) {
    console.log('[weeklyTestAssembler] No sectionsWithTopics provided');
    return { paper: { servedQuestions: 0 }, diagnostics: { reason: 'no_topics' } };
  }

  console.log(`[weeklyTestAssembler] Generating weekly test:`, {
    examSlug: effectiveExamSlug,
    stageSlug: effectiveStageSlug,
    sectionsData,
    totalQuestions
  });

  const diagnostics = {
    mode: questionBankMode,
    perSection: [],
  };

  const scopedBaseQuery = {};
  if (effectiveExamSlug) scopedBaseQuery.examSlug = effectiveExamSlug;
  if (effectiveStageSlug) scopedBaseQuery.stageSlug = effectiveStageSlug;

  const serveStatusConstraint = buildServeStatusConstraint();
  const ownerPoolCount = await QuestionBank.countDocuments({ owner: ownerId, ...scopedBaseQuery, ...serveStatusConstraint });
  const globalPoolCount = await QuestionBank.countDocuments({ ...scopedBaseQuery, ...serveStatusConstraint });
  const canUseGlobal = globalPoolCount > ownerPoolCount && questionBankMode !== 'ai_only';
  
  console.log(`[weeklyTestAssembler] Pool counts - Owner: ${ownerPoolCount}, Global: ${globalPoolCount}`);

  // Debug: Show sample questions from database
  const sampleQuestion = await QuestionBank.findOne(scopedBaseQuery).select('section topic examSlug stageSlug type difficulty').lean();
  console.log(`[weeklyTestAssembler] Sample question:`, JSON.stringify(sampleQuestion, null, 2));

  // Debug: Show all sections/topic values in DB
  const distinctSections = await QuestionBank.distinct('section', scopedBaseQuery);
  const distinctTopics = await QuestionBank.distinct('topic', scopedBaseQuery);
  console.log(`[weeklyTestAssembler] Distinct sections in DB:`, distinctSections);
  console.log(`[weeklyTestAssembler] Distinct topics in DB:`, distinctTopics.slice(0, 20));
  console.log(`[weeklyTestAssembler] questionBankMode:`, questionBankMode);
  console.log(`[weeklyTestAssembler] serveStatusConstraint:`, serveStatusConstraint);
  console.log(`[weeklyTestAssembler] ownerId:`, ownerId);

  const recentExcludeLimit = Math.max(0, Number(questionBankRecentExcludeCount) || 0);
  const { excludedQuestionIds: recentExcludedIds, excludedGroupIds: recentExcludedGroupIds } = await getRecentExcludedIds({
    ownerId,
    examSlug: effectiveExamSlug,
    stageSlug: effectiveStageSlug,
    limit: recentExcludeLimit,
  });

  const usedIds = new Set(recentExcludedIds);
  const usedGroupIds = new Set(recentExcludedGroupIds);
  const rcGroupCache = new Map();
  const selectedQuestions = [];
  const sectionPlan = [];

  const questionsPerSection = Math.floor(totalQuestions / sectionsData.length);
  const remainder = totalQuestions % sectionsData.length;

  for (let i = 0; i < sectionsData.length; i++) {
    const sectionItem = sectionsData[i];
    const sectionKey = normalizeText(sectionItem.section || '');
    const sectionTopics = (sectionItem.topics || []).map(t => normalizeText(t)).filter(Boolean);
    
    const sectionQuestionCount = questionsPerSection + (i < remainder ? 1 : 0);
    
    console.log(`[weeklyTestAssembler] Section: ${sectionKey}, Topics: ${sectionTopics}, Target: ${sectionQuestionCount}`);

    let sectionSelected = [];

    // Build query: match exam/stage/topic (NO owner check - students use global question bank)
    const baseQuery = { ...scopedBaseQuery, type: { $in: ['mcq'] }, difficulty: 'medium' };
    
    // Build OR conditions for section + topics
    let topicOrConditions = [];
    if (sectionKey) {
      topicOrConditions.push({ section: { $regex: sectionKey, $options: 'i' } });
    }
    for (const topic of sectionTopics) {
      topicOrConditions.push({ topic: { $regex: topic, $options: 'i' } });
      topicOrConditions.push({ tags: { $regex: topic, $options: 'i' } });
    }

    // Query 1: Global pool with section/topic match (no owner filter)
    if (topicOrConditions.length > 0) {
      const globalQuery = { ...baseQuery, $or: topicOrConditions };
      sectionSelected = await pullFromPool({
        query: globalQuery,
        size: sectionQuestionCount,
        usedIds,
        usedQuestionKeys: new Set(),
        rcGroupCache,
      });
      console.log(`[weeklyTestAssembler] Query 1 (global section/topic): got ${sectionSelected.length}`);
    }

    // Query 2: Global pool with just exam/stage match if nothing found
    if (sectionSelected.length < sectionQuestionCount) {
      const globalFallbackQuery = { ...baseQuery };
      const fallback = await pullFromPool({
        query: globalFallbackQuery,
        size: sectionQuestionCount - sectionSelected.length,
        usedIds,
        usedQuestionKeys: new Set(),
        rcGroupCache,
      });
      sectionSelected = sectionSelected.concat(fallback);
      console.log(`[weeklyTestAssembler] Query 2 (global exam/stage only): added ${fallback.length}`);
    }

    // Query 3: Any difficulty if still short
    if (sectionSelected.length < sectionQuestionCount) {
      const anyDifficultyQuery = { ...scopedBaseQuery, type: { $in: ['mcq'] } };
      const anyDiff = await pullFromPool({
        query: anyDifficultyQuery,
        size: sectionQuestionCount - sectionSelected.length,
        usedIds,
        usedQuestionKeys: new Set(),
        rcGroupCache,
      });
      sectionSelected = sectionSelected.concat(anyDiff);
      console.log(`[weeklyTestAssembler] Query 3 (any difficulty): added ${anyDiff.length}`);
    }

    // AI top-up if still short
    if (sectionSelected.length < sectionQuestionCount && (questionBankMode === 'hybrid' || questionBankMode === 'ai_only')) {
      const missingCount = sectionQuestionCount - sectionSelected.length;
      try {
        const aiPayload = {
          testId: `weekly-${effectiveExamSlug}-${effectiveStageSlug}`,
          domain: effectiveExamSlug,
          difficulty: 'medium',
          topics: sectionTopics,
          questionStyles: ['MCQ'],
          questionCount: missingCount,
        };

        const curated = await aiCurationService.curateQuestions({
          payload: aiPayload,
          userId: ownerId,
        });

        const aiQuestions = Array.isArray(curated?.questions) ? curated.questions : [];
        console.log(`[weeklyTestAssembler] AI generated: ${aiQuestions.length}`);

        for (const q of aiQuestions) {
          if (sectionSelected.length >= sectionQuestionCount) break;
          sectionSelected.push({
            ...q,
            section: sectionKey,
            topic: q.topic || sectionKey,
          });
        }
      } catch (error) {
        console.error('[weeklyTestAssembler] AI top-up failed:', error.message);
      }
    }

    // Bind questions to section
    const sectionBound = sectionSelected.map(q => ({
      ...toProjectedQuestion(q),
      section: sectionKey,
      topic: q.topic || sectionTopics[0] || sectionKey,
    }));

    selectedQuestions.push(...sectionBound);
    sectionPlan.push({
      section: sectionKey,
      targetCount: sectionQuestionCount,
      servedCount: sectionBound.length,
    });

    diagnostics.perSection.push({
      section: sectionKey,
      shortfall: Math.max(0, sectionQuestionCount - sectionBound.length),
    });
  }

  // Pack without breaking RC groups
  const finalQuestions = packWithoutBreakingRcGroups(selectedQuestions, totalQuestions);
  
  // Track served questions
  await trackServedQuestions({
    ownerId,
    examSlug: effectiveExamSlug,
    stageSlug: effectiveStageSlug,
    questions: finalQuestions,
  });

  console.log(`[weeklyTestAssembler] Final: ${finalQuestions.length} questions`);

  const paper = {
    examSlug: effectiveExamSlug,
    stageSlug: effectiveStageSlug,
    totalQuestions: totalQuestions,
    servedQuestions: finalQuestions.length,
    sectionPlan,
    questions: finalQuestions,
  };

  const paperId = await MockPaper.create({
    owner: ownerId,
    examSlug: effectiveExamSlug,
    stageSlug: effectiveStageSlug,
    goalSlug: 'weekly-test',
    title: `Weekly Test - ${new Date().toISOString().split('T')[0]}`,
    requestedQuestions: totalQuestions,
    servedQuestions: finalQuestions.length,
    questionIds: finalQuestions.map(q => q.id).filter(Boolean),
    questions: finalQuestions,
    sourceBreakdown: { dbCount: finalQuestions.length, aiTopupCount: 0 },
    diagnostics,
  });

  return {
    paper: { ...paper, paperId: String(paperId._id) },
    diagnostics,
  };
};

module.exports = {
  assembleWeeklyTest,
};
