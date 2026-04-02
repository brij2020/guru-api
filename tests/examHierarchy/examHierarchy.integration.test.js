const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const ExamHierarchy = require('../../models/examHierarchy');

describe('Exam Hierarchy API', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await ExamHierarchy.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  const registerUser = async (payload) => {
    const response = await request(app).post('/api/v1/auth/register').send(payload);
    expect(response.status).toBe(201);
    return response.body.data;
  };

  it('allows admin to upsert hierarchy and serves it publicly', async () => {
    const authData = await registerUser({
      name: 'Admin User',
      email: 'admin.hierarchy@example.com',
      password: 'Password1',
    });

    await User.findByIdAndUpdate(authData.user.id, { role: 'admin' });

    const payload = {
      name: 'Government Exams',
      tree: [
        {
          id: 1,
          title: 'Government Exams',
          children: [
            { id: 111, title: 'SSC Exams', slug: 'ssc-exams' },
            { id: 112, title: 'Civil Services Exam (UPSC)', slug: 'upsc-cse' },
          ],
        },
      ],
    };

    const putResponse = await request(app)
      .put('/api/v1/exam-hierarchy')
      .set('Authorization', `Bearer ${authData.accessToken}`)
      .send(payload);

    expect(putResponse.status).toBe(200);
    expect(putResponse.body.data.tree[0].children[0].slug).toBe('ssc-exams');

    const getResponse = await request(app).get('/api/v1/exam-hierarchy');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data).toBeTruthy();
    expect(getResponse.body.data.tree[0].title).toBe('Government Exams');
    expect(getResponse.body.data.tree[0].children).toHaveLength(2);
  });

  it('rejects non-admin hierarchy upsert requests', async () => {
    const authData = await registerUser({
      name: 'Regular User',
      email: 'regular.hierarchy@example.com',
      password: 'Password1',
    });

    const response = await request(app)
      .put('/api/v1/exam-hierarchy')
      .set('Authorization', `Bearer ${authData.accessToken}`)
      .send({
        name: 'Government Exams',
        tree: [{ id: 1, title: 'Government Exams' }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only admin users can manage exam hierarchy');
  });

  it('returns null when no hierarchy is configured', async () => {
    const response = await request(app).get('/api/v1/exam-hierarchy');
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });
});
