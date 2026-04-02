const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const Category = require('../../models/category');
const Topic = require('../../models/topic');
const QuestionStyle = require('../../models/questionStyle');
const DifficultyLevel = require('../../models/difficultyLevel');
const QuestionCount = require('../../models/questionCount');
const TestAttempt = require('../../models/testAttempt');
const QuestionBank = require('../../models/questionBank');
const QuestionBankUsage = require('../../models/questionBankUsage');
const MockPaper = require('../../models/mockPaper');
const PaperBlueprint = require('../../models/paperBlueprint');
const QuestionReviewAudit = require('../../models/questionReviewAudit');
const aiCurationService = require('../../services/aiCurationService');

describe('Auth API', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Topic.deleteMany({});
    await QuestionStyle.deleteMany({});
    await DifficultyLevel.deleteMany({});
    await QuestionCount.deleteMany({});
    await TestAttempt.deleteMany({});
    await QuestionBank.deleteMany({});
    await QuestionBankUsage.deleteMany({});
    await MockPaper.deleteMany({});
    await PaperBlueprint.deleteMany({});
    await QuestionReviewAudit.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('registers a user and returns tokens', async () => {
    const payload = {
      name: 'Test User',
      email: 'test.user@example.com',
      password: 'Password1',
    };

    const response = await request(app).post('/api/v1/auth/register').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
    expect(response.body.data.user.email).toBe(payload.email.toLowerCase());
    expect(response.body.data.user).not.toHaveProperty('password');

    const category = await Category.findOne({
      owner: response.body.data.user.id,
      name: 'AI Test',
    });
    expect(category).toBeTruthy();
    expect(category.description).toBe('Default category for AI test items');

    const javascriptCategory = await Category.findOne({
      owner: response.body.data.user.id,
      name: 'JavaScript',
    });
    expect(javascriptCategory).toBeTruthy();

    const topics = await Topic.find({
      owner: response.body.data.user.id,
      category: javascriptCategory._id,
    })
      .sort({ name: 1 })
      .select('name');
    expect(topics.map((topic) => topic.name)).toEqual([
      'Event Delegation',
      'Event Loop',
      'Promise',
    ]);

    const questionStyles = await QuestionStyle.find({
      owner: response.body.data.user.id,
      category: javascriptCategory._id,
    })
      .sort({ style: 1 })
      .select('style');
    expect(questionStyles.map((item) => item.style)).toEqual([
      'MCQ',
      'Output Based',
      'Problem Solving',
    ]);
  });

  it('logs in an existing user and returns fresh tokens', async () => {
    const payload = {
      name: 'Login User',
      email: 'login.user@example.com',
      password: 'Password1',
    };

    await request(app).post('/api/v1/auth/register').send(payload);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
    expect(response.body.data.user.email).toBe(payload.email.toLowerCase());
  });

  it('logs out a user and clears the stored refresh token hash', async () => {
    const payload = {
      name: 'Logout User',
      email: 'logout.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Logged out successfully');

    const user = await User.findById(userId).select('+refreshTokenHash');
    expect(user.refreshTokenHash).toBeNull();
  });

  it('creates multiple topics from titles in one request', async () => {
    const payload = {
      name: 'Bulk Topic User',
      email: 'bulk.topic.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    const category = await Category.findOne({ owner: userId, name: 'JavaScript' });

    const createResponse = await request(app)
      .post('/api/v1/topics')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryId: category._id.toString(),
        titles: ['Closures', 'Hoisting'],
        description: 'Core JS concepts',
      });

    expect(createResponse.status).toBe(201);
    expect(Array.isArray(createResponse.body.data)).toBe(true);
    expect(createResponse.body.data).toHaveLength(2);

    const created = await Topic.find({
      owner: userId,
      category: category._id,
      name: { $in: ['Closures', 'Hoisting'] },
    });
    expect(created).toHaveLength(2);
  });

  it('creates and updates question style through API', async () => {
    const payload = {
      name: 'Question Style User',
      email: 'question.style.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    const category = await Category.findOne({ owner: userId, name: 'JavaScript' });

    const createResponse = await request(app)
      .post('/api/v1/question-styles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryId: category._id.toString(),
        style: 'Code Tracing',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.style).toBe('Code Tracing');

    const styleId = createResponse.body.data._id;
    const updateResponse = await request(app)
      .put(`/api/v1/question-styles/${styleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        style: 'Scenario Based',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.style).toBe('Scenario Based');
  });

  it('creates multiple question styles in one request', async () => {
    const payload = {
      name: 'Bulk Question Style User',
      email: 'bulk.question.style.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;
    const category = await Category.findOne({ owner: userId, name: 'JavaScript' });

    const createResponse = await request(app)
      .post('/api/v1/question-styles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryId: category._id.toString(),
        styles: ['mcq', 'io'],
      });

    expect(createResponse.status).toBe(201);
    expect(Array.isArray(createResponse.body.data)).toBe(true);
    expect(createResponse.body.data).toHaveLength(2);

    const created = await QuestionStyle.find({
      owner: userId,
      category: category._id,
      style: { $in: ['mcq', 'io'] },
    });
    expect(created).toHaveLength(2);
  });

  it('creates and lists difficulty levels through API', async () => {
    const payload = {
      name: 'Difficulty Manager User',
      email: 'difficulty.manager.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;

    const createResponse = await request(app)
      .post('/api/v1/difficulty-levels')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        level: 'Expert',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.level).toBe('Expert');

    const listResponse = await request(app)
      .get('/api/v1/difficulty-levels')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((item) => item.level === 'Expert')).toBe(true);
  });

  it('creates and lists question counts through API', async () => {
    const payload = {
      name: 'Question Count User',
      email: 'question.count.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;

    const createResponse = await request(app)
      .post('/api/v1/question-counts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        count: 12,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.count).toBe(12);

    const listResponse = await request(app)
      .get('/api/v1/question-counts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((item) => item.count === 12)).toBe(true);
  });

  it('starts a test attempt through API', async () => {
    const payload = {
      name: 'Start Test User',
      email: 'start.test.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    const startResponse = await request(app)
      .post('/api/v1/test-attempts/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        testId: 'heart-anatomy-quiz',
        testTitle: 'Heart Anatomy Quiz',
        domain: 'Anatomy',
        difficulty: 'easy',
        topics: ['cardiology'],
        questionStyles: ['mcq'],
        questionCount: '10',
        totalQuestions: 10,
        duration: 20,
      });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.data.testTitle).toBe('Heart Anatomy Quiz');
    expect(startResponse.body.data.owner).toBe(userId);
    expect(startResponse.body.data.questionCount).toBe('10');
    expect(Array.isArray(startResponse.body.data.curatedQuestions)).toBe(true);
    expect(startResponse.body.data.curatedQuestions).toHaveLength(10);
    expect(startResponse.body.data.totalQuestions).toBe(10);
  });

  it('curates questions from start payload (difficulty/topic/styles/count)', async () => {
    const payload = {
      name: 'Curation Payload User',
      email: 'curation.payload.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;

    const startResponse = await request(app)
      .post('/api/v1/test-attempts/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        testId: 't1',
        testTitle: 'Heart Anatomy Quiz',
        domain: 'Cardiology',
        difficulty: 'basic',
        topics: ['es-6', 'event loop'],
        questionStyles: ['mcq', 'io', 'html'],
        questionCount: '20',
        totalQuestions: 0,
        duration: 20,
      });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.data.testId).toBe('t1');
    expect(startResponse.body.data.questionCount).toBe('20');
    expect(startResponse.body.data.totalQuestions).toBe(20);
    expect(Array.isArray(startResponse.body.data.curatedQuestions)).toBe(true);
    expect(startResponse.body.data.curatedQuestions).toHaveLength(20);

    const styles = new Set(startResponse.body.data.curatedQuestions.map((item) => item.type));
    expect(styles.has('mcq') || styles.has('output')).toBe(true);
  });

  it('returns question-bank similar questions with diagnostics', async () => {
    const payload = {
      name: 'Question Bank User',
      email: 'question.bank.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    await QuestionBank.create({
      owner: userId,
      provider: 'openai',
      testId: 'gov-ssc-cgl-tier-1',
      testTitle: 'SSC CGL Tier 1',
      domain: 'Government Exam - SSC CGL',
      difficulty: 'medium',
      type: 'mcq',
      topic: 'time management',
      tags: ['tier-1', 'time management'],
      promptContext: 'sample prompt',
      question: 'What is the best strategy to minimize negative marking?',
      options: ['Skip doubtful questions', 'Attempt all blindly', 'Only attempt hard questions', 'Ignore time limits'],
      answer: 'Skip doubtful questions',
      explanation: 'Conservative attempts reduce penalty risk.',
      fingerprint: 'test-fingerprint-001',
    });

    const response = await request(app)
      .post('/api/v1/question-bank/similar')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        domain: 'Government Exam - SSC CGL',
        difficulty: 'medium',
        topics: ['time management'],
        questionStyles: ['Single Correct MCQ'],
        questionCount: 10,
      });

    expect(response.status).toBe(200);
    expect(typeof response.body.data.count).toBe('number');
    expect(Array.isArray(response.body.data.questions)).toBe(true);
    expect(response.body.data).toHaveProperty('matchedBy');
    expect(response.body.data).toHaveProperty('diagnostics');
    expect(response.body.data.diagnostics).toEqual(
      expect.objectContaining({
        ownerId: userId,
        mode: expect.any(String),
        validFieldGate: expect.any(Array),
      })
    );
  });

  it('assembles a blueprint-based paper from question bank', async () => {
    const payload = {
      name: 'Paper Assembler User',
      email: 'paper.assembler.user@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const accessToken = registerResponse.body.data.accessToken;
    const userId = registerResponse.body.data.user.id;

    await QuestionBank.create({
      owner: userId,
      provider: 'openai',
      testId: 'gov-ssc-cgl-tier-1',
      testTitle: 'SSC CGL Tier 1',
      domain: 'Government Exam - SSC CGL',
      difficulty: 'medium',
      type: 'mcq',
      topic: 'english-comprehension',
      tags: ['english-comprehension', 'tier-1'],
      question: 'Choose the correct synonym of "rapid".',
      options: ['Slow', 'Swift', 'Weak', 'Late'],
      answer: 'Swift',
      explanation: 'Rapid means swift.',
      fingerprint: 'test-fingerprint-assembler-001',
    });

    const response = await request(app)
      .post('/api/v1/question-bank/assemble-paper')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        domain: 'Government Exam - SSC CGL',
        difficulty: 'medium',
        topics: ['tier-1'],
        questionStyles: ['Single Correct MCQ'],
        questionCount: 20,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('paper');
    expect(Array.isArray(response.body.data.paper.questions)).toBe(true);
    expect(response.body.data.paper).toHaveProperty('sectionPlan');
    expect(response.body.data.paper).toHaveProperty('paperId');
    expect(response.body.data).toHaveProperty('diagnostics');
    expect(response.body.data.diagnostics).toEqual(
      expect.objectContaining({
        finalServed: expect.any(Number),
        dbCount: expect.any(Number),
        aiTopupCount: expect.any(Number),
      })
    );
  });

  it('upserts and fetches paper blueprint', async () => {
    const payload = {
      name: 'Blueprint Admin',
      email: 'blueprint.admin@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(payload);
    const adminId = registerResponse.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password });
    const accessToken = loginResponse.body.data.accessToken;

    const putResponse = await request(app)
      .put('/api/v1/paper-blueprints')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        name: 'SSC CGL Tier 1 Blueprint',
        totalQuestions: 10,
        sections: [
          { key: 'general-awareness', label: 'General Awareness', count: 5 },
          { key: 'english-comprehension', label: 'English', count: 5 },
        ],
        difficultyMix: { easy: 0.2, medium: 0.6, hard: 0.2 },
        isActive: true,
      });

    expect(putResponse.status).toBe(200);
    expect(putResponse.body.data.examSlug).toBe('ssc-cgl');

    const getResponse = await request(app)
      .get('/api/v1/paper-blueprints')
      .query({ examSlug: 'ssc-cgl', stageSlug: 'tier-1' });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data).toEqual(
      expect.objectContaining({
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        totalQuestions: 10,
      })
    );
  });

  it('lists and updates question review queue in global admin scope', async () => {
    const adminPayload = {
      name: 'Review Admin',
      email: 'review.admin@example.com',
      password: 'Password1',
    };
    const userPayload = {
      name: 'Review Owner',
      email: 'review.owner@example.com',
      password: 'Password1',
    };

    const adminRegister = await request(app).post('/api/v1/auth/register').send(adminPayload);
    const adminId = adminRegister.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminPayload.email, password: adminPayload.password });
    const adminToken = adminLogin.body.data.accessToken;

    const userRegister = await request(app).post('/api/v1/auth/register').send(userPayload);
    const ownerId = userRegister.body.data.user.id;

    const inserted = await QuestionBank.create({
      owner: ownerId,
      provider: 'openai',
      testId: 'gov-ssc-cgl-tier-1',
      testTitle: 'SSC CGL Tier 1',
      domain: 'Government Exam - SSC CGL',
      examSlug: 'ssc-cgl',
      stageSlug: 'tier-1',
      section: 'general-awareness',
      difficulty: 'medium',
      type: 'mcq',
      topic: 'polity',
      tags: ['polity', 'tier-1'],
      promptContext: 'review test',
      question: 'Who appoints the Chief Election Commissioner?',
      options: ['PM', 'President', 'Parliament', 'Supreme Court'],
      answer: 'President',
      explanation: 'Constitutional post appointed by President.',
      reviewStatus: 'draft',
      fingerprint: 'review-global-scope-001',
    });

    const listResponse = await request(app)
      .get('/api/v1/question-bank/review-list')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        scope: 'global',
        reviewStatus: 'draft',
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
      });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.scope).toBe('global');
    expect(Array.isArray(listResponse.body.data.items)).toBe(true);
    expect(listResponse.body.data.items.some((item) => item.id === String(inserted._id))).toBe(true);

    const updateResponse = await request(app)
      .put('/api/v1/question-bank/review-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ids: [String(inserted._id)],
        reviewStatus: 'approved',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.matched).toBeGreaterThanOrEqual(1);
    expect(updateResponse.body.data.modified).toBeGreaterThanOrEqual(1);

    const updated = await QuestionBank.findById(inserted._id);
    expect(updated.reviewStatus).toBe('approved');
    expect(String(updated.reviewedBy)).toBe(String(adminId));
    expect(updated.reviewedAt).toBeTruthy();

    const auditRows = await QuestionReviewAudit.find({ questionId: inserted._id });
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0].fromStatus).toBe('draft');
    expect(auditRows[0].toStatus).toBe('approved');
  });

  it('returns coverage snapshot with blueprint targets and gaps', async () => {
    const adminPayload = {
      name: 'Coverage Admin',
      email: 'coverage.admin@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(adminPayload);
    const adminId = registerResponse.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminPayload.email, password: adminPayload.password });
    const accessToken = loginResponse.body.data.accessToken;

    await PaperBlueprint.create({
      owner: adminId,
      examSlug: 'ssc-cgl',
      stageSlug: 'tier-1',
      name: 'Coverage Blueprint',
      totalQuestions: 10,
      sections: [
        { key: 'general-awareness', label: 'General Awareness', count: 5 },
        { key: 'english-comprehension', label: 'English', count: 5 },
      ],
      difficultyMix: { easy: 0.2, medium: 0.6, hard: 0.2 },
      isActive: true,
    });

    await QuestionBank.insertMany([
      {
        owner: adminId,
        provider: 'openai',
        testId: 't-coverage-1',
        testTitle: 'Coverage 1',
        domain: 'Government Exam - SSC CGL',
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        section: 'general-awareness',
        difficulty: 'medium',
        type: 'mcq',
        topic: 'history',
        question: 'Coverage question 1',
        options: ['a', 'b', 'c', 'd'],
        answer: 'a',
        explanation: 'exp',
        reviewStatus: 'approved',
        fingerprint: 'coverage-fp-1',
      },
      {
        owner: adminId,
        provider: 'openai',
        testId: 't-coverage-2',
        testTitle: 'Coverage 2',
        domain: 'Government Exam - SSC CGL',
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        section: 'english-comprehension',
        difficulty: 'easy',
        type: 'mcq',
        topic: 'grammar',
        question: 'Coverage question 2',
        options: ['a', 'b', 'c', 'd'],
        answer: 'b',
        explanation: 'exp',
        reviewStatus: 'draft',
        fingerprint: 'coverage-fp-2',
      },
    ]);

    const response = await request(app)
      .get('/api/v1/question-bank/coverage')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ examSlug: 'ssc-cgl', stageSlug: 'tier-1' });

    expect(response.status).toBe(200);
    expect(response.body.data.hasBlueprint).toBe(true);
    expect(response.body.data.summary).toEqual(
      expect.objectContaining({
        totalTarget: 10,
        totalAvailableAll: expect.any(Number),
        totalAvailableApproved: expect.any(Number),
      })
    );
    expect(Array.isArray(response.body.data.byDifficulty)).toBe(true);
    expect(response.body.data.byDifficulty).toHaveLength(3);
    expect(Array.isArray(response.body.data.sectionDifficulty)).toBe(true);
    expect(response.body.data.sectionDifficulty.length).toBeGreaterThan(0);
  });

  it('processes worker-run job endpoint with worker secret', async () => {
    const curationSpy = jest.spyOn(aiCurationService, 'curateQuestions').mockResolvedValue({
      estimatedDurationMinutes: 5,
      questions: [
        {
          id: 'w1',
          type: 'mcq',
          difficulty: 'easy',
          topic: 'general-awareness',
          question: 'Worker generated question?',
          options: ['A', 'B', 'C', 'D'],
          answer: 'A',
          explanation: 'x',
        },
      ],
    });

    const adminPayload = {
      name: 'Worker Admin',
      email: 'worker.admin@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(adminPayload);
    const adminId = registerResponse.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminPayload.email, password: adminPayload.password });
    const accessToken = loginResponse.body.data.accessToken;

    const jobCreateResponse = await request(app)
      .post('/api/v1/ai-generation-jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'openai',
        totalQuestions: 5,
        batchSize: 5,
        maxRetries: 1,
        payload: {
          testId: 'job-worker-test',
          testTitle: 'Worker Trigger Test',
          domain: 'Government Exam - SSC CGL',
          attemptMode: 'exam',
          difficulty: 'easy',
          topics: ['general-awareness'],
          questionStyles: ['mcq'],
          examSlug: 'ssc-cgl',
          stageSlug: 'tier-1',
          promptContext: 'Generate sample questions',
        },
      });

    expect(jobCreateResponse.status).toBe(201);
    const jobId = jobCreateResponse.body.data.id;

    const workerResponse = await request(app)
      .post('/api/v1/ai-generation-jobs/worker-run')
      .send({ ownerId: adminId, jobId });

    expect(workerResponse.status).toBe(200);
    expect(workerResponse.body.data).toHaveProperty('processed', true);
    curationSpy.mockRestore();
  });

  it('returns admin system metrics', async () => {
    const adminPayload = {
      name: 'Metrics Admin',
      email: 'metrics.admin@example.com',
      password: 'Password1',
    };

    const registerResponse = await request(app).post('/api/v1/auth/register').send(adminPayload);
    const adminId = registerResponse.body.data.user.id;
    await User.findByIdAndUpdate(adminId, { role: 'admin' });
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminPayload.email, password: adminPayload.password });
    const accessToken = loginResponse.body.data.accessToken;

    const response = await request(app)
      .get('/api/v1/system/metrics')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        users: expect.any(Object),
        questionBank: expect.any(Object),
        aiJobs: expect.any(Object),
      })
    );
  });
});
