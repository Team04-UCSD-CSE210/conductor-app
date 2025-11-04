import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';

const app = buildApp();

describe('Classes routes edge cases', () => {
  it('POST /api/v1/classes 400 when missing code/title', async () => {
    const r1 = await request(app).post('/api/v1/classes').send({ title: 'NoCode' });
    expect(r1.statusCode).toBe(400);

    const r2 = await request(app).post('/api/v1/classes').send({ code: 'CSEX' });
    expect(r2.statusCode).toBe(400);
  });

  it('PUT /api/v1/classes/:code 404 when class not found', async () => {
    const res = await request(app).put('/api/v1/classes/DOES-NOT-EXIST').send({ title: 'x' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/v1/classes/:code 404 when class not found', async () => {
    const res = await request(app).delete('/api/v1/classes/DOES-NOT-EXIST');
    expect(res.statusCode).toBe(404);
  });
});
