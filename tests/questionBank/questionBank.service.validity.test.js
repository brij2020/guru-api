const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('questionBankService valid field gating', () => {
  let mongoServer;
  let QuestionBank;
  let service;
  const ownerId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    process.env.QUESTION_BANK_MODE = 'db_first';
    process.env.QUESTION_BANK_MIN_VALID_FIELDS = 'question,options,answer';
    QuestionBank = require('../../models/questionBank');
    service = require('../../services/questionBankService');
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await QuestionBank.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  test('allows coding questions without options but still blocks mcq without options', async () => {
    await QuestionBank.create([
      {
        owner: ownerId,
        provider: 'seed',
        testId: 'javascript-advanced',
        testTitle: 'Advanced JavaScript',
        domain: 'Programming',
        difficulty: 'hard',
        type: 'coding',
        topic: 'event delegation',
        tags: ['event delegation'],
        question: 'Implement event delegation helper.',
        options: [],
        answer: 'Use closest() on event.target.',
        explanation: 'Delegate from parent.',
        fingerprint: 'validity-coding-1',
      },
      {
        owner: ownerId,
        provider: 'seed',
        testId: 'javascript-advanced',
        testTitle: 'Advanced JavaScript',
        domain: 'Programming',
        difficulty: 'hard',
        type: 'mcq',
        topic: 'event delegation',
        tags: ['event delegation'],
        question: 'Which API finds nearest matching ancestor?',
        options: [],
        answer: 'closest',
        explanation: 'closest traverses ancestors.',
        fingerprint: 'validity-mcq-empty-1',
      },
      {
        owner: ownerId,
        provider: 'seed',
        testId: 'javascript-advanced',
        testTitle: 'Advanced JavaScript',
        domain: 'Programming',
        difficulty: 'hard',
        type: 'mcq',
        topic: 'event loop',
        tags: ['event loop'],
        question: 'Which queue runs Promise callbacks?',
        options: ['task', 'microtask', 'render', 'io'],
        answer: 'microtask',
        explanation: 'Promises schedule microtasks.',
        fingerprint: 'validity-mcq-good-1',
      },
    ]);

    const codingOnly = await service.pullSimilarQuestions({
      ownerId,
      filters: {
        questionCount: 5,
        domain: 'Programming',
        difficulty: 'all',
        topics: ['event delegation'],
        questionStyles: ['problem solving'],
      },
    });

    expect(codingOnly.count).toBe(1);
    expect(codingOnly.questions[0].type).toBe('coding');

    const mcqOnly = await service.pullSimilarQuestions({
      ownerId,
      filters: {
        questionCount: 5,
        domain: 'Programming',
        difficulty: 'all',
        topics: ['event delegation', 'event loop'],
        questionStyles: ['mcq'],
      },
    });

    expect(mcqOnly.count).toBe(1);
    expect(mcqOnly.questions[0].type).toBe('mcq');
    expect(Array.isArray(mcqOnly.questions[0].options)).toBe(true);
    expect(mcqOnly.questions[0].options.length).toBeGreaterThan(0);
  });
});
