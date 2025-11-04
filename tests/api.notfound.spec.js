// tests/api.notfound.spec.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';
const app = buildApp();

describe('Not Found handler', () => {
  it('GET /__definitely_not_exist returns 404', async () => {
    const res = await request(app).get('/__definitely_not_exist');
    expect(res.statusCode).toBe(404);
  });
});
