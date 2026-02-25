const ApiError = require('../errors/apiError');
const {
  aiProvider,
  openaiApiKey,
  openaiBaseUrl,
  openaiModel,
  geminiApiKey,
  geminiModel,
} = require('../config/env');

const VERDICTS = new Set(['correct', 'partial', 'incorrect', 'unattempted']);

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
      // Try next candidate.
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
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(502, `OpenAI request failed: ${errorText.slice(0, 300)}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new ApiError(502, 'OpenAI returned empty content');
  return parseModelJson(content);
};

const callGemini = async (prompt, providerModel = geminiModel) => {
  if (!geminiApiKey) {
    throw new ApiError(500, 'GEMINI_API_KEY is not configured');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    providerModel
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
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(502, `Gemini request failed: ${errorText.slice(0, 300)}`);
  }

  const result = await response.json();
  const content =
    result?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';

  if (!content) {
    throw new ApiError(502, 'Gemini returned empty content');
  }

  return parseModelJson(content);
};

const hasMeaningfulAnswer = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeVerdict = (value, hasAnswer) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (VERDICTS.has(normalized)) return normalized;
  return hasAnswer ? 'incorrect' : 'unattempted';
};

const getDefaultScore = (verdict) => {
  if (verdict === 'correct') return 1;
  if (verdict === 'partial') return 0.5;
  return 0;
};

const buildEvaluationPrompt = (payload) => {
  const compactQuestions = payload.questions.map((question, index) => ({
    questionIndex: index,
    type: question.type,
    difficulty: question.difficulty,
    question: question.question,
    expectedAnswer: question.answer || '',
    userAnswer: payload.userAnswers?.[index]?.value ?? null,
    status: payload.questionStatus?.[index] || 'unanswered',
    timeSpentSec: Number(payload.questionTimeSpent?.[index] || 0),
  }));

  return `
Role: Evaluate candidate responses for an IT mock interview test.
Output: strict JSON only.

Context:
- Test: ${payload.testInfo?.title || 'Test'}
- Domain: ${payload.testInfo?.domain || 'General'}
- Total questions: ${compactQuestions.length}

Required JSON:
{
  "summary": {
    "overallFeedback": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  },
  "questionFeedback": [
    {
      "questionIndex": 0,
      "verdict": "correct | partial | incorrect | unattempted",
      "score": 0,
      "feedback": "string",
      "improvement": "string",
      "expectedAnswer": "string"
    }
  ]
}

Rules:
- Return one questionFeedback item for each questionIndex.
- Keep scoring strict for MCQ/output exactness.
- For coding/theory/scenario: score by technical correctness, completeness, and practicality.
- Use score range [0, 1].
- If userAnswer is empty, verdict must be "unattempted" and score 0.
- Keep feedback concise and actionable for interview preparation.

Data:
${JSON.stringify(compactQuestions)}
`.trim();
};

const normalizeEvaluationOutput = (raw, payload) => {
  const sourceFeedback = Array.isArray(raw?.questionFeedback) ? raw.questionFeedback : [];
  const normalizedFeedback = payload.questions.map((question, index) => {
    const fromModel = sourceFeedback.find((item) => Number(item?.questionIndex) === index) || {};
    const userAnswer = payload.userAnswers?.[index]?.value ?? null;
    const answerPresent = hasMeaningfulAnswer(userAnswer);
    const verdict = normalizeVerdict(fromModel?.verdict, answerPresent);
    const rawScore = Number(fromModel?.score);
    const score = Number.isFinite(rawScore) ? clamp(rawScore, 0, 1) : getDefaultScore(verdict);

    return {
      questionIndex: index,
      verdict,
      score,
      feedback: String(fromModel?.feedback || '').trim(),
      improvement: String(fromModel?.improvement || '').trim(),
      expectedAnswer: String(fromModel?.expectedAnswer || question.answer || '').trim(),
    };
  });

  const totalQuestions = payload.questions.length;
  const attemptedCount = normalizedFeedback.filter((item) => item.verdict !== 'unattempted').length;
  const correctCount = normalizedFeedback.filter((item) => item.verdict === 'correct').length;
  const totalScore = normalizedFeedback.reduce((sum, item) => sum + item.score, 0);
  const roundedScore = Math.round(totalScore);

  return {
    summary: {
      score: roundedScore,
      totalQuestions,
      correctCount,
      attemptedCount,
      percentage: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0,
      overallFeedback: String(raw?.summary?.overallFeedback || '').trim(),
      strengths: Array.isArray(raw?.summary?.strengths)
        ? raw.summary.strengths.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
        : [],
      improvements: Array.isArray(raw?.summary?.improvements)
        ? raw.summary.improvements.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
        : [],
    },
    questionFeedback: normalizedFeedback,
  };
};

const evaluateTest = async ({ payload, provider }) => {
  const selected = (provider || aiProvider || 'gemini').toLowerCase();
  const prompt = buildEvaluationPrompt(payload);

  let raw;
  if (selected === 'chatgpt' || selected === 'openai') {
    raw = await callOpenAI(prompt);
  } else if (selected === 'gemini') {
    raw = await callGemini(prompt);
  } else {
    throw new ApiError(400, `Unsupported AI provider: ${selected}`);
  }

  return normalizeEvaluationOutput(raw, payload);
};

module.exports = {
  evaluateTest,
};

