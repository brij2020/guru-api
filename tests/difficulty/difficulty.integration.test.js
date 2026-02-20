const request = require('supertest');

const app = require('../../app');

describe('Difficulty API', () => {
  it('returns default difficulty levels', async () => {
    const response = await request(app).get('/api/v1/difficulties');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.map((item) => item.key)).toEqual([
      'all',
      'easy',
      'medium',
      'hard',
    ]);
  });
});
