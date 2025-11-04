import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';

const app = buildApp();

describe('Error middleware', () => {
  it('GET /api/v1/_boom returns 500 with error json', async () => {
    const res = await request(app).get('/api/v1/_boom');
    expect(res.statusCode).toBe(500);
    expect(res.body?.error).toBe(true);
    expect(typeof res.body?.message).toBe('string');
  });
});
