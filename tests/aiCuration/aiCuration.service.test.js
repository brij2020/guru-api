describe('aiCurationService internals', () => {
  let service;
  let internals;

  beforeEach(() => {
    jest.resetModules();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    process.env.GEMINI_MODEL = 'gemini-1.5-flash';
    service = require('../../services/aiCurationService');
    internals = service._internal;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('normalizeInput applies defaults and mixed type planning', () => {
    const normalized = internals.normalizeInput({
      testTitle: 'React Mock',
      difficulty: 'invalid-value',
      questionCount: 'all',
      questionStyles: [],
      topics: ['Hooks', 'Hooks', 'Rendering'],
    });

    expect(normalized.questionCount).toBe(20);
    expect(normalized.difficulty).toBe('medium');
    expect(normalized.topics).toEqual(['Hooks', 'Rendering']);
    expect(normalized.typePlan).toEqual({
      coding: 6,
      mcq: 4,
      theory: 4,
      output: 3,
      scenario: 3,
    });
  });

  test('normalizeInput uses totalQuestions when questionCount is all', () => {
    const normalized = internals.normalizeInput({
      testTitle: 'Advanced JavaScript',
      questionCount: 'all',
      totalQuestions: 5,
      questionStyles: ['mcq'],
    });

    expect(normalized.questionCount).toBe(5);
    expect(normalized.isAllRequested).toBe(true);
  });

  test('parseModelJson parses fenced JSON content', () => {
    const parsed = internals.parseModelJson('```json\n{"questions":[{"question":"Q1"}]}\n```');
    expect(Array.isArray(parsed.questions)).toBe(true);
    expect(parsed.questions).toHaveLength(1);
  });

  test('normalizeCurationOutput normalizes types/options and enforces count', () => {
    const output = internals.normalizeCurationOutput(
      {
        questions: [
          {
            type: 'multiple-choice',
            difficulty: 'easy',
            topic: 'React',
            question: 'What hook handles state?',
            options: ['useMemo', 'useState'],
            answer: 'useState',
          },
          {
            type: 'conceptual',
            difficulty: 'hard',
            question: 'Explain reconciliation in React.',
            explanation: 'Virtual DOM diff process.',
          },
        ],
      },
      {
        questionCount: 2,
        difficulty: 'medium',
      }
    );

    expect(output.questions).toHaveLength(2);
    expect(output.questions[0].type).toBe('mcq');
    expect(output.questions[0].options).toHaveLength(4);
    expect(output.questions[1].type).toBe('theory');
    expect(output.questions[1].options).toEqual([]);
  });

});

describe('aiCurationService ownership-aware DB pull', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses request userId for non-GOV curation pulls', async () => {
    const pullSimilarQuestions = jest.fn().mockResolvedValue({
      questions: [
        {
          type: 'coding',
          difficulty: 'hard',
          topic: 'event delegation',
          question: 'Implement delegated click handling.',
          options: [],
          answer: 'Use target.closest(selector).',
          explanation: 'Delegate from parent.',
        },
      ],
    });

    jest.doMock('../../services/questionBankService', () => ({
      pullSimilarQuestions,
    }));

    const service = require('../../services/aiCurationService');
    const curated = await service.curateQuestions({
      provider: 'mongodb',
      userId: '69b055efc90c934e323fa0f3',
      payload: {
        testId: 'javascript-advanced',
        testTitle: 'Advanced JavaScript',
        domain: 'Programming',
        difficulty: 'hard',
        topics: ['event delegation'],
        questionStyles: ['problem solving'],
        questionCount: 1,
      },
    });

    expect(curated.questions).toHaveLength(1);
    expect(pullSimilarQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: '69b055efc90c934e323fa0f3',
      })
    );
  });

  test('keeps GOV curation pulls on global scope', async () => {
    const pullSimilarQuestions = jest.fn().mockResolvedValue({
      questions: [
        {
          type: 'mcq',
          difficulty: 'medium',
          topic: 'quant',
          question: 'What is 10% of 200?',
          options: ['10', '20', '30', '40'],
          answer: '20',
          explanation: '10% of 200 is 20.',
        },
      ],
    });

    jest.doMock('../../services/questionBankService', () => ({
      pullSimilarQuestions,
    }));

    const service = require('../../services/aiCurationService');
    const curated = await service.curateQuestions({
      provider: 'mongodb',
      userId: '69b055efc90c934e323fa0f3',
      payload: {
        testId: 'gov-ssc-cgl-tier-1',
        testTitle: 'SSC CGL Tier 1',
        domain: 'Government Exam',
        difficulty: 'medium',
        topics: ['quant'],
        questionStyles: ['mcq'],
        questionCount: 1,
      },
    });

    expect(curated.questions).toHaveLength(1);
    expect(pullSimilarQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: null,
      })
    );
  });

  test('returns available questions for all-request even when below default target', async () => {
    const pullSimilarQuestions = jest.fn().mockResolvedValue({
      questions: [
        {
          type: 'coding',
          difficulty: 'hard',
          topic: 'event delegation',
          question: 'Q1',
          options: [],
          answer: 'A1',
          explanation: 'E1',
        },
        {
          type: 'mcq',
          difficulty: 'medium',
          topic: 'event loop',
          question: 'Q2',
          options: ['a', 'b', 'c', 'd'],
          answer: 'a',
          explanation: 'E2',
        },
      ],
    });

    jest.doMock('../../services/questionBankService', () => ({
      pullSimilarQuestions,
    }));

    const service = require('../../services/aiCurationService');
    const curated = await service.curateQuestions({
      provider: 'mongodb',
      userId: '69b055efc90c934e323fa0f3',
      payload: {
        testId: 'javascript-advanced',
        testTitle: 'Advanced JavaScript',
        domain: 'Programming',
        difficulty: 'all',
        topics: [],
        questionStyles: [],
        questionCount: 'all',
        totalQuestions: 5,
      },
    });

    expect(curated.questions).toHaveLength(2);
  });
});
