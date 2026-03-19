const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');
const Exam = require('../../models/exam');

describe('Exams API', () => {
  let mongoServer;
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Exam.deleteMany({});

    const adminRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Admin User',
      email: 'admin.exams@example.com',
      password: 'Password1',
    });
    adminUser = adminRes.body.data.user;
    await User.findByIdAndUpdate(adminUser.id, { role: 'admin' });
    
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin.exams@example.com',
      password: 'Password1',
    });
    adminToken = adminLogin.body.data.accessToken;

    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Regular User',
      email: 'regular.exams@example.com',
      password: 'Password1',
    });
    regularUser = userRes.body.data.user;
    regularToken = userRes.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('GET /api/v1/exams', () => {
    beforeEach(async () => {
      await Exam.deleteMany({});
      await Exam.create([
        { slug: 'ssc-cgl', name: 'SSC CGL', stages: [{ slug: 'tier-1', name: 'Tier 1' }] },
        { slug: 'upsc-cse', name: 'UPSC CSE', stages: [{ slug: 'prelims', name: 'Prelims' }] },
        { slug: 'inactive-exam', name: 'Inactive Exam', isActive: false },
      ]);
    });

    it('returns all exams when no filter is passed', async () => {
      const response = await request(app)
        .get('/api/v1/exams');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some(e => e.slug === 'inactive-exam')).toBe(true);
      expect(response.body.data.some(e => e.slug === 'ssc-cgl')).toBe(true);
    });

    it('returns only active exams when active=true', async () => {
      const response = await request(app)
        .get('/api/v1/exams')
        .query({ active: 'true' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some(e => e.slug === 'inactive-exam')).toBe(false);
      expect(response.body.data.some(e => e.slug === 'ssc-cgl')).toBe(true);
    });

    it('returns only inactive exams when active=false', async () => {
      const response = await request(app)
        .get('/api/v1/exams')
        .query({ active: 'false' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some(e => e.slug === 'inactive-exam')).toBe(true);
      expect(response.body.data.some(e => e.slug === 'ssc-cgl')).toBe(false);
    });

    it('filters exams by search query', async () => {
      const response = await request(app)
        .get('/api/v1/exams')
        .query({ search: 'SSC' });

      expect(response.status).toBe(200);
      expect(response.body.data.some(e => e.slug === 'ssc-cgl')).toBe(true);
    });
  });

  describe('GET /api/v1/exams/:slug', () => {
    beforeEach(async () => {
      await Exam.create({
        slug: 'ssc-cgl',
        name: 'SSC CGL',
        description: 'Staff Selection Commission Combined Graduate Level',
        stages: [
          { slug: 'tier-1', name: 'Tier 1', durationMinutes: 60, questionCount: 100, totalMarks: 200 },
          { slug: 'tier-2', name: 'Tier 2', durationMinutes: 120, questionCount: 200, totalMarks: 400 },
        ],
        negativeMarking: { enabled: true, perWrongAnswer: 0.25 },
      });
    });

    it('returns exam by slug', async () => {
      const response = await request(app).get('/api/v1/exams/ssc-cgl');

      expect(response.status).toBe(200);
      expect(response.body.data.slug).toBe('ssc-cgl');
      expect(response.body.data.name).toBe('SSC CGL');
      expect(response.body.data.stages).toHaveLength(2);
      expect(response.body.data.negativeMarking.enabled).toBe(true);
    });

    it('returns 404 for non-existent exam', async () => {
      const response = await request(app).get('/api/v1/exams/non-existent');

      expect(response.status).toBe(404);
    });

    it('returns stage details correctly', async () => {
      const response = await request(app).get('/api/v1/exams/ssc-cgl');

      expect(response.status).toBe(200);
      const tier1 = response.body.data.stages.find(s => s.slug === 'tier-1');
      expect(tier1.durationMinutes).toBe(60);
      expect(tier1.questionCount).toBe(100);
      expect(tier1.totalMarks).toBe(200);
    });
  });

  describe('POST /api/v1/exams', () => {
    const validExamPayload = {
      slug: 'new-exam',
      name: 'New Exam',
      description: 'A brand new exam',
      stages: [
        { slug: 'prelims', name: 'Preliminary', durationMinutes: 60, questionCount: 100, totalMarks: 200 },
      ],
      negativeMarking: { enabled: true, perWrongAnswer: 0.33 },
    };

    it('allows admin to create exam', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validExamPayload);

      expect(response.status).toBe(201);
      expect(response.body.data.slug).toBe('new-exam');
      expect(response.body.data.negativeMarking.perWrongAnswer).toBe(0.33);
    });

    it('rejects non-admin exam creation', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(validExamPayload);

      expect(response.status).toBe(403);
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Missing Slug' });

      expect(response.status).toBe(400);
    });

    it('validates slug uniqueness', async () => {
      await Exam.create({ slug: 'duplicate-slug', name: 'First' });

      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'duplicate-slug', name: 'Second' });

      expect([400, 409]).toContain(response.status);
    });

    it('creates exam with multiple stages', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'multi-stage-exam',
          name: 'Multi Stage Exam',
          stages: [
            { slug: 'stage-1', name: 'Stage 1' },
            { slug: 'stage-2', name: 'Stage 2' },
            { slug: 'stage-3', name: 'Stage 3' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.stages).toHaveLength(3);
    });

    it('defaults negative marking when not provided', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'default-neg', name: 'Default Negative' });

      expect(response.status).toBe(201);
      expect(response.body.data.negativeMarking.enabled).toBe(true);
      expect(response.body.data.negativeMarking.perWrongAnswer).toBe(0.25);
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .send(validExamPayload);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/exams/:slug', () => {
    beforeEach(async () => {
      await Exam.create({
        slug: 'existing-exam',
        name: 'Existing Exam',
        description: 'Original description',
        stages: [{ slug: 'stage-1', name: 'Stage 1' }],
      });
    });

    it('allows admin to update exam', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Exam Name', description: 'New description' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Exam Name');
      expect(response.body.data.description).toBe('New description');
    });

    it('allows adding new stages', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stages: [
            { slug: 'stage-1', name: 'Stage 1' },
            { slug: 'stage-2', name: 'Stage 2', totalMarks: 100 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stages).toHaveLength(2);
    });

    it('allows updating stage total marks', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stages: [{ slug: 'stage-1', name: 'Stage 1', totalMarks: 150 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stages[0].totalMarks).toBe(150);
    });

    it('rejects non-admin update', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent exam', async () => {
      const response = await request(app)
        .put('/api/v1/exams/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });

    it('validates negative marking values', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          negativeMarking: { enabled: true, perWrongAnswer: 1.5 },
        });

      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .put('/api/v1/exams/existing-exam')
        .send({ name: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/exams/:slug', () => {
    beforeEach(async () => {
      await Exam.create({ slug: 'to-delete', name: 'To Delete' });
    });

    it('allows admin to delete exam', async () => {
      const response = await request(app)
        .delete('/api/v1/exams/to-delete')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const deleted = await Exam.findOne({ slug: 'to-delete' });
      expect(deleted).toBeNull();
    });

    it('rejects non-admin deletion', async () => {
      const response = await request(app)
        .delete('/api/v1/exams/to-delete')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent exam', async () => {
      const response = await request(app)
        .delete('/api/v1/exams/non-existent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('requires authentication', async () => {
      const response = await request(app).delete('/api/v1/exams/to-delete');

      expect(response.status).toBe(401);
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles exam with empty stages array', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'no-stages', name: 'No Stages Exam', stages: [] });

      expect(response.status).toBe(201);
      expect(response.body.data.stages).toHaveLength(0);
    });

    it('handles special characters in exam name', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'special-chars',
          name: 'Exam with Special Chars: & " \'',
          description: 'Test & <script>',
        });

      expect(response.status).toBe(201);
    });

    it('handles stage without optional fields', async () => {
      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'minimal-stages',
          name: 'Minimal Stages',
          stages: [{ slug: 'only-slug', name: 'Only Name' }],
        });

      expect(response.status).toBe(201);
      const stage = response.body.data.stages[0];
      expect(stage.durationMinutes).toBe(60);
      expect(stage.questionCount).toBe(100);
      expect(stage.totalMarks).toBe(100);
    });

    it('handles exam deactivation', async () => {
      await Exam.create({ slug: 'deactivate-me', name: 'Deactivate Me', isActive: true });

      const response = await request(app)
        .put('/api/v1/exams/deactivate-me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });

    it('handles duplicate slug case insensitivity', async () => {
      await Exam.create({ slug: 'case-test', name: 'Case Test' });

      const response = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slug: 'CASE-TEST', name: 'Case Test 2' });

      expect([400, 409]).toContain(response.status);
    });
  });
});
