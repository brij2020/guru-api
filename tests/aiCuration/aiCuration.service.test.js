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

  test('curateQuestions throws for unsupported provider', async () => {
    await expect(
      service.curateQuestions({
        provider: 'unknown-provider',
        payload: { testTitle: 'Test', questionCount: 1 },
      })
    ).rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
  });

  test('curateQuestions calls gemini and returns normalized questions', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    questions: [
                      {
                        type: 'mcq',
                        difficulty: 'easy',
                        topic: 'JS',
                        question: 'Which is a primitive?',
                        options: ['string', 'object', 'array', 'map'],
                        answer: 'string',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const curated = await service.curateQuestions({
      provider: 'gemini',
      payload: {
        testTitle: 'JavaScript Test',
        difficulty: 'easy',
        questionCount: 1,
        topics: ['JS'],
        questionStyles: ['mcq'],
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(curated.questions).toHaveLength(1);
    expect(curated.questions[0]).toEqual(
      expect.objectContaining({
        type: 'mcq',
        difficulty: 'easy',
        question: 'Which is a primitive?',
      })
    );
  });
});
