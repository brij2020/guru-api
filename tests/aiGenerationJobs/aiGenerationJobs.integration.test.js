const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const QuestionBank = require('../../models/questionBank');
const AiGenerationJob = require('../../models/aiGenerationJob');
const AiGenerationOutput = require('../../models/aiGenerationOutput');
const aiCurationService = require('../../services/aiCurationService');

const buildQuestions = (count) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `q-${index + 1}`,
    type: 'mcq',
    difficulty: 'medium',
    topic: 'time management',
    question: `Generated question ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    explanation: 'Sample explanation',
  }));

describe('AI Generation Jobs API', () => {
  let mongoServer;
  let accessToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await User.deleteMany({});
    await QuestionBank.deleteMany({});
    await AiGenerationJob.deleteMany({});
    await AiGenerationOutput.deleteMany({});

    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      name: 'Admin User',
      email: 'admin.ai.jobs@example.com',
      password: 'Password1',
    });

    const userId = registerResponse.body?.data?.user?.id;
    await User.findByIdAndUpdate(userId, { role: 'admin' });

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'admin.ai.jobs@example.com',
      password: 'Password1',
    });
    accessToken = loginResponse.body?.data?.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('creates and lists AI generation jobs', async () => {
    const createResponse = await request(app)
      .post('/api/v1/ai-generation-jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'openai',
        payload: {
          testTitle: 'SBI Clerk Prelims',
          domain: 'Government Exam - SBI Clerk',
          difficulty: 'medium',
          topics: ['time management'],
          questionStyles: ['Single Correct MCQ'],
        },
        totalQuestions: 100,
        batchSize: 25,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body?.data?.status).toBe('queued');
    expect(createResponse.body?.data?.totalQuestions).toBe(100);

    const listResponse = await request(app)
      .get('/api/v1/ai-generation-jobs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body?.data?.total).toBe(1);
    expect(listResponse.body?.data?.items?.[0]?.totalQuestions).toBe(100);
  });

  it('processes a queued job batch and ingests questions into question bank', async () => {
    jest.spyOn(aiCurationService, 'curateQuestions').mockResolvedValue({
      questions: buildQuestions(10),
      estimatedDurationMinutes: 15,
    });

    const createResponse = await request(app)
      .post('/api/v1/ai-generation-jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        provider: 'openai',
        payload: {
          testTitle: 'SSC CGL Tier 1',
          domain: 'Government Exam - SSC CGL',
          difficulty: 'medium',
          topics: ['time management'],
          questionStyles: ['Single Correct MCQ'],
          examSlug: 'ssc-cgl',
          stageSlug: 'tier-1',
        },
        totalQuestions: 10,
        batchSize: 10,
      });

    const jobId = createResponse.body?.data?.id;
    expect(jobId).toBeTruthy();

    const processResponse = await request(app)
      .post('/api/v1/ai-generation-jobs/process-next')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ jobId });

    expect(processResponse.status).toBe(200);
    expect(processResponse.body?.data?.processed).toBe(true);
    expect(processResponse.body?.data?.batch?.status).toBe('success');
    expect(processResponse.body?.data?.batch?.generatedCount).toBe(10);
    expect(processResponse.body?.data?.job?.status).toBe('completed');

    const questionCount = await QuestionBank.countDocuments({});
    const outputCount = await AiGenerationOutput.countDocuments({});
    expect(questionCount).toBe(10);
    expect(outputCount).toBe(1);
  });
});
