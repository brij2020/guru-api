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

describe('Auth API', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
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
});
