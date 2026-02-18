const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');

describe('Auth API', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  beforeEach(async () => {
    await User.deleteMany({});
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
});
