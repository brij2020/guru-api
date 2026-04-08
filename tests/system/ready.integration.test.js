const request = require('supertest');
const app = require('../../app');

describe('GET /api/ready', () => {
  test('returns readiness payload with non-sensitive checks', async () => {
    const response = await request(app).get('/api/ready');

    expect([200, 503]).toContain(response.status);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        service: 'guru-api',
        environment: expect.any(String),
        checks: expect.objectContaining({
          database: expect.any(String),
          config: expect.any(String),
        }),
        missingConfig: expect.any(Array),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain('mongodb://');
    expect(JSON.stringify(response.body)).not.toContain('mongodb+srv://');
  });
});
