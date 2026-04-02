const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const PaperBlueprint = require('../../models/paperBlueprint');

describe('Paper Blueprints API', () => {
  let mongoServer;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await PaperBlueprint.deleteMany({});

    const adminRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Blueprint Admin',
      email: 'blueprint.admin@example.com',
      password: 'Password1',
    });
    adminUser = adminRes.body.data.user;
    adminToken = adminRes.body.data.accessToken;
    await User.findByIdAndUpdate(adminUser.id, { role: 'admin' });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('POST /api/v1/paper-blueprints', () => {
    it('creates blueprint with sections having empty topics', async () => {
      const payload = {
        examSlug: 'upsc-cse',
        stageSlug: 'prelims',
        name: 'UPSC Prelims Blueprint',
        totalQuestions: 200,
        sections: [
          { key: 'gs-1', label: 'General Studies I', count: 100, topics: [] },
          { key: 'csat', label: 'CSAT', count: 80, topics: [] },
        ],
        difficultyMix: { easy: 0.3, medium: 0.5, hard: 0.2 },
        isActive: true,
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.sections).toHaveLength(2);
      expect(response.body.data.sections[0].topics).toEqual([]);
      expect(response.body.data.sections[1].topics).toEqual([]);
    });

    it('creates blueprint with sections having topics', async () => {
      const payload = {
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        name: 'SSC CGL Tier 1 Blueprint',
        totalQuestions: 100,
        sections: [
          { key: 'reasoning', label: 'Reasoning', count: 25, topics: ['analogy', 'series'] },
          { key: 'english', label: 'English', count: 25, topics: ['grammar', 'vocabulary'] },
          { key: 'math', label: 'Math', count: 25, topics: ['percentage', 'ratio'] },
          { key: 'ga', label: 'GA', count: 25, topics: ['history', 'geography'] },
        ],
        difficultyMix: { easy: 0.5, medium: 0.35, hard: 0.15 },
        isActive: true,
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.sections[0].topics).toContain('analogy');
    });

    it('creates blueprint with null/undefined topics gracefully handled', async () => {
      const payload = {
        examSlug: 'test-exam',
        stageSlug: 'test-stage',
        name: 'Test Blueprint',
        totalQuestions: 50,
        sections: [
          { key: 'section-1', label: 'Section 1', count: 50 },
        ],
        difficultyMix: { easy: 0.5, medium: 0.35, hard: 0.15 },
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.sections[0].topics)).toBe(true);
    });

    it('validates section label is required', async () => {
      const payload = {
        examSlug: 'test',
        stageSlug: 'stage',
        name: 'Test',
        totalQuestions: 10,
        sections: [
          { key: 'no-label', count: 10 },
        ],
        difficultyMix: { easy: 0.5, medium: 0.35, hard: 0.15 },
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(400);
    });

    it('allows sections with null topic values', async () => {
      const payload = {
        examSlug: 'null-topic-exam',
        stageSlug: 'stage-1',
        name: 'Null Topics Test',
        totalQuestions: 30,
        sections: [
          { key: 'section-1', label: 'Section 1', count: 30, topics: null },
        ],
        difficultyMix: { easy: 0.5, medium: 0.35, hard: 0.15 },
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(
        Array.isArray(response.body.data.sections[0].topics) || 
        response.body.data.sections[0].topics === null
      ).toBe(true);
    });

    it('handles mixed sections with and without topics', async () => {
      const payload = {
        examSlug: 'mixed-exam',
        stageSlug: 'mixed-stage',
        name: 'Mixed Blueprint',
        totalQuestions: 100,
        sections: [
          { key: 'with-topics', label: 'With Topics', count: 50, topics: ['a', 'b', 'c'] },
          { key: 'without-topics', label: 'Without Topics', count: 50 },
        ],
        difficultyMix: { easy: 0.5, medium: 0.35, hard: 0.15 },
      };

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.sections[0].topics).toHaveLength(3);
      expect(response.body.data.sections[1].topics).toEqual([]);
    });

    it('rejects non-admin users', async () => {
      const userRes = await request(app).post('/api/v1/auth/register').send({
        name: 'Regular User',
        email: 'regular@example.com',
        password: 'Password1',
      });

      const response = await request(app)
        .put('/api/v1/paper-blueprints')
        .set('Authorization', `Bearer ${userRes.body.data.accessToken}`)
        .send({
          examSlug: 'test',
          stageSlug: 'test',
          name: 'Test',
          sections: [{ key: 't', label: 'T', count: 10 }],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/paper-blueprints', () => {
    beforeEach(async () => {
      await PaperBlueprint.create({
        owner: adminUser.id,
        examSlug: 'ssc-cgl',
        stageSlug: 'tier-1',
        name: 'SSC CGL Tier 1',
        totalQuestions: 100,
        sections: [
          { key: 'reasoning', label: 'Reasoning', count: 25, topics: ['analogy'] },
        ],
        isActive: true,
      });
    });

    it('retrieves blueprint by exam and stage', async () => {
      const response = await request(app)
        .get('/api/v1/paper-blueprints')
        .query({ examSlug: 'ssc-cgl', stageSlug: 'tier-1' });

      expect(response.status).toBe(200);
      expect(response.body.data.examSlug).toBe('ssc-cgl');
      expect(response.body.data.sections[0].topics).toEqual(['analogy']);
    });

    it('returns null for non-existent blueprint', async () => {
      const response = await request(app)
        .get('/api/v1/paper-blueprints')
        .query({ examSlug: 'non-existent', stageSlug: 'stage' });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });
  });
});
