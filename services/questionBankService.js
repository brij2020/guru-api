const crypto = require('crypto');
const ApiError = require('../errors/apiError');
const QuestionBank = require('../models/questionBank');
const PaperBlueprint = require('../models/paperBlueprint');
const QuestionReviewAudit = require('../models/questionReviewAudit');
const { callLocalLlm } = require('./aiCurationService');
const {
  questionBankMode,
  questionBankMinValidFields,
  questionBankDiagnosticsEnabled,
  questionBankApprovedOnly,
  aiProvider,
  openaiApiKey,
  openaiBaseUrl,
  openaiChatPath,
  openaiModel,
  geminiApiKey,
  geminiModel,
  geminiModels,
  localLlmUrl,
  localLlmModel,
} = require('../config/env');

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
const GROUP_TYPES = new Set(['none', 'rc_passage']);
const DEFAULT_PULL_COUNT = 20;
const MAX_PULL_COUNT = 100;
const REVIEW_STATUSES = new Set(['draft', 'reviewed', 'approved', 'rejected']);
const OPTIONS_REQUIRED_TYPES = ['mcq', 'output'];

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeQuestionTextForFingerprint = (text) => {
  if (!text) return '';
  
  let normalized = String(text)
    .trim()
    .toLowerCase();
  
  normalized = normalized.replace(/^(q\.?\s*\d*\.?\s*question:?\s*)/i, '');
  normalized = normalized.replace(/^(question:?\s*)/i, '');
  normalized = normalized.replace(/^(que\.?\s*)/i, '');
  normalized = normalized.replace(/^(q\.?\s*\d+\.?\s*)/i, '');
  
  normalized = normalized.replace(/(\s*options?\s*:?\s*)$/i, '');
  normalized = normalized.replace(/(\s*answer\s*:?\s*)$/i, '');
  normalized = normalized.replace(/(\s*solution\s*:?\s*)$/i, '');
  
  normalized = normalized.replace(/\s+/g, ' ');
  
  normalized = normalized.replace(/\bper\s+cent\b/gi, 'percent');
  normalized = normalized.replace(/[{}[\]()]/g, '');
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

const normalizeLanguage = (value) => {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z-]/g, '');
  return normalized || 'en';
};

const normalizeQuestionType = (value) => {
  const key = normalizeText(value).toLowerCase().replace(/\s+/g, '-');
  return TYPE_ALIASES[key] || 'mcq';
};

const normalizeDifficulty = (value) => {
  const key = normalizeText(value).toLowerCase();
  if (DIFFICULTIES.has(key)) return key;
  return 'medium';
};

const normalizeAnswerConfidence = (value) => {
  const key = normalizeText(value).toLowerCase();
  if (key === 'high' || key === 'medium' || key === 'low') return key;
  return 'unknown';
};

const normalizeGroupType = (value, hasPassage = false) => {
  const key = normalizeText(value).toLowerCase();
  if (GROUP_TYPES.has(key)) return key;
  return hasPassage ? 'rc_passage' : 'none';
};

const normalizeRcMetadata = ({
  groupType,
  groupId,
  groupTitle,
  passageText,
  groupOrder,
}) => {
  const normalizedPassageText = normalizeText(passageText || '');
  const normalizedGroupId = normalizeText(groupId || '');
  const normalizedGroupType = normalizeGroupType(groupType, Boolean(normalizedPassageText));
  const normalizedGroupTitle = normalizeText(groupTitle || '');
  const groupOrderNumber = Number(groupOrder);
  const normalizedGroupOrder = Number.isInteger(groupOrderNumber) && groupOrderNumber > 0 ? groupOrderNumber : null;

  const isRc = normalizedGroupType === 'rc_passage';
  const rcIsValid = isRc && normalizedGroupId.length > 0 && normalizedPassageText.length > 0;

  if (!rcIsValid) {
    return {
      groupType: 'none',
      groupId: '',
      groupTitle: '',
      passageText: '',
      groupOrder: null,
      isValidRc: false,
    };
  }

  return {
    groupType: 'rc_passage',
    groupId: normalizedGroupId,
    groupTitle: normalizedGroupTitle || 'Reading Comprehension',
    passageText: normalizedPassageText,
    groupOrder: normalizedGroupOrder,
    isValidRc: true,
  };
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

const normalizeReviewStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (REVIEW_STATUSES.has(normalized)) return normalized;
  return 'draft';
};

const sanitizeJsonOutput = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

const extractJsonCandidate = (text) => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
};

const parseModelJson = (rawText) => {
  const sanitized = sanitizeJsonOutput(rawText);
  const candidates = [sanitized, extractJsonCandidate(sanitized)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // try next candidate
    }
  }
  return null;
};

const callOpenAIForReview = async (prompt) => {
  const base = `${String(openaiBaseUrl || 'https://api.openai.com/v1')}`.replace(/\/$/, '');
  const isOfficialOpenAI = /api\.openai\.com/i.test(base);
  if (isOfficialOpenAI && !openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const chatPath = String(openaiChatPath || '/chat/completions').trim() || '/chat/completions';
  const endpoint = `${base}${chatPath.startsWith('/') ? '' : '/'}${chatPath}`;
  const makeRequest = async (body) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(openaiApiKey ? { Authorization: `Bearer ${openaiApiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const baseBody = {
    ...(openaiModel ? { model: openaiModel } : {}),
    messages: [
      { role: 'system', content: 'Return strict JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  };

  // Some OpenAI-compatible local servers reject `response_format: { type: "json_object" }`.
  let response = await makeRequest({
    ...baseBody,
    response_format: { type: 'json_object' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const isResponseFormatError = /response_format/i.test(errorText);
    if (isResponseFormatError) {
      response = await makeRequest(baseBody);
    } else if (/model/i.test(errorText) && baseBody.model) {
      const { model, ...withoutModel } = baseBody;
      response = await makeRequest(withoutModel);
    } else {
      throw new Error(`OpenAI request failed: ${errorText.slice(0, 300)}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${errorText.slice(0, 300)}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  const parsed = parseModelJson(content);
  if (!parsed) throw new Error('OpenAI returned invalid JSON');
  return parsed;
};

const callGeminiForReview = async (prompt, providerModel = geminiModel) => {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  const expandGeminiModelCandidates = (modelName) => {
    const base = String(modelName || '').trim();
    if (!base) return [];
    const candidates = [base];
    if (base === 'gemini-2.0-flash') {
      candidates.push('gemini-2.0-flash-lite');
    }
    if (base === 'gemini-2.0-flash-lite') {
      candidates.push('gemini-2.0-flash');
    }
    if (base === 'gemini-3.1-flash') {
      candidates.push('gemini-3.1-flash-lite');
    }
    if (base === 'gemini-3.1-flash-lite') {
      candidates.push('gemini-3.1-flash');
    }
    return candidates;
  };

  const modelsToTry = Array.from(
    new Set(
      [providerModel, ...(Array.isArray(geminiModels) ? geminiModels : [])]
        .flatMap((name) => expandGeminiModelCandidates(name))
        .concat(['gemini-2.0-flash-lite', 'gemini-2.0-flash'])
        .filter(Boolean)
    )
  );

  let lastErrorText = '';
  for (const modelName of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName
    )}:generateContent?key=${geminiApiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastErrorText = `model=${modelName} status=${response.status} error=${errorText.slice(0, 300)}`;
      console.log(`===== GEMINI REVIEW MODEL FAILED: ${modelName} (${response.status}) =====`);
      continue;
    }

    const result = await response.json();
    const content =
      result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';
    if (!content) {
      lastErrorText = `model=${modelName} returned empty content`;
      continue;
    }
    console.log(`===== GEMINI REVIEW MODEL USED: ${modelName} =====`);
    const parsed = parseModelJson(content);
    if (!parsed) {
      lastErrorText = `model=${modelName} returned invalid JSON`;
      continue;
    }
    return parsed;
  }
  throw new Error(`Gemini request failed across models. ${lastErrorText || 'No model succeeded'}`);
};

const normalizeReviewRecommendation = (value) => {
  const status = normalizeReviewStatus(value);
  if (status === 'draft') return 'reviewed';
  return status;
};

const buildHeuristicAiReview = (item, providerError = '') => {
  const question = normalizeText(item?.question || '');
  const options = Array.isArray(item?.optionObjects) && item.optionObjects.length > 0
    ? item.optionObjects.map((opt) => normalizeText(opt?.text || '')).filter(Boolean)
    : Array.isArray(item?.options)
      ? item.options.map((opt) => normalizeText(opt)).filter(Boolean)
      : [];
  const answer = normalizeText(item?.answer || '');
  const answerKey = normalizeText(item?.answerKey || '').toUpperCase();
  const hasAnswerInOptions = answer
    ? options.some((opt) => normalizeText(opt).toLowerCase() === answer.toLowerCase())
    : false;

  const issues = [];
  const suggestions = [];
  let score = 70;
  let recommendedStatus = 'reviewed';

  if (!question) {
    issues.push('Question text is empty.');
    suggestions.push('Add a complete question statement.');
    score = 20;
    recommendedStatus = 'rejected';
  }
  if (options.length < 2) {
    issues.push('Options are missing or insufficient.');
    suggestions.push('Provide 4 plausible options.');
    score = Math.min(score, 30);
    recommendedStatus = 'rejected';
  }
  if (!answer && !answerKey) {
    issues.push('Answer and answerKey are missing.');
    suggestions.push('Set a correct answer and matching answerKey.');
    score = Math.min(score, 35);
    recommendedStatus = 'rejected';
  } else if (answer && !hasAnswerInOptions) {
    issues.push('Answer text does not match current options.');
    suggestions.push('Correct answer mapping after option edits.');
    score = Math.min(score, 45);
    recommendedStatus = 'reviewed';
  }

  if (issues.length === 0) {
    issues.push('No major structural issue found by fallback review.');
    suggestions.push('Run AI review again when provider is available for deeper quality checks.');
    score = 78;
    recommendedStatus = 'approved';
  }

  return {
    score,
    recommendedStatus,
    needsUpdate: true,
    updatedQuestion: {
      question: question || '[Question text missing - review required]',
      options: options.slice(0, 5).map((text, idx) => ({ id: String.fromCharCode(65 + idx), text })),
      answerKey: answerKey || '',
      answer: answer || '',
      explanation: normalizeText(item?.explanation || ''),
      section: normalizeText(item?.section || ''),
      topic: normalizeText(item?.topic || ''),
      difficulty: normalizeDifficulty(item?.difficulty || 'medium'),
    },
    issues,
    suggestions,
    summary: providerError
      ? `AI provider unavailable. Applied fallback rule-based review. ${providerError}`
      : 'Fallback rule-based review completed.',
  };
};

const shuffleOptionObjects = (optionObjects = []) => {
  const shuffled = [...optionObjects];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((opt, idx) => ({
    id: String.fromCharCode(65 + idx),
    text: normalizeText(opt?.text || ''),
  }));
};

const normalizeOptionId = (value, index) => {
  const raw = normalizeText(value).toUpperCase();
  if (raw) return raw.slice(0, 8);
  return String.fromCharCode(65 + index);
};

const isLikelyAnswerKey = (value) => /^[A-Z]$/.test(normalizeText(value).toUpperCase());

const normalizeSource = (source = {}, fallback = {}) => {
  const year = Number(source?.year);
  const shift = Number(source?.shift);
  return {
    exam: normalizeText(source?.exam || fallback?.exam || ''),
    year: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null,
    shift: Number.isInteger(shift) && shift >= 1 && shift <= 20 ? shift : null,
    type: normalizeText(source?.type || fallback?.type || ''),
  };
};

const normalizeOptionsPayload = (optionsInput = []) => {
  const optionObjects = [];
  const options = [];
  if (!Array.isArray(optionsInput)) {
    return { optionObjects, options };
  }

  for (let i = 0; i < optionsInput.length; i += 1) {
    if (options.length >= 5) break;
    const item = optionsInput[i];
    if (typeof item === 'string') {
      const text = normalizeText(item);
      if (!text) continue;
      optionObjects.push({ id: normalizeOptionId('', optionObjects.length), text });
      options.push(text);
      continue;
    }
    if (item && typeof item === 'object') {
      const text = normalizeText(item?.text || item?.value || item?.label || '');
      if (!text) continue;
      optionObjects.push({ id: normalizeOptionId(item?.id, optionObjects.length), text });
      options.push(text);
    }
  }

  return { optionObjects, options };
};

const ALLOWED_ASSET_KINDS = new Set(['image', 'chart_image', 'diagram_image', 'table_image', 'chart_data']);

const normalizeAssetKind = (value) => {
  const key = normalizeText(value).toLowerCase();
  if (ALLOWED_ASSET_KINDS.has(key)) return key;
  if (key === 'chart' || key === 'graph') return 'chart_image';
  if (key === 'diagram') return 'diagram_image';
  if (key === 'table') return 'table_image';
  return 'image';
};

const normalizeAssetsPayload = (assetsInput = [], fallback = {}) => {
  const normalized = [];
  const fallbackUrl = normalizeText(fallback?.url || '');
  const fallbackKind = normalizeAssetKind(fallback?.kind || 'image');

  const addItem = (item) => {
    if (normalized.length >= 8) return;
    if (!item) return;
    const raw = typeof item === 'string' ? { url: item } : item;
    const url = normalizeText(raw?.url || raw?.src || '');
    const data = raw?.data && typeof raw.data === 'object' ? raw.data : null;
    if (!url && !data) return;
    const width = Number(raw?.width);
    const height = Number(raw?.height);
    const sourcePage = Number(raw?.sourcePage || raw?.page);
    normalized.push({
      kind: normalizeAssetKind(raw?.kind || fallbackKind),
      url,
      alt: normalizeText(raw?.alt || ''),
      width: Number.isInteger(width) && width > 0 ? width : null,
      height: Number.isInteger(height) && height > 0 ? height : null,
      caption: normalizeText(raw?.caption || ''),
      sourcePage: Number.isInteger(sourcePage) && sourcePage > 0 ? sourcePage : null,
      data,
    });
  };

  if (Array.isArray(assetsInput)) {
    assetsInput.forEach(addItem);
  }
  if (normalized.length === 0 && fallbackUrl) {
    addItem({ url: fallbackUrl, kind: fallbackKind });
  }
  return normalized;
};

const resolveAnswerFields = ({ optionObjects = [], answer, answerKey, correctAnswer, correctOption }) => {
  const candidateKey = normalizeText(answerKey || correctOption || '').toUpperCase();
  const candidateAnswer = normalizeText(answer || correctAnswer || '');
  const mapById = new Map(optionObjects.map((opt) => [normalizeText(opt.id).toUpperCase(), opt.text]));

  if (candidateKey && mapById.has(candidateKey)) {
    return { answerKey: candidateKey, answer: normalizeText(mapById.get(candidateKey)) };
  }

  if (candidateAnswer) {
    const answerAsKey = normalizeText(candidateAnswer).toUpperCase();
    if (isLikelyAnswerKey(answerAsKey) && mapById.has(answerAsKey)) {
      return { answerKey: answerAsKey, answer: normalizeText(mapById.get(answerAsKey)) };
    }

    for (const opt of optionObjects) {
      if (normalizeText(opt.text).toLowerCase() === candidateAnswer.toLowerCase()) {
        return { answerKey: normalizeText(opt.id).toUpperCase(), answer: normalizeText(opt.text) };
      }
    }
    return { answerKey: '', answer: candidateAnswer };
  }

  return { answerKey: '', answer: '' };
};

const buildServeStatusConstraint = () => (questionBankApprovedOnly ? { reviewStatus: 'approved' } : {});

const parseGovTestId = (testId) => {
  const value = normalizeText(testId).toLowerCase();
  if (!value.startsWith('gov-')) return { examSlug: '', stageSlug: '' };
  const parts = value.split('-').filter(Boolean);
  if (parts.length < 4) return { examSlug: '', stageSlug: '' };
  // format: gov-{exam...}-{stage...}-{goal...}-{plan...}
  // we attempt resilient extraction from known slugs.
  const knownStageTokens = new Set(['tier-1', 'tier-2', 'prelims', 'mains', 'cbt-1', 'cbt-2']);
  let stageSlug = '';
  for (let i = 1; i < parts.length; i += 1) {
    const token = `${parts[i]}${parts[i + 1] ? `-${parts[i + 1]}` : ''}`;
    if (knownStageTokens.has(token)) {
      stageSlug = token;
      break;
    }
    if (knownStageTokens.has(parts[i])) {
      stageSlug = parts[i];
      break;
    }
  }
  const examSlug = stageSlug
    ? value.replace(/^gov-/, '').split(`-${stageSlug}`)[0]
    : '';
  return {
    examSlug: normalizeText(examSlug),
    stageSlug: normalizeText(stageSlug),
  };
};

const buildFingerprint = (questionText, type) => {
  const normalized = `${normalizeQuestionType(type)}::${normalizeQuestionTextForFingerprint(questionText)}`;
  return crypto.createHash('sha1').update(normalized).digest('hex');
};

const dedupeDocsByFingerprint = (docs = []) => {
  const seen = new Set();
  const uniqueDocs = [];
  let duplicatesSkipped = 0;

  for (const doc of docs) {
    if (!doc) continue;
    const key = String(doc.fingerprint || '');
    if (!doc.fingerprint || seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    uniqueDocs.push(doc);
  }

  return { uniqueDocs, duplicatesSkipped };
};

const toQuestionBankDoc = (question, payload, ownerId, sourceAttemptId, provider) => {
  const questionText = normalizeText(question?.question || question?.questionText || question?.prompt);
  if (!questionText) return null;

  const type = normalizeQuestionType(question?.type);
  const difficulty = normalizeDifficulty(question?.difficulty || payload?.difficulty);
  const topic = normalizeText(question?.topic || question?.category || question?.subtopic);
  const { optionObjects, options } = normalizeOptionsPayload(question?.options);
  const resolvedAnswer = resolveAnswerFields({
    optionObjects,
    answer: question?.answer || question?.correctAnswer || question?.expectedAnswer,
    answerKey: question?.answerKey,
    correctOption: question?.correct_option || question?.correctOption,
  });
  const tags = normalizeList([...(payload?.topics || []), topic, ...(payload?.questionStyles || [])]);
  const parsedGovId = parseGovTestId(payload?.testId);
  const examSlug = normalizeText(payload?.examSlug || parsedGovId.examSlug).toLowerCase();
  const stageSlug = normalizeText(payload?.stageSlug || parsedGovId.stageSlug).toLowerCase();
  const section = normalizeText(question?.section || question?.sectionName || '');
  const rcMeta = normalizeRcMetadata({
    groupType: question?.groupType,
    groupId: question?.groupId || question?.passageId || '',
    groupTitle: question?.groupTitle || question?.passageTitle || '',
    passageText: question?.passageText || question?.passage || question?.comprehensionText || '',
    groupOrder: question?.groupOrder,
  });
  const questionNumber = Number(question?.questionNumber);
  const source = normalizeSource(question?.source, {
    exam: normalizeText(payload?.domain || ''),
    type: normalizeText(provider || ''),
  });
  const assets = normalizeAssetsPayload(question?.assets, {
    url: question?.imageUrl || question?.diagramUrl || question?.figureUrl || question?.chartUrl || '',
    kind: question?.assetKind || question?.figureType || 'image',
  });
  const hasVisual = Boolean(question?.hasVisual) || assets.length > 0;
  const reviewStatus = normalizeReviewStatus(question?.reviewStatus || payload?.reviewStatus || 'draft');

  return {
    owner: ownerId,
    sourceAttempt: sourceAttemptId || null,
    provider: normalizeText(provider),
    testId: normalizeText(payload?.testId),
    testTitle: normalizeText(payload?.testTitle),
    domain: normalizeText(payload?.domain),
    language: normalizeLanguage(question?.language || payload?.language || 'en'),
    examSlug,
    stageSlug,
    section,
    groupType: rcMeta.groupType,
    groupId: rcMeta.groupId,
    groupTitle: rcMeta.groupTitle,
    passageText: rcMeta.passageText,
    groupOrder: rcMeta.groupOrder,
    questionNumber: Number.isInteger(questionNumber) && questionNumber > 0 ? questionNumber : null,
    source,
    difficulty,
    type,
    topic,
    tags,
    promptContext: normalizeText(payload?.promptContext),
    question: questionText,
    options,
    optionObjects,
    hasVisual,
    assets,
    answer: resolvedAnswer.answer,
    answerKey: resolvedAnswer.answerKey,
    parsedAnswerKey: normalizeText(
      question?.parsedAnswerKey || question?.parsed_answer_key || question?.answerKey || question?.correct_option || ''
    ).toUpperCase().slice(0, 8),
    answerConfidence: normalizeAnswerConfidence(
      question?.answerConfidence || question?.answer_confidence || question?.confidence || ''
    ),
    answerRawSnippet: normalizeText(
      question?.answerRawSnippet || question?.answer_raw_snippet || question?.rawAnswerSnippet || question?.answerSnippet || ''
    ),
    explanation: normalizeText(question?.explanation || question?.rationale),
    inputOutput: normalizeText(question?.inputOutput),
    code: normalizeText(question?.code),
    expectedOutput: normalizeText(question?.expectedOutput),
    idealSolution: normalizeText(question?.idealSolution),
    solutionApproach: normalizeText(question?.solutionApproach),
    sampleSolution: normalizeText(question?.sampleSolution),
    complexity: normalizeText(question?.complexity),
    keyConsiderations: normalizeList(question?.keyConsiderations),
    reviewStatus,
    reviewedBy: null,
    reviewedAt: null,
    fingerprint: buildFingerprint(questionText, type),
    lastUsedAt: new Date(),
  };
};

const ingestQuestions = async ({ ownerId, sourceAttemptId, payload, provider, questions }) => {
  if (!ownerId || !Array.isArray(questions) || questions.length === 0) {
    return { insertedOrUpdated: 0, duplicatesSkipped: 0 };
  }

  const docs = questions
    .map((question) => toQuestionBankDoc(question, payload, ownerId, sourceAttemptId, provider))
    .filter(Boolean);

  if (docs.length === 0) return { insertedOrUpdated: 0, duplicatesSkipped: 0 };
  await enforceBlueprintSectionKeys(docs);
  const { uniqueDocs, duplicatesSkipped } = dedupeDocsByFingerprint(docs);
  if (uniqueDocs.length === 0) return { insertedOrUpdated: 0, duplicatesSkipped };

  const operations = uniqueDocs.map((doc) => ({
    updateOne: {
      filter: { fingerprint: doc.fingerprint },
      update: {
        $set: {
          ...doc,
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
    duplicatesSkipped,
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

const buildValidFieldConstraint = () => {
  const fieldChecks = [];

  const required = Array.isArray(questionBankMinValidFields)
    ? questionBankMinValidFields
    : [];

  for (const field of required) {
    if (field === 'question') {
      fieldChecks.push({ question: { $exists: true, $type: 'string', $ne: '' } });
      continue;
    }
    if (field === 'options') {
      fieldChecks.push({
        $or: [
          {
            type: { $in: OPTIONS_REQUIRED_TYPES },
            options: { $exists: true, $type: 'array', $ne: [] },
          },
          { type: { $nin: OPTIONS_REQUIRED_TYPES } },
        ],
      });
      continue;
    }
    if (field === 'answer') {
      fieldChecks.push({ answer: { $exists: true, $type: 'string', $ne: '' } });
      continue;
    }
    if (field === 'explanation') {
      fieldChecks.push({ explanation: { $exists: true, $type: 'string', $ne: '' } });
      continue;
    }
  }

  if (fieldChecks.length === 0) return {};
  return { $and: fieldChecks };
};

const sampleQuestions = async (query, count) => {
  const validFieldConstraint = buildValidFieldConstraint();
  const serveStatusConstraint = buildServeStatusConstraint();

  return QuestionBank.aggregate([
    { $match: { ...query, ...validFieldConstraint, ...serveStatusConstraint } },
    { $sample: { size: count } },
    {
      $project: {
        _id: 0,
        id: '$_id',
        type: 1,
        difficulty: 1,
        section: 1,
        groupType: 1,
        groupId: 1,
        groupTitle: 1,
        passageText: 1,
        groupOrder: 1,
        topic: 1,
        questionNumber: 1,
        source: 1,
        question: 1,
        options: 1,
        optionObjects: 1,
        hasVisual: 1,
        assets: 1,
        answer: 1,
        answerKey: 1,
        explanation: 1,
        inputOutput: 1,
        code: 1,
        expectedOutput: 1,
        idealSolution: 1,
        solutionApproach: 1,
        sampleSolution: 1,
        complexity: 1,
        keyConsiderations: 1,
        reviewStatus: 1,
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
  const retrievalMode = questionBankMode;

  if (retrievalMode === 'ai_only') {
    const serveStatusConstraint = buildServeStatusConstraint();
    const ownerCount = await QuestionBank.countDocuments({ owner: ownerId, ...serveStatusConstraint });
    const globalCount = await QuestionBank.countDocuments({ ...serveStatusConstraint });
    const diagnostics = {
      ownerId: String(ownerId || ''),
      ownerCount,
      globalCount,
      scope: 'none',
      mode: retrievalMode,
      matchedTier: 'skipped_db',
      validFieldGate: questionBankMinValidFields,
      approvedOnly: questionBankApprovedOnly,
    };

    return {
      questions: [],
      count: 0,
      matchedBy: 'skipped_db',
      ...(questionBankDiagnosticsEnabled ? { diagnostics } : {}),
    };
  }
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
  let scope = 'owner';
  let matchedTier = 'none';

  for (let i = 0; i < queryCandidates.length; i += 1) {
    const query = queryCandidates[i];
    matches = await sampleQuestions(query, count);
    if (matches.length > 0) {
      matchedBy = JSON.stringify(query);
      matchedTier = `owner_tier_${i + 1}`;
      break;
    }
  }

  const serveStatusConstraint = buildServeStatusConstraint();
  const ownerCount = await QuestionBank.countDocuments({ owner: ownerId, ...serveStatusConstraint });
  const globalCount = await QuestionBank.countDocuments({ ...serveStatusConstraint });

  // Fallback for legacy data or mixed-owner seeds:
  // if user has no owned rows but global bank has data, sample globally.
  if (retrievalMode === 'hybrid' && matches.length === 0 && ownerCount === 0 && globalCount > 0) {
    const globalStrictQuery = {};
    const globalWideQuery = {};
    const globalBroadQuery = {};
    const globalBaseQuery = {};

    if (domain) {
      const domainRegex = new RegExp(escapeRegex(domain), 'i');
      globalStrictQuery.domain = domainRegex;
      globalWideQuery.domain = domainRegex;
    }

    if (DIFFICULTIES.has(difficulty)) {
      globalStrictQuery.difficulty = difficulty;
      globalBroadQuery.difficulty = difficulty;
    }

    if (typeFilters.length > 0) {
      globalStrictQuery.type = { $in: typeFilters };
      globalWideQuery.type = { $in: typeFilters };
      globalBroadQuery.type = { $in: typeFilters };
    }

    if (topicMatch) {
      Object.assign(globalStrictQuery, topicMatch);
      Object.assign(globalWideQuery, topicMatch);
    }

    const globalCandidates = [globalStrictQuery, globalWideQuery, globalBroadQuery, globalBaseQuery];

    for (let i = 0; i < globalCandidates.length; i += 1) {
      const query = globalCandidates[i];
      matches = await sampleQuestions(query, count);
      if (matches.length > 0) {
        matchedBy = JSON.stringify(query);
        scope = 'global';
        matchedTier = `global_tier_${i + 1}`;
        break;
      }
    }
  }

  if (matches.length === 0 && matchedTier === 'none') {
    matchedTier = retrievalMode === 'db_first' ? 'owner_no_match' : 'no_match';
  }

  const diagnostics = {
    ownerId: String(ownerId || ''),
    ownerCount,
    globalCount,
    scope,
    mode: retrievalMode,
    matchedTier,
    validFieldGate: questionBankMinValidFields,
    approvedOnly: questionBankApprovedOnly,
  };

  return {
    questions: matches,
    count: matches.length,
    matchedBy,
    ...(questionBankDiagnosticsEnabled ? { diagnostics } : {}),
  };
};

const normalizeSlug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

const getActiveBlueprintSections = async (examSlug, stageSlug) => {
  const exam = normalizeSlug(examSlug || '');
  const stage = normalizeSlug(stageSlug || '');
  if (!exam || !stage) return [];
  const blueprint = await PaperBlueprint.findOne({
    examSlug: exam,
    stageSlug: stage,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .select('sections');
  return Array.isArray(blueprint?.sections) ? blueprint.sections : [];
};

const normalizeSectionToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const resolveSectionKeyFromBlueprint = (input, blueprintSections = []) => {
  if (!Array.isArray(blueprintSections) || blueprintSections.length === 0) {
    return normalizeSlug(input || '') || 'unmapped';
  }

  const normalizedSections = blueprintSections
    .map((section) => ({
      key: normalizeSlug(section?.key || ''),
      label: normalizeSectionToken(section?.label || ''),
    }))
    .filter((section) => section.key);

  if (normalizedSections.length === 0) return normalizeSlug(input || '') || 'unmapped';

  const source = normalizeSectionToken(input || '');
  if (source) {
    const exact = normalizedSections.find((section) => section.key === normalizeSlug(source) || section.label === source);
    if (exact) return exact.key;

    const contains = normalizedSections.find(
      (section) =>
        (section.label && source.includes(section.label)) ||
        (section.label && section.label.includes(source)) ||
        source.includes(section.key)
    );
    if (contains) return contains.key;
  }

  return normalizedSections[0].key || 'unmapped';
};

const enforceBlueprintSectionKeys = async (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) return docs;
  const cache = new Map();

  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const examSlug = normalizeSlug(doc.examSlug || '');
    const stageSlug = normalizeSlug(doc.stageSlug || '');
    const cacheKey = `${examSlug}::${stageSlug}`;
    if (!cache.has(cacheKey)) {
      // eslint-disable-next-line no-await-in-loop
      cache.set(cacheKey, await getActiveBlueprintSections(examSlug, stageSlug));
    }
    const sections = cache.get(cacheKey) || [];
    doc.section = resolveSectionKeyFromBlueprint(
      [doc.section, doc.topic, doc.question].filter(Boolean).join(' '),
      sections
    );
  }

  return docs;
};

const buildDifficultyTargets = (count, difficultyMix) => {
  const easy = Math.floor(count * Number(difficultyMix?.easy || 0));
  const medium = Math.floor(count * Number(difficultyMix?.medium || 0));
  const hard = Math.floor(count * Number(difficultyMix?.hard || 0));
  let allocated = easy + medium + hard;
  const targets = { easy, medium, hard };

  while (allocated < count) {
    targets.medium += 1;
    allocated += 1;
  }

  return targets;
};

const importQuestionsFromJson = async ({ ownerId, payload = {} }) => {
  if (!ownerId) return { imported: 0, inserted: 0, updated: 0, duplicatesSkipped: 0 };
  const defaults = {
    examSlug: normalizeSlug(payload.examSlug || ''),
    stageSlug: normalizeSlug(payload.stageSlug || ''),
    domain: normalizeText(payload.domain || ''),
    language: normalizeLanguage(payload.language || 'en'),
    provider: normalizeText(payload.provider || 'openai-import'),
    testId: normalizeText(payload.testId || ''),
    testTitle: normalizeText(payload.testTitle || ''),
    reviewStatus: normalizeReviewStatus(payload.reviewStatus || 'draft'),
    promptContext: normalizeText(payload.promptContext || ''),
  };

  const list = Array.isArray(payload.questions) ? payload.questions : [];
  const docs = list
    .map((item) => {
      const question = normalizeText(item?.question || '');
      if (!question) return null;
      const type = normalizeQuestionType(item?.type || 'mcq');
      const difficulty = normalizeDifficulty(item?.difficulty || 'medium');
      const options = Array.isArray(item?.options)
        ? item.options
        : [];
      const { optionObjects, options: normalizedOptions } = normalizeOptionsPayload(options);
      const resolvedAnswer = resolveAnswerFields({
        optionObjects,
        answer: item?.answer || item?.correctAnswer,
        answerKey: item?.answerKey,
        correctOption: item?.correct_option,
      });
      const questionNumber = Number(item?.questionNumber);
      const source = normalizeSource(item?.source, {
        exam: normalizeText(item?.domain || defaults.domain || ''),
        type: normalizeText(item?.provider || defaults.provider || 'import-json'),
      });
      const rcMeta = normalizeRcMetadata({
        groupType: item?.groupType,
        groupId: item?.groupId || item?.passageId || '',
        groupTitle: item?.groupTitle || item?.passageTitle || '',
        passageText: item?.passageText || item?.passage || item?.comprehensionText || '',
        groupOrder: item?.groupOrder,
      });
      const assets = normalizeAssetsPayload(item?.assets, {
        url: item?.imageUrl || item?.figureUrl || item?.diagramUrl || '',
        kind: item?.assetKind || item?.figureType || 'image',
      });
      const hasVisual = Boolean(item?.hasVisual) || assets.length > 0;
      const reviewStatus = normalizeReviewStatus(item?.reviewStatus || defaults.reviewStatus || 'draft');

      return {
        owner: ownerId,
        sourceAttempt: null,
        provider: defaults.provider,
        testId: normalizeText(item?.testId || defaults.testId || `import-${defaults.examSlug}-${defaults.stageSlug}`),
        testTitle: normalizeText(item?.testTitle || defaults.testTitle || `${defaults.examSlug} ${defaults.stageSlug} imported set`),
        domain: normalizeText(item?.domain || defaults.domain),
        language: normalizeLanguage(item?.language || defaults.language || 'en'),
        examSlug: normalizeSlug(item?.examSlug || defaults.examSlug),
        stageSlug: normalizeSlug(item?.stageSlug || defaults.stageSlug),
        section: normalizeSlug(item?.section || ''),
        groupType: rcMeta.groupType,
        groupId: rcMeta.groupId,
        groupTitle: rcMeta.groupTitle,
        passageText: rcMeta.passageText,
        groupOrder: rcMeta.groupOrder,
        questionNumber: Number.isInteger(questionNumber) && questionNumber > 0 ? questionNumber : null,
        source,
        difficulty,
        type,
        topic: normalizeText(item?.topic || ''),
        tags: normalizeList([item?.topic, item?.section, 'imported']),
        promptContext: normalizeText(item?.promptContext || defaults.promptContext || 'Imported from admin JSON'),
        question,
        options: normalizedOptions,
        optionObjects,
        hasVisual,
        assets,
        answer: resolvedAnswer.answer,
        answerKey: resolvedAnswer.answerKey,
        parsedAnswerKey: normalizeText(
          item?.parsedAnswerKey || item?.parsed_answer_key || item?.answerKey || item?.correct_option || ''
        ).toUpperCase().slice(0, 8),
        answerConfidence: normalizeAnswerConfidence(
          item?.answerConfidence || item?.answer_confidence || item?.confidence || ''
        ),
        answerRawSnippet: normalizeText(
          item?.answerRawSnippet || item?.answer_raw_snippet || item?.rawAnswerSnippet || item?.answerSnippet || ''
        ),
        explanation: normalizeText(item?.explanation || ''),
        inputOutput: '',
        code: normalizeText(item?.code || ''),
        expectedOutput: normalizeText(item?.expectedOutput || ''),
        idealSolution: normalizeText(item?.idealSolution || ''),
        solutionApproach: '',
        sampleSolution: '',
        complexity: '',
        keyConsiderations: [],
        reviewStatus,
        reviewedBy: null,
        reviewedAt: null,
        fingerprint: buildFingerprint(question, type),
        lastUsedAt: new Date(),
      };
    })
    .filter(Boolean);

  if (docs.length === 0) return { imported: 0, inserted: 0, updated: 0, duplicatesSkipped: 0 };
  await enforceBlueprintSectionKeys(docs);
  const { uniqueDocs, duplicatesSkipped } = dedupeDocsByFingerprint(docs);
  if (uniqueDocs.length === 0) {
    return {
      imported: docs.length,
      inserted: 0,
      updated: 0,
      duplicatesSkipped,
    };
  }

  const ops = uniqueDocs.map((doc) => ({
    updateOne: {
      filter: { fingerprint: doc.fingerprint },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await QuestionBank.bulkWrite(ops, { ordered: false });
  const inserted = Object.keys(result?.upsertedIds || {}).length;
  const updated = Number(result?.modifiedCount || 0);
  const insertedIds = Object.values(result?.upsertedIds || {}).map(id => String(id));

  return {
    imported: docs.length,
    inserted,
    updated,
    duplicatesSkipped,
    insertedIds,
  };
};

const listQuestionsForReview = async ({ ownerId, isAdmin = false, filters = {} }) => {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));
  const scope = normalizeText(filters.scope || (isAdmin ? 'global' : 'owner')).toLowerCase();
  const query = {};

  if (!isAdmin || scope === 'owner') {
    query.owner = ownerId;
  }

  if (filters.reviewStatus && REVIEW_STATUSES.has(filters.reviewStatus)) {
    query.reviewStatus = filters.reviewStatus;
  }
  if (filters.examSlug) {
    query.examSlug = normalizeText(filters.examSlug).toLowerCase();
  }
  if (filters.stageSlug) {
    query.stageSlug = normalizeText(filters.stageSlug).toLowerCase();
  }
  if (filters.section) {
    query.section = normalizeText(filters.section).toLowerCase();
  }
  if (filters.search) {
    const raw = normalizeText(filters.search);
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexible = escaped.replace(/[-_\s]+/g, '[-_\\s]+');
    const pattern = new RegExp(flexible, 'i');
    query.$or = [
      { question: pattern },
      { section: pattern },
      { topic: pattern },
      { tags: { $in: [pattern] } },
    ];
  }

  const [items, total] = await Promise.all([
    QuestionBank.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        '_id owner examSlug stageSlug section topic difficulty type questionNumber source question options optionObjects hasVisual assets answer answerKey parsedAnswerKey answerConfidence answerRawSnippet explanation reviewStatus updatedAt groupType groupId groupTitle passageText groupOrder'
      ),
    QuestionBank.countDocuments(query),
  ]);

  return {
    page,
    limit,
    total,
    scope,
    items: items.map((item) => ({
      id: String(item._id),
      ownerId: String(item.owner || ''),
      examSlug: item.examSlug,
      stageSlug: item.stageSlug,
      section: item.section,
      groupType: item.groupType || 'none',
      groupId: item.groupId || '',
      groupTitle: item.groupTitle || '',
      passageText: item.passageText || '',
      groupOrder: item.groupOrder || null,
      topic: item.topic,
      difficulty: item.difficulty,
      type: item.type,
      questionNumber: item.questionNumber || null,
      source: item.source || {},
      question: item.question,
      options: item.options || [],
      optionObjects: item.optionObjects || [],
      hasVisual: Boolean(item.hasVisual),
      assets: Array.isArray(item.assets) ? item.assets : [],
      answer: item.answer || '',
      answerKey: item.answerKey || '',
      parsedAnswerKey: item.parsedAnswerKey || '',
      answerConfidence: item.answerConfidence || 'unknown',
      answerRawSnippet: item.answerRawSnippet || '',
      explanation: item.explanation || '',
      reviewStatus: item.reviewStatus || 'draft',
      updatedAt: item.updatedAt,
    })),
  };
};

const bulkUpdateReviewStatus = async ({ ownerId, reviewerId, isAdmin = false, ids = [], reviewStatus }) => {
  const normalizedStatus = normalizeReviewStatus(reviewStatus);
  if (ids.length === 0) return { matched: 0, modified: 0 };
  const objectIds = ids.map((id) => id).filter(Boolean);

  const query = { _id: { $in: objectIds } };
  if (!isAdmin) {
    query.owner = ownerId;
  }

  const matchedRows = await QuestionBank.find(query)
    .select('_id owner reviewStatus')
    .lean();

  if (matchedRows.length === 0) {
    return { matched: 0, modified: 0, reviewStatus: normalizedStatus };
  }

  const eligibleRows = matchedRows.filter((row) => normalizeReviewStatus(row.reviewStatus) !== normalizedStatus);
  const eligibleIds = eligibleRows.map((row) => row._id);

  if (eligibleIds.length === 0) {
    return {
      matched: matchedRows.length,
      modified: 0,
      reviewStatus: normalizedStatus,
    };
  }

  const result = await QuestionBank.updateMany(
    { _id: { $in: eligibleIds } },
    {
      $set: {
        reviewStatus: normalizedStatus,
        reviewedBy: reviewerId || null,
        reviewedAt: new Date(),
      },
    }
  );

  const auditDocs = eligibleRows.map((row) => ({
    questionId: row._id,
    owner: row.owner,
    reviewer: reviewerId || null,
    action: 'status_change',
    fromStatus: normalizeReviewStatus(row.reviewStatus),
    toStatus: normalizedStatus,
    note: '',
  }));

  if (auditDocs.length > 0) {
    await QuestionReviewAudit.insertMany(auditDocs, { ordered: false });
  }

  return {
    matched: matchedRows.length,
    modified: Number(result?.modifiedCount || 0),
    reviewStatus: normalizedStatus,
  };
};

const updateQuestionForReview = async ({ ownerId, reviewerId, isAdmin = false, id, updates = {} }) => {
  const query = { _id: id };
  if (!isAdmin) {
    query.owner = ownerId;
  }

  const existing = await QuestionBank.findOne(query);
  if (!existing) return null;

  const applyRcToGroup = Boolean(updates.applyRcToGroup);
  const nextQuestion = updates.question !== undefined ? normalizeText(updates.question) : normalizeText(existing.question);
  const nextType = normalizeQuestionType(updates.type !== undefined ? updates.type : existing.type);

  if (!nextQuestion) {
    return null;
  }

  const optionsInput =
    updates.options !== undefined
      ? updates.options
      : Array.isArray(existing.optionObjects) && existing.optionObjects.length > 0
        ? existing.optionObjects
        : existing.options;

  const { optionObjects, options } = normalizeOptionsPayload(optionsInput);
  const resolvedAnswer = resolveAnswerFields({
    optionObjects,
    answer: updates.answer !== undefined ? updates.answer : existing.answer,
    answerKey: updates.answerKey !== undefined ? updates.answerKey : existing.answerKey,
  });

  const nextDifficulty = updates.difficulty !== undefined ? normalizeDifficulty(updates.difficulty) : normalizeDifficulty(existing.difficulty);
  const nextTopic = updates.topic !== undefined ? normalizeText(updates.topic) : normalizeText(existing.topic);
  const requestedSection = updates.section !== undefined ? normalizeText(updates.section) : normalizeText(existing.section);
  const blueprintSections = await getActiveBlueprintSections(existing.examSlug, existing.stageSlug);
  const nextSection = resolveSectionKeyFromBlueprint(
    [requestedSection, updates.topic, updates.question, existing.topic, existing.question].filter(Boolean).join(' '),
    blueprintSections
  );
  const nextExplanation = updates.explanation !== undefined ? normalizeText(updates.explanation) : normalizeText(existing.explanation);
  const nextAssets =
    updates.assets !== undefined
      ? normalizeAssetsPayload(updates.assets)
      : normalizeAssetsPayload(existing.assets);
  const nextHasVisual =
    updates.hasVisual !== undefined
      ? Boolean(updates.hasVisual)
      : Boolean(existing.hasVisual || nextAssets.length > 0);
  const rcMeta = normalizeRcMetadata({
    groupType: updates.groupType !== undefined ? updates.groupType : existing.groupType,
    groupId: updates.groupId !== undefined ? updates.groupId : existing.groupId,
    groupTitle: updates.groupTitle !== undefined ? updates.groupTitle : existing.groupTitle,
    passageText: updates.passageText !== undefined ? updates.passageText : existing.passageText,
    groupOrder: updates.groupOrder !== undefined ? updates.groupOrder : existing.groupOrder,
  });
  const questionNumberRaw = updates.questionNumber !== undefined ? updates.questionNumber : existing.questionNumber;
  const questionNumber = Number(questionNumberRaw);
  const nextQuestionNumber = Number.isInteger(questionNumber) && questionNumber > 0 ? questionNumber : null;

  const persisted = await QuestionBank.findOneAndUpdate(
    query,
    {
      $set: {
        question: nextQuestion,
        type: nextType,
        difficulty: nextDifficulty,
        topic: nextTopic,
        section: nextSection,
        groupType: rcMeta.groupType,
        groupId: rcMeta.groupId,
        groupTitle: rcMeta.groupTitle,
        passageText: rcMeta.passageText,
        groupOrder: rcMeta.groupOrder,
        explanation: nextExplanation,
        hasVisual: nextHasVisual || nextAssets.length > 0,
        assets: nextAssets,
        questionNumber: nextQuestionNumber,
        options,
        optionObjects,
        answer: resolvedAnswer.answer,
        answerKey: resolvedAnswer.answerKey,
        fingerprint: buildFingerprint(nextQuestion, nextType),
        reviewedBy: reviewerId || null,
        reviewedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!persisted) return null;

  if (applyRcToGroup && rcMeta.groupType === 'rc_passage' && normalizeText(rcMeta.groupId)) {
    const oldGroupId = normalizeText(existing.groupId || '');
    const oldGroupType = normalizeText(existing.groupType || 'none').toLowerCase();
    const matchGroupId = oldGroupType === 'rc_passage' && oldGroupId ? oldGroupId : normalizeText(rcMeta.groupId);

    await QuestionBank.updateMany(
      {
        owner: existing.owner,
        examSlug: persisted.examSlug,
        stageSlug: persisted.stageSlug,
        groupType: 'rc_passage',
        groupId: matchGroupId,
      },
      {
        $set: {
          groupType: rcMeta.groupType,
          groupId: rcMeta.groupId,
          groupTitle: rcMeta.groupTitle,
          passageText: rcMeta.passageText,
          reviewedBy: reviewerId || null,
          reviewedAt: new Date(),
        },
      }
    );
  }

  return {
    id: String(persisted._id),
    reviewStatus: normalizeReviewStatus(persisted.reviewStatus),
    question: persisted.question || '',
    options: persisted.options || [],
    optionObjects: persisted.optionObjects || [],
    hasVisual: Boolean(persisted.hasVisual),
    assets: Array.isArray(persisted.assets) ? persisted.assets : [],
    answer: persisted.answer || '',
    answerKey: persisted.answerKey || '',
    explanation: persisted.explanation || '',
    topic: persisted.topic || '',
    section: persisted.section || '',
    groupType: persisted.groupType || 'none',
    groupId: persisted.groupId || '',
    groupTitle: persisted.groupTitle || '',
    passageText: persisted.passageText || '',
    groupOrder: persisted.groupOrder || null,
    difficulty: persisted.difficulty || 'medium',
    questionNumber: persisted.questionNumber || null,
    updatedAt: persisted.updatedAt,
  };
};

const aiReviewQuestion = async ({
  ownerId,
  reviewerId,
  isAdmin = false,
  id,
  provider = '',
  applyStatus = false,
  applyEdits = false,
}) => {
  const query = { _id: id };
  if (!isAdmin) {
    query.owner = ownerId;
  }

  const item = await QuestionBank.findOne(query);
  if (!item) return null;

  const options = Array.isArray(item.optionObjects) && item.optionObjects.length > 0
    ? item.optionObjects.map((opt) => `${normalizeText(opt.id)}. ${normalizeText(opt.text)}`.trim())
    : Array.isArray(item.options)
      ? item.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${normalizeText(opt)}`)
      : [];

  const prompt = `
You are an exam question reviewer. Review and correct if needed.
make sure answer is 100% correct
Question: ${normalizeText(item.question)}

Options:
${options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}

Current Answer: ${normalizeText(item.answer)} (${normalizeText(item.answerKey)})
Explanation: ${normalizeText(item.explanation)}
Section: ${normalizeText(item.section)}
Topic: ${normalizeText(item.topic)}
Difficulty: ${normalizeText(item.difficulty)}

Return ONLY valid JSON:
{
  "score": 85,
  "status": "approved",
  "fix": {
    "question": "corrected question if needed",
    "options": [{"id":"A","text":"..."},{"id":"B","text":"..."}],
    "answerKey": "A",
    "answer": "exact correct option",
    "explanation": "brief",
    "section": "Quant|Reasoning|English|GK",
    "topic": "topic name",
    "difficulty": "easy|medium|hard"
  },
  "err": ["issues found"]
}
`.trim();
  console.log(`===== AI REVIEW PROVIDER DEBUG =====`, prompt);
  const normalizedProvider = String(provider || aiProvider || 'gemini').trim().toLowerCase();
  const chosenProvider = normalizedProvider === 'chatgpt' ? 'openai' : normalizedProvider;



  let raw = null;
  let fallbackUsed = false;
  let providerError = '';
  try {
    if (chosenProvider === 'openai') {
      raw = await callOpenAIForReview(prompt);
    } else if (chosenProvider === 'gemini') {
      raw = await callGeminiForReview(prompt);
    } else if (chosenProvider === 'local') {
      console.log('===== AI REVIEW LOCAL LLM PROMPT START =====');
      console.log(prompt);
      console.log('===== AI REVIEW LOCAL LLM PROMPT END =====');
      raw = await callLocalLlm(prompt, localLlmModel);
    } else {
      throw new Error(`Unsupported AI provider: ${chosenProvider}`);
    }
  } catch (error) {
    providerError = normalizeText(error?.message || 'AI provider failed');
    raw = buildHeuristicAiReview(item, providerError);
    fallbackUsed = true;
  }

  try {
    const safeRawPreview = JSON.stringify(raw || {}).slice(0, 8000);
    console.log('===== AI REVIEW RESPONSE =====');
    console.log(`questionId=${String(item._id)} provider=${chosenProvider} fallbackUsed=${fallbackUsed}`);
    if (providerError) {
      console.log(`providerError=${providerError}`);
    }
    console.log(safeRawPreview);
    console.log('===== AI REVIEW RESPONSE END =====');
  } catch (logError) {
    console.log('===== AI REVIEW RESPONSE LOG FAILED =====');
    console.log(normalizeText(logError?.message || 'unknown log error'));
  }

  const scoreRaw = Number(raw?.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
  const recommendedStatus = normalizeReviewRecommendation(raw?.recommendedStatus || raw?.status);
  const issues = Array.isArray(raw?.issues || raw?.err)
    ? (raw.issues || raw.err).map((v) => normalizeText(v)).filter(Boolean).slice(0, 10)
    : [];
  const suggestions = Array.isArray(raw?.suggestions)
    ? raw.suggestions.map((v) => normalizeText(v)).filter(Boolean).slice(0, 10)
    : [];
  const summary = normalizeText(raw?.summary || '');
  const needsUpdate = Boolean(raw?.needsUpdate);
  
  const fixData = raw?.fix || raw?.updatedQuestion || {};
  const updatedQuestionRaw = (typeof fixData === 'object' && fixData !== null) ? fixData : {};

  const normalizedUpdatedQuestionText = normalizeText(updatedQuestionRaw?.question || item.question);
  const normalizedUpdatedSection = normalizeText(updatedQuestionRaw?.section || item.section);
  const normalizedUpdatedTopic = normalizeText(updatedQuestionRaw?.topic || item.topic);
  const normalizedUpdatedDifficulty = normalizeDifficulty(updatedQuestionRaw?.difficulty || item.difficulty);
  const normalizedUpdatedExplanation = normalizeText(updatedQuestionRaw?.explanation || item.explanation);
  const updatedOptionsInput =
    updatedQuestionRaw?.options !== undefined
      ? updatedQuestionRaw.options
      : (Array.isArray(item.optionObjects) && item.optionObjects.length > 0 ? item.optionObjects : item.options);
  const { optionObjects: updatedOptionObjectsRaw } = normalizeOptionsPayload(updatedOptionsInput);
  const shuffledUpdatedOptionObjects = shuffleOptionObjects(updatedOptionObjectsRaw);
  const resolvedUpdatedAnswer = resolveAnswerFields({
    optionObjects: shuffledUpdatedOptionObjects,
    answer: updatedQuestionRaw?.answer !== undefined ? updatedQuestionRaw.answer : item.answer,
    answerKey: updatedQuestionRaw?.answerKey !== undefined ? updatedQuestionRaw.answerKey : item.answerKey,
  });
  const fallbackResolvedAnswer = resolvedUpdatedAnswer.answer
    ? resolvedUpdatedAnswer
    : resolveAnswerFields({
      optionObjects: shuffledUpdatedOptionObjects,
      answer: item.answer,
      answerKey: item.answerKey,
    });
  const finalResolvedAnswer =
    fallbackResolvedAnswer.answer || fallbackResolvedAnswer.answerKey
      ? fallbackResolvedAnswer
      : {
        answerKey: shuffledUpdatedOptionObjects.length > 0 ? 'A' : '',
        answer: shuffledUpdatedOptionObjects[0]?.text || '',
      };
  const updatedOptions = shuffledUpdatedOptionObjects.map((opt) => opt.text);
  const updatedQuestion = {
    question: normalizedUpdatedQuestionText || normalizeText(item.question),
    options: shuffledUpdatedOptionObjects,
    answerKey: finalResolvedAnswer.answerKey || normalizeText(item.answerKey).toUpperCase(),
    answer: finalResolvedAnswer.answer || normalizeText(item.answer),
    explanation: normalizedUpdatedExplanation,
    section: normalizedUpdatedSection,
    topic: normalizedUpdatedTopic,
    difficulty: normalizedUpdatedDifficulty,
  };

  try {
    console.log('===== AI REVIEW NORMALIZED =====');
    console.log(
      JSON.stringify(
        {
          questionId: String(item._id),
          score,
          recommendedStatus,
          needsUpdate,
          applyStatus: Boolean(applyStatus),
          applyEdits: Boolean(applyEdits),
          updatedQuestionPreview: {
            question: updatedQuestion.question,
            optionsCount: Array.isArray(updatedQuestion.options) ? updatedQuestion.options.length : 0,
            answerKey: updatedQuestion.answerKey,
            answer: updatedQuestion.answer,
            section: updatedQuestion.section,
            topic: updatedQuestion.topic,
            difficulty: updatedQuestion.difficulty,
          },
        },
        null,
        2
      )
    );
    console.log('===== AI REVIEW NORMALIZED END =====');
  } catch { }

  let updatedReviewStatus = normalizeReviewStatus(item.reviewStatus);
  let statusChanged = false;
  let editsApplied = false;

  if (applyEdits && needsUpdate) {
    const nextQuestion = normalizeText(updatedQuestion.question) || normalizeText(item.question);
    const nextType = normalizeQuestionType(item.type);
    try {
      await QuestionBank.findOneAndUpdate(
        query,
        {
          $set: {
            question: nextQuestion,
            type: nextType,
            difficulty: normalizeDifficulty(updatedQuestion.difficulty),
            topic: normalizeText(updatedQuestion.topic),
            section: normalizeText(updatedQuestion.section),
            explanation: normalizeText(updatedQuestion.explanation),
            options: updatedOptions,
            optionObjects: updatedOptionObjects,
            answer: normalizeText(updatedQuestion.answer),
            answerKey: normalizeText(updatedQuestion.answerKey).toUpperCase(),
            fingerprint: buildFingerprint(nextQuestion, nextType),
            reviewedBy: reviewerId || null,
            reviewedAt: new Date(),
          },
        },
        { new: false }
      );
      editsApplied = true;
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(409, 'AI edit created duplicate question fingerprint. Manual edit required.');
      }
      throw error;
    }
  }

  if (applyStatus) {
    const nextStatus = normalizeReviewRecommendation(recommendedStatus);
    const previousStatus = normalizeReviewStatus(item.reviewStatus);
    if (nextStatus !== previousStatus) {
      item.reviewStatus = nextStatus;
      item.reviewedBy = reviewerId || null;
      item.reviewedAt = new Date();
      await item.save();
      statusChanged = true;
      updatedReviewStatus = nextStatus;

      await QuestionReviewAudit.create({
        questionId: item._id,
        owner: item.owner,
        reviewer: reviewerId || null,
        action: 'status_change',
        fromStatus: previousStatus,
        toStatus: nextStatus,
        note: normalizeText(`AI review applied. score=${score}. summary=${summary}`).slice(0, 500),
      }).catch(() => null);
    } else {
      item.reviewedBy = reviewerId || null;
      item.reviewedAt = new Date();
      await item.save();
    }
  }

  return {
    id: String(item._id),
    provider: chosenProvider,
    fallbackUsed,
    providerError,
    reviewStatus: updatedReviewStatus,
    statusChanged,
    editsApplied,
    aiReview: {
      score,
      recommendedStatus,
      needsUpdate,
      updatedQuestion,
      issues,
      suggestions,
      summary,
    },
  };
};

const getCoverageSnapshot = async ({ ownerId, filters = {} }) => {
  const examSlug = normalizeText(filters.examSlug).toLowerCase();
  const stageSlug = normalizeText(filters.stageSlug).toLowerCase();

  const blueprint = await PaperBlueprint.findOne({
    owner: ownerId,
    examSlug,
    stageSlug,
    isActive: true,
  }).sort({ updatedAt: -1 });

  if (!blueprint) {
    return {
      examSlug,
      stageSlug,
      hasBlueprint: false,
      message: 'No active blueprint found for this exam/stage. Create blueprint first.',
      summary: {
        totalTarget: 0,
        totalAvailableAll: 0,
        totalAvailableApproved: 0,
        completionAllPct: 0,
        completionApprovedPct: 0,
        approvedOnlyServing: questionBankApprovedOnly,
      },
      byDifficulty: [],
      sectionDifficulty: [],
      extraSections: [],
    };
  }

  const aggregateRows = await QuestionBank.aggregate([
    {
      $match: {
        owner: blueprint.owner,
        examSlug,
        stageSlug,
      },
    },
    {
      $group: {
        _id: {
          section: '$section',
          difficulty: '$difficulty',
          reviewStatus: '$reviewStatus',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const sectionDifficultyMap = new Map();
  const sectionAllMap = new Map();

  for (const row of aggregateRows) {
    const section = normalizeText(row?._id?.section).toLowerCase() || 'unmapped';
    const difficulty = normalizeDifficulty(row?._id?.difficulty);
    const status = normalizeReviewStatus(row?._id?.reviewStatus);
    const count = Number(row?.count || 0);
    const key = `${section}::${difficulty}`;

    const current = sectionDifficultyMap.get(key) || { all: 0, approved: 0 };
    current.all += count;
    if (status === 'approved') current.approved += count;
    sectionDifficultyMap.set(key, current);

    const sectionCurrent = sectionAllMap.get(section) || { all: 0, approved: 0 };
    sectionCurrent.all += count;
    if (status === 'approved') sectionCurrent.approved += count;
    sectionAllMap.set(section, sectionCurrent);
  }

  const blueprintSections = Array.isArray(blueprint.sections) ? blueprint.sections : [];
  const difficultyMix = blueprint.difficultyMix || { easy: 0.3, medium: 0.5, hard: 0.2 };

  const sectionDifficulty = [];
  const difficultyTotals = {
    easy: { target: 0, availableAll: 0, availableApproved: 0 },
    medium: { target: 0, availableAll: 0, availableApproved: 0 },
    hard: { target: 0, availableAll: 0, availableApproved: 0 },
  };

  for (const section of blueprintSections) {
    const sectionKey = normalizeText(section?.key).toLowerCase();
    const targets = buildDifficultyTargets(Number(section?.count || 0), difficultyMix);
    for (const difficulty of ['easy', 'medium', 'hard']) {
      const mapKey = `${sectionKey}::${difficulty}`;
      const found = sectionDifficultyMap.get(mapKey) || { all: 0, approved: 0 };
      const target = Number(targets[difficulty] || 0);
      const availableAll = Number(found.all || 0);
      const availableApproved = Number(found.approved || 0);

      sectionDifficulty.push({
        sectionKey,
        sectionLabel: normalizeText(section?.label),
        difficulty,
        target,
        availableAll,
        availableApproved,
        gapAll: Math.max(0, target - availableAll),
        gapApproved: Math.max(0, target - availableApproved),
      });

      difficultyTotals[difficulty].target += target;
      difficultyTotals[difficulty].availableAll += availableAll;
      difficultyTotals[difficulty].availableApproved += availableApproved;
    }
  }

  const byDifficulty = ['easy', 'medium', 'hard'].map((difficulty) => {
    const entry = difficultyTotals[difficulty];
    return {
      difficulty,
      target: entry.target,
      availableAll: entry.availableAll,
      availableApproved: entry.availableApproved,
      gapAll: Math.max(0, entry.target - entry.availableAll),
      gapApproved: Math.max(0, entry.target - entry.availableApproved),
    };
  });

  const sectionKeySet = new Set(blueprintSections.map((section) => normalizeText(section?.key).toLowerCase()));
  const extraSections = Array.from(sectionAllMap.entries())
    .filter(([key]) => !sectionKeySet.has(key))
    .map(([sectionKey, counts]) => ({
      sectionKey,
      availableAll: Number(counts.all || 0),
      availableApproved: Number(counts.approved || 0),
    }))
    .sort((a, b) => b.availableAll - a.availableAll);

  const totalTarget = Number(blueprint.totalQuestions || 0);
  const totalAvailableAll = byDifficulty.reduce((sum, row) => sum + Number(row.availableAll || 0), 0);
  const totalAvailableApproved = byDifficulty.reduce((sum, row) => sum + Number(row.availableApproved || 0), 0);
  const completionAllPct = totalTarget > 0 ? Math.min(100, Math.round((totalAvailableAll / totalTarget) * 100)) : 0;
  const completionApprovedPct = totalTarget > 0 ? Math.min(100, Math.round((totalAvailableApproved / totalTarget) * 100)) : 0;

  return {
    examSlug,
    stageSlug,
    hasBlueprint: true,
    blueprint: {
      id: String(blueprint._id),
      name: blueprint.name || '',
      examStageQuestions: blueprint.examStageQuestions,
      totalQuestions: totalTarget,
      sections: blueprintSections,
      difficultyMix,
    },
    summary: {
      totalTarget,
      totalAvailableAll,
      totalAvailableApproved,
      completionAllPct,
      completionApprovedPct,
      approvedOnlyServing: questionBankApprovedOnly,
    },
    byDifficulty,
    sectionDifficulty,
    extraSections,
  };
};

const SECTION_KEYS = [
  { key: 'general-intelligence-reasoning', label: 'General Intelligence & Reasoning' },
  { key: 'english-comprehension', label: 'English Comprehension' },
  { key: 'quantitative-aptitude', label: 'Quantitative Aptitude' },
  { key: 'general-awareness', label: 'General Awareness' },
];

const getTodaysQuestionsBySection = async () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24*60*60*1000);

  const questions = await QuestionBank.find({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  })
    .sort({ section: 1, createdAt: -1 })
    .select('_id question options answerKey explanation difficulty topic section')
    .lean();

  const grouped = {};
  SECTION_KEYS.forEach(s => {
    grouped[s.key] = { key: s.key, label: s.label, questions: [] };
  });

  questions.forEach(q => {
    const sectionKey = q.section?.toLowerCase().replace(/\s+/g, '-');
    if (grouped[sectionKey] && grouped[sectionKey].questions.length < 5) {
      grouped[sectionKey].questions.push({
        id: String(q._id),
        question: q.question,
        options: q.options || [],
        answerKey: q.answerKey,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic,
      });
    }
  });

  const sections = Object.values(grouped);
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  return {
    sections,
    total: totalQuestions,
    date: today,
  };
};

const listQuestions = async ({ filters = {} }) => {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));
  const query = {};

  if (filters.examSlug) {
    query.examSlug = normalizeText(filters.examSlug).toLowerCase();
  }
  if (filters.stageSlug) {
    query.stageSlug = normalizeText(filters.stageSlug).toLowerCase();
  }
  if (filters.section) {
    query.section = normalizeText(filters.section).toLowerCase();
  }
  if (filters.search) {
    let raw = normalizeText(filters.search);
    let pattern;
    
    const regexMatch = raw.match(/^\/(.+?)\/([a-z]*)$/i);
    if (regexMatch) {
      try {
        pattern = new RegExp(regexMatch[1], regexMatch[2] || 'i');
      } catch {
        const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(escaped, 'i');
      }
    } else {
      raw = raw.replace(/^\/|\/[a-z]*$/gi, '').trim();
      if (raw.length >= 2) {
        const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(escaped, 'i');
      }
    }
    
    if (pattern) {
      query.$or = [
        { question: pattern },
        { section: pattern },
        { topic: pattern },
      ];
    }
  }

  query.reviewStatus = 'approved';

  const [items, total] = await Promise.all([
    QuestionBank.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id examSlug stageSlug section topic difficulty type question questionNumber options explanation reviewStatus updatedAt'),
    QuestionBank.countDocuments(query),
  ]);

  return {
    page,
    limit,
    total,
    items: items.map((item) => ({
      id: String(item._id),
      examSlug: item.examSlug,
      stageSlug: item.stageSlug,
      section: item.section,
      topic: item.topic,
      difficulty: item.difficulty,
      type: item.type,
      questionNumber: item.questionNumber || null,
      question: item.question,
      options: item.options || [],
      explanation: item.explanation || '',
      reviewStatus: item.reviewStatus,
      updatedAt: item.updatedAt,
    })),
  };
};

module.exports = {
  ingestQuestions,
  pullSimilarQuestions,
  importQuestionsFromJson,
  listQuestions,
  listQuestionsForReview,
  bulkUpdateReviewStatus,
  updateQuestionForReview,
  aiReviewQuestion,
  getCoverageSnapshot,
  getTodaysQuestionsBySection,
};
