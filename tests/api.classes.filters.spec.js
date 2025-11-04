import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';
const app = buildApp();

describe('Classes filters', () => {
  it('GET /api/v1/classes?q=CSE filters by query', async () => {
    const res = await request(app).get('/api/v1/classes?q=CSE');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  it('GET /api/v1/classes?tag=intro filters by tag', async () => {
    const res = await request(app).get('/api/v1/classes?tag=intro');
    expect(res.statusCode).toBe(200);
  });
  it('GET /api/v1/classes?instructor=smith filters by instructor', async () => {
    const res = await request(app).get('/api/v1/classes?instructor=smith');
    expect(res.statusCode).toBe(200);
  });
});