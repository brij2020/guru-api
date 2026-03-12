const ApiError = require('../errors/apiError');
const {
  aiProvider,
  openaiApiKey,
  openaiBaseUrl,
  openaiModel,
  openaiMaxTokens,
  geminiApiKey,
  geminiModel,
  geminiMathModel,
  geminiBulkModel,
  geminiModels,
  aiCurationBatchSize,
  aiProviderFallbackEnabled,
} = require('../config/env');

const DEFAULT_QUESTION_COUNT = 20;
const MAX_QUESTION_COUNT = 100;
const DEFAULT_CURATION_BATCH_SIZE = 20;
const SUPPORTED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const SUPPORTED_TYPES = ['coding', 'mcq', 'theory', 'output', 'scenario'];
const OPTIONS_REQUIRED_TYPES = new Set(['mcq', 'output']);
const MIXED_TYPE_WEIGHTS = {
  coding: 0.3,
  mcq: 0.2,
  theory: 0.2,
  output: 0.15,
  scenario: 0.15,
};
const ESTIMATED_MINUTES_PER_TYPE = {
  coding: 12,
  scenario: 6,
  theory: 4,
  output: 3,
  mcq: 2,
};
const MIN_ESTIMATED_DURATION_MINUTES = 5;
const MAX_ESTIMATED_DURATION_MINUTES = 300;
const GOV_EXAM_CONTEXT_PATTERN = /\b(gov(?:ernment)?\s*exam|ssc|upsc|rrb|ntpc|ibps|sbi|psc|cbt|prelims|mains)\b/i;

const TYPE_ALIASES = {
  coding: 'coding',
  code: 'coding',
  'problem-solving': 'coding',
  'problem solving': 'coding',
  'algorithmic': 'coding',
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
  mixed: 'mixed',
};

const sanitizeJsonOutput = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

const normalizeDifficulty = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (SUPPORTED_DIFFICULTIES.has(normalized)) return normalized;
  return 'medium';
};

const normalizeQuestionType = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return TYPE_ALIASES[normalized] || null;
};

const normalizeQuestionCount = (value) => {
  if (String(value).trim().toLowerCase() === 'all') return DEFAULT_QUESTION_COUNT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_QUESTION_COUNT;
  return Math.min(Math.floor(parsed), MAX_QUESTION_COUNT);
};

const normalizeTextList = (values) => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
};

const isGovExamContext = (...values) =>
  values.some((value) => GOV_EXAM_CONTEXT_PATTERN.test(String(value || '')));

const MATH_HEAVY_PATTERN = /\b(math|mathematics|numerical|quant|arithmetic|algebra|geometry|trigonometry|data interpretation|di|number series|simplification|quadratic|profit|loss|ratio|time and work)\b/i;
const PYQ_PATTERN = /\b(pyq|previous year|memory[-\s]?based|past paper)\b/i;

const normalizeRequestedTypes = (styles) => {
  const normalized = normalizeTextList(styles)
    .map((style) => normalizeQuestionType(style))
    .filter(Boolean);

  if (normalized.includes('mixed') || normalized.length === 0) {
    return [...SUPPORTED_TYPES];
  }

  return Array.from(new Set(normalized));
};

const selectGeminiModelForInput = (input) => {
  const aggregateText = [
    input?.testId,
    input?.testTitle,
    input?.domain,
    input?.promptContext,
    ...(Array.isArray(input?.topics) ? input.topics : []),
  ]
    .map((item) => String(item || ''))
    .join(' ');

  const isMathHeavy = MATH_HEAVY_PATTERN.test(aggregateText);
  const isPyqLike = PYQ_PATTERN.test(aggregateText);
  const count = Number(input?.questionCount || 0);

  if (isMathHeavy && isPyqLike) {
    return geminiMathModel || 'gemini-2.0-flash';
  }

  if (count >= 20) {
    return geminiBulkModel || 'gemini-2.0-flash-lite';
  }

  return geminiModel || 'gemini-2.0-flash-lite';
};

const buildTypePlan = (requestedTypes, questionCount) => {
  if (requestedTypes.length === 0) {
    return { coding: questionCount };
  }

  if (requestedTypes.length === 1) {
    return { [requestedTypes[0]]: questionCount };
  }

  if (requestedTypes.length === SUPPORTED_TYPES.length) {
    const entries = SUPPORTED_TYPES.map((type) => ({
      type,
      count: Math.floor(questionCount * (MIXED_TYPE_WEIGHTS[type] || 0)),
    }));
    let allocated = entries.reduce((sum, entry) => sum + entry.count, 0);

    for (const type of SUPPORTED_TYPES) {
      if (allocated >= questionCount) break;
      const entry = entries.find((item) => item.type === type);
      if (!entry) continue;
      entry.count += 1;
      allocated += 1;
    }

    return entries.reduce((acc, entry) => {
      if (entry.count > 0) acc[entry.type] = entry.count;
      return acc;
    }, {});
  }

  const base = Math.floor(questionCount / requestedTypes.length);
  let remainder = questionCount % requestedTypes.length;
  const plan = {};

  for (const type of requestedTypes) {
    plan[type] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }

  return plan;
};

const normalizeInput = (input) => {
  const questionCount = normalizeQuestionCount(input.questionCount);
  const promptContext = String(input.promptContext || '').trim();
  const govExamMode = isGovExamContext(input.testId, input.testTitle, input.domain, promptContext);
  const requestedTypes = govExamMode ? ['mcq'] : normalizeRequestedTypes(input.questionStyles);
  const typePlan = buildTypePlan(requestedTypes, questionCount);
  const normalizedMode = String(input.attemptMode || '')
    .trim()
    .toLowerCase();
  const attemptMode = normalizedMode === 'practice' ? 'practice' : 'exam';

  return {
    testId: String(input.testId || '').trim(),
    testTitle: String(input.testTitle || '').trim(),
    domain: String(input.domain || '').trim(),
    attemptMode,
    difficulty: normalizeDifficulty(input.difficulty),
    topics: normalizeTextList(input.topics),
    requestedTypes,
    typePlan,
    questionCount,
    totalTargetQuestions: Math.max(questionCount, Number(input.totalTargetQuestions || questionCount)),
    promptContext,
    govExamMode,
  };
};

const getProfessionalDifficultyGuidance = (difficulty) => {
  if (difficulty === 'easy') {
    return 'Assume 1-2 years experience. Focus on practical fundamentals, debugging basics, API usage, and code readability.';
  }
  if (difficulty === 'hard') {
    return 'Assume senior-level experience. Include tradeoffs, distributed systems concerns, incident handling, performance, security, and failure modes.';
  }
  return 'Assume mid-level professional experience. Emphasize production-grade reasoning, maintainability, performance, and common real-world constraints.';
};

const getDomainProfessionalFocus = (domain) => {
  const value = String(domain || '')
    .trim()
    .toLowerCase();

  if (!value) return 'General software engineering across backend, frontend, cloud, reliability, and security.';
  if (value.includes('frontend')) return 'Frontend engineering: rendering performance, accessibility, state management, caching, and browser behavior.';
  if (value.includes('backend')) return 'Backend engineering: API design, data consistency, observability, scalability, and resilience.';
  if (value.includes('devops') || value.includes('cloud')) return 'Cloud/DevOps: CI/CD, IaC, monitoring, reliability, incident response, and cost-performance tradeoffs.';
  if (value.includes('security')) return 'Application security: authN/authZ, secure coding, threat modeling, and defense-in-depth.';
  if (value.includes('data')) return 'Data engineering: pipelines, data quality, schema evolution, reliability, and performance.';
  if (value.includes('qa') || value.includes('test')) return 'Quality engineering: test strategy, automation, flaky-test mitigation, and release confidence.';
  return `Professional ${domain} engineering scenarios with production-oriented decision making.`;
};

const getAttemptModeGuidance = (attemptMode) => {
  if (attemptMode === 'practice') {
    return {
      modeLabel: 'Practice Mode',
      guidance:
        'Learning-first mode: provide slightly more explanatory wording, progressive difficulty flow, and mentor-like solution hints in explanation/solutionApproach.',
      behaviorRules: [
        'Practice mode tone: supportive and instructional.',
        'Prefer concept reinforcement and common pitfalls.',
        'Include clearer step-by-step explanation where useful.',
      ],
    };
  }

  return {
    modeLabel: 'Exam Mode',
    guidance:
      'Simulation-first mode: concise exam-like phrasing, minimal hints, realistic pressure, and direct evaluation-focused wording.',
    behaviorRules: [
      'Exam mode tone: strict and assessment-focused.',
      'Avoid giving away solutions in question text.',
      'Keep explanations concise and evaluation-oriented.',
    ],
  };
};

const buildGovExamCurationPrompt = (input, existingQuestions = []) => {
  const selectedTopicsText =
    input.topics.length > 0 ? input.topics.join(', ') : 'All core syllabus areas';
  const exclusionText =
    existingQuestions.length > 0
      ? `\n- Existing questions to avoid repeating:\n${existingQuestions
          .slice(0, 25)
          .map((question, index) => `  ${index + 1}. ${question}`)
          .join('\n')}`
      : '';

  return `
Role: Create realistic government-exam MCQ questions.
Output: strict JSON only (no markdown).

Input profile:
- Test: ${input.testTitle} (${input.testId || 'not-provided'})
- Domain: ${input.domain || 'Government Exam'}
- Mode: ${input.attemptMode === 'practice' ? 'Practice' : 'Exam'}
- Difficulty: ${input.difficulty}
- Topics: ${selectedTopicsText}
- Batch count: ${input.questionCount}
- Overall target: ${input.totalTargetQuestions}
- Extra context: ${input.promptContext || 'None'}
${exclusionText}

Required JSON schema:
{
  "estimatedDurationMinutes": 0,
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "difficulty": "easy | medium | hard",
      "topic": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": "string",
      "explanation": "string"
    }
  ]
}

Rules:
- Return exactly ${input.questionCount} unique questions for this batch chunk (overall target ${input.totalTargetQuestions}).
- Use only "mcq" question type.
- Keep question and explanation concise (exam-style, not essay-style).
- Ensure 4 plausible options per question and only one correct answer.
- "answer" must be the exact option text from "options".
- Match real exam feel: balanced difficulty, time pressure, elimination-friendly distractors.
- Avoid coding/theory/open-ended formats.
- If mode is practice, estimatedDurationMinutes = 0; otherwise return realistic integer minutes >= 5.
`.trim();
};

const buildCurationPrompt = (input, existingQuestions = []) => {
  if (input.govExamMode) {
    return buildGovExamCurationPrompt(input, existingQuestions);
  }

  const typePlanText = Object.entries(input.typePlan)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  const selectedTopicsText =
    input.topics.length > 0 ? input.topics.join(', ') : 'All (no specific topic selected)';
  const selectedStylesText =
    input.requestedTypes.length > 0
      ? input.requestedTypes.join(', ')
      : 'mixed (all supported styles)';
  const exclusionText =
    existingQuestions.length > 0
      ? `\n- Existing questions to avoid repeating:\n${existingQuestions
          .slice(0, 25)
          .map((question, index) => `  ${index + 1}. ${question}`)
          .join('\n')}`
      : '';
  const difficultyGuidance = getProfessionalDifficultyGuidance(input.difficulty);
  const domainFocus = getDomainProfessionalFocus(input.domain);
  const modeGuidance = getAttemptModeGuidance(input.attemptMode);

  return `
Role: Create interview-grade technical assessment questions for IT professionals.
Output: strict JSON only (no markdown).

Input profile:
- Test: ${input.testTitle} (${input.testId || 'not-provided'})
- Domain: ${input.domain || 'General'}
- Mode: ${modeGuidance.modeLabel}
- Difficulty: ${input.difficulty}
- Topics: ${selectedTopicsText}
- Styles: ${selectedStylesText}
- Batch count: ${input.questionCount}
- Overall target: ${input.totalTargetQuestions}
- Type plan: ${typePlanText}
- Domain focus: ${domainFocus}
- Difficulty guidance: ${difficultyGuidance}
- Mode guidance: ${modeGuidance.guidance}
- Extra context: ${input.promptContext || 'None'}
${exclusionText}

Required JSON schema:
{
  "estimatedDurationMinutes": 0,
  "questions": [
    {
      "id": "q1",
      "type": "coding | mcq | theory | output | scenario",
      "difficulty": "easy | medium | hard",
      "topic": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": "string",
      "explanation": "string",
      "inputOutput": "string",
      "solutionApproach": "string",
      "sampleSolution": "string",
      "complexity": "string",
      "keyConsiderations": ["string"]
    }
  ]
}

Rules:
- Return exactly ${input.questionCount} unique questions for this batch chunk (overall target ${input.totalTargetQuestions}); follow type plan exactly: ${typePlanText}.
- Respect user constraints: mode=${modeGuidance.modeLabel}, difficulty=${input.difficulty}, styles=${selectedStylesText}, topics=${selectedTopicsText}.
- Estimated time: exam mode => realistic integer minutes >= 5; practice mode => 0.
- For "mcq" and "output" include exactly 4 options.
- For "coding", "theory", and "scenario", set options to [].
- Interview realism: prefer production incidents, tradeoffs, debugging, performance, reliability, security, observability, and maintainability.
- Avoid textbook trivia and vague prompts; keep questions specific and testable.
- Coding questions must include inputOutput, solutionApproach, and complexity.
- MCQ/output distractors must be plausible for experienced engineers.
- Mode behavior:
${modeGuidance.behaviorRules.map((rule) => `  - ${rule}`).join('\n')}
`.trim();
};

const extractJsonCandidate = (text) => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.slice(firstBracket, lastBracket + 1);
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
      // Try next parse candidate.
    }
  }

  throw new ApiError(502, 'AI provider returned invalid JSON');
};

const callOpenAI = async (prompt, providerModel = openaiModel) => {
  if (!openaiApiKey) {
    throw new ApiError(500, 'OPENAI_API_KEY is not configured');
  }

  const endpoint = `${String(openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: providerModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: Math.max(512, Number(openaiMaxTokens || 4096)),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(502, `OpenAI request failed: ${errorText.slice(0, 300)}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    throw new ApiError(502, 'OpenAI returned empty content');
  }

  return parseModelJson(content);
};

const callGemini = async (prompt, providerModel = geminiModel) => {
  if (!geminiApiKey) {
    throw new ApiError(500, 'GEMINI_API_KEY is not configured');
  }

  console.log('===== GEMINI CURATION PROMPT START =====');
  console.log(prompt);
  console.log('===== GEMINI CURATION PROMPT END =====');

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
    return candidates;
  };

  const configuredModels = Array.isArray(geminiModels) ? geminiModels : [];
  const modelsToTry = Array.from(
    new Set(
      [providerModel, ...configuredModels]
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
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastErrorText = `model=${modelName} status=${response.status} error=${errorText.slice(0, 300)}`;
      console.log(`===== GEMINI MODEL FAILED: ${modelName} (${response.status}) =====`);
      continue;
    }

    const result = await response.json();
    const content =
      result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';

    if (!content) {
      lastErrorText = `model=${modelName} returned empty content`;
      continue;
    }

    console.log(`===== GEMINI MODEL USED: ${modelName} =====`);
    console.log('===== GEMINI CURATION RESPONSE START =====');
    console.log(content.slice(0, 4000));
    console.log('===== GEMINI CURATION RESPONSE END =====');

    return parseModelJson(content);
  }

  throw new ApiError(502, `Gemini request failed across models. ${lastErrorText || 'No model succeeded'}`);
};

const sanitizeOptions = (options) => {
  if (!Array.isArray(options)) return [];
  const normalized = options
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
};

const normalizeQuestion = (question, index, fallbackDifficulty) => {
  const normalizedType = normalizeQuestionType(question?.type) || 'theory';
  const normalizedDifficulty = normalizeDifficulty(question?.difficulty || fallbackDifficulty);
  const normalizedQuestion = String(
    question?.question ||
      question?.questionText ||
      question?.prompt ||
      question?.title ||
      question?.problem ||
      ''
  ).trim();

  if (!normalizedQuestion) return null;

  let options = sanitizeOptions(question?.options);
  if (OPTIONS_REQUIRED_TYPES.has(normalizedType)) {
    if (options.length < 4) {
      options = [...options, 'Option A', 'Option B', 'Option C', 'Option D'].slice(0, 4);
    } else {
      options = options.slice(0, 4);
    }
  } else {
    options = [];
  }

  const normalized = {
    id: String(question?.id || `q${index + 1}`),
    type: normalizedType,
    difficulty: normalizedDifficulty,
    topic: String(question?.topic || question?.category || question?.subtopic || '').trim(),
    question: normalizedQuestion,
    options,
    answer: String(question?.answer || question?.correctAnswer || question?.expectedAnswer || '').trim(),
    explanation: String(question?.explanation || question?.rationale || '').trim(),
  };

  const optionalFields = [
    'inputOutput',
    'solutionApproach',
    'sampleSolution',
    'complexity',
    'code',
    'expectedOutput',
    'idealSolution',
  ];

  for (const field of optionalFields) {
    const value = String(question?.[field] || '').trim();
    if (value) normalized[field] = value;
  }

  if (Array.isArray(question?.keyConsiderations) && question.keyConsiderations.length > 0) {
    normalized.keyConsiderations = question.keyConsiderations
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return normalized;
};

const normalizeEstimatedDurationMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const rounded = Math.round(parsed);
  return Math.min(
    MAX_ESTIMATED_DURATION_MINUTES,
    Math.max(MIN_ESTIMATED_DURATION_MINUTES, rounded)
  );
};

const estimateDurationFromQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) return MIN_ESTIMATED_DURATION_MINUTES;

  const total = questions.reduce((sum, question) => {
    const type = normalizeQuestionType(question?.type) || 'mcq';
    return sum + (ESTIMATED_MINUTES_PER_TYPE[type] || ESTIMATED_MINUTES_PER_TYPE.mcq);
  }, 0);

  return normalizeEstimatedDurationMinutes(total) || MIN_ESTIMATED_DURATION_MINUTES;
};

const normalizeCurationOutput = (payload, input) => {
  const sourceQuestions = Array.isArray(payload?.questions)
    ? payload.questions
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.questions)
        ? payload.data.questions
        : Array.isArray(payload)
          ? payload
          : [];

  if (sourceQuestions.length === 0) {
    throw new ApiError(502, `AI provider returned empty question set; payload keys: ${Object.keys(payload || {}).join(', ')}`);
  }

  const normalizedQuestions = sourceQuestions
    .map((question, index) => normalizeQuestion(question, index, input.difficulty))
    .filter(Boolean);

  const uniqueQuestions = [];
  const seen = new Set();
  for (const question of normalizedQuestions) {
    const key = question.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueQuestions.push(question);
  }

  const boundedQuestions = uniqueQuestions.slice(0, input.questionCount);
  const isPracticeMode = input?.attemptMode === 'practice';
  const modelEstimatedDurationMinutes = isPracticeMode
    ? 0
    : normalizeEstimatedDurationMinutes(payload?.estimatedDurationMinutes);

  return {
    questions: boundedQuestions,
    estimatedDurationMinutes:
      modelEstimatedDurationMinutes ||
      (isPracticeMode ? 0 : estimateDurationFromQuestions(boundedQuestions)),
  };
};

const collectUniqueQuestions = (existing, incoming, maxCount) => {
  const merged = [...existing];
  const seen = new Set(existing.map((question) => question.question.toLowerCase()));

  for (const question of incoming) {
    const key = question.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(question);
    if (merged.length >= maxCount) break;
  }

  return merged;
};

const curateQuestions = async ({ payload, provider }) => {
  const selected = (provider || aiProvider || 'gemini').toLowerCase();
  const normalizedSelected = selected === 'chatgpt' ? 'openai' : selected;
  let providerChain = [];
  if (normalizedSelected === 'openai') {
    providerChain = aiProviderFallbackEnabled ? ['openai', 'gemini'] : ['openai'];
  } else if (normalizedSelected === 'gemini') {
    providerChain = aiProviderFallbackEnabled ? ['gemini', 'openai'] : ['gemini'];
  } else {
    throw new ApiError(400, `Unsupported AI provider: ${selected}`);
  }
  console.log('===== AI CURATION PROVIDER CONFIG =====');
  console.log(`selected=${normalizedSelected} fallbackEnabled=${aiProviderFallbackEnabled} chain=${providerChain.join(' -> ')}`);
  const normalizedInput = normalizeInput(payload);
  const batchSize = Math.max(
    5,
    Math.min(
      MAX_QUESTION_COUNT,
      Number.isFinite(Number(aiCurationBatchSize))
        ? Math.floor(Number(aiCurationBatchSize))
        : DEFAULT_CURATION_BATCH_SIZE
    )
  );
  const maxAttempts = Math.max(3, Math.ceil(normalizedInput.questionCount / batchSize) + 2);
  let collectedQuestions = [];
  let estimatedDurationMinutes = null;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const remaining = normalizedInput.questionCount - collectedQuestions.length;
    if (remaining <= 0) break;

    const overFetch = Math.min(3, remaining);
    const requestCount = Math.min(MAX_QUESTION_COUNT, Math.min(batchSize, remaining + overFetch));
    const requestInput = {
      ...normalizedInput,
      questionCount: requestCount,
      typePlan: buildTypePlan(normalizedInput.requestedTypes, requestCount),
    };

    const prompt = buildCurationPrompt(
      requestInput,
      collectedQuestions.map((question) => question.question)
    );
    const preferredGeminiModel = selectGeminiModelForInput(requestInput);
    console.log("====prompt===", prompt)
    try {
      let raw;
      const providerErrors = [];
      for (const providerName of providerChain) {
        console.log(`===== AI PROVIDER TRY: ${providerName} =====`);
        try {
          if (providerName === 'openai') {
            raw = await callOpenAI(prompt);
          } else {
            console.log(`===== GEMINI PREFERRED MODEL: ${preferredGeminiModel} =====`);
            raw = await callGemini(prompt, preferredGeminiModel);
          }
          console.log(`===== AI PROVIDER SUCCESS: ${providerName} =====`);
          if (providerName !== normalizedSelected) {
            console.log(`===== AI PROVIDER FALLBACK USED: ${providerName} =====`);
          }
          break;
        } catch (providerError) {
          console.log(`===== AI PROVIDER FAILED: ${providerName} =====`);
          providerErrors.push(
            `${providerName}: ${providerError?.message || 'unknown provider error'}`
          );
          lastError = providerError;
        }
      }

      if (!raw) {
        throw new ApiError(
          502,
          `All AI providers failed (${providerErrors.join(' | ') || 'no provider response'})`
        );
      }

      const normalized = normalizeCurationOutput(raw, requestInput);
      collectedQuestions = collectUniqueQuestions(
        collectedQuestions,
        normalized.questions,
        normalizedInput.questionCount
      );
      if (Number.isFinite(normalized.estimatedDurationMinutes)) {
        if (normalizedInput.attemptMode === 'practice') {
          estimatedDurationMinutes = 0;
        } else {
          const scaledEstimated = Math.round(
            (normalized.estimatedDurationMinutes * normalizedInput.questionCount) / requestInput.questionCount
          );
          estimatedDurationMinutes =
            normalizeEstimatedDurationMinutes(scaledEstimated) || estimatedDurationMinutes;
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (collectedQuestions.length < normalizedInput.questionCount) {
    if (lastError instanceof ApiError && lastError.statusCode === 400) {
      throw lastError;
    }
    throw new ApiError(
      502,
      `AI provider returned ${collectedQuestions.length} unique questions, expected ${normalizedInput.questionCount}. Last error: ${lastError?.message || 'none'}`
    );
  }

  const finalCurationResult = {
    questions: collectedQuestions.slice(0, normalizedInput.questionCount),
    estimatedDurationMinutes:
      normalizedInput.attemptMode === 'practice'
        ? 0
        : estimatedDurationMinutes ||
          estimateDurationFromQuestions(collectedQuestions.slice(0, normalizedInput.questionCount)),
  };

  console.log('===== FINAL QUESTION CURATION JSON START =====');
  console.log(JSON.stringify(finalCurationResult, null, 2));
  console.log('===== FINAL QUESTION CURATION JSON END =====');

  return finalCurationResult;
};

module.exports = {
  curateQuestions,
  _internal: {
    normalizeInput,
    buildTypePlan,
    buildCurationPrompt,
    parseModelJson,
    normalizeQuestionType,
    normalizeCurationOutput,
  },
};
