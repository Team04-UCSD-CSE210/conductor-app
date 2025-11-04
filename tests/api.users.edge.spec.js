import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';

const app = buildApp();

describe('Users routes edge cases', () => {
  it('POST /api/v1/users 400 when missing name', async () => {
    const res = await request(app).post('/api/v1/users').send({});
    expect(res.statusCode).toBe(400);
  });
});
