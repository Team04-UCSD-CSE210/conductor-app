// tests/api.classes.q-branches.spec.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../apps/api/server.js';

const app = buildApp();

describe('Classes search & tag branch coverage', () => {
  it('covers q OR branches: title-only hit, code-only hit, and none hit', async () => {
    const uniq = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const titleOnly = { code: `X_${uniq}`,        title: `Alpha-${uniq}` }; //  title.includes
    const codeOnly  = { code: `CODEMARK_${uniq}`, title: `Y_${uniq}` };     //  code.includes
    const noHit     = { code: `NOHIT_${uniq}`,    title: `Z_${uniq}` };


    await request(app).delete(`/api/v1/classes/${titleOnly.code}`);
    await request(app).delete(`/api/v1/classes/${codeOnly.code}`);
    await request(app).delete(`/api/v1/classes/${noHit.code}`);

   
    const r1 = await request(app).post('/api/v1/classes').send(titleOnly);
    expect(r1.statusCode).toBe(201);
    const savedTitleCode = r1.body.code;

    const r2 = await request(app).post('/api/v1/classes').send(codeOnly);
    expect(r2.statusCode).toBe(201);
    const savedCodeOnlyCode = r2.body.code;

    const r3 = await request(app).post('/api/v1/classes').send(noHit);
    expect(r3.statusCode).toBe(201);
    const savedNoHitCode = r3.body.code;

    
    const qTitle = await request(app).get('/api/v1/classes?q=alpha');
    expect(qTitle.statusCode).toBe(200);
    expect(qTitle.body.find((c) => c.code === savedTitleCode)).toBeTruthy();
    expect(qTitle.body.find((c) => c.code === savedCodeOnlyCode)).toBeFalsy();

   
    const qCode = await request(app).get('/api/v1/classes?q=codemark');
    expect(qCode.statusCode).toBe(200);
    expect(qCode.body.find((c) => c.code === savedCodeOnlyCode)).toBeTruthy();
    expect(qCode.body.find((c) => c.code === savedTitleCode)).toBeFalsy();

    
    const qNone = await request(app).get(`/api/v1/classes?q=_____no_match_${uniq}`);
    expect(qNone.statusCode).toBe(200);
    expect(qNone.body.find((c) => c.code === savedTitleCode)).toBeFalsy();
    expect(qNone.body.find((c) => c.code === savedCodeOnlyCode)).toBeFalsy();
    expect(qNone.body.find((c) => c.code === savedNoHitCode)).toBeFalsy();

    
    const withTags = { code: `TAGGED_${uniq}`, title: 'Tagged', tags: ['hot', '2025'] };
    const withoutTags = { code: `PLAIN_${uniq}`, title: 'Plain' };

    await request(app).delete(`/api/v1/classes/${withTags.code}`);
    await request(app).delete(`/api/v1/classes/${withoutTags.code}`);

    const t1 = await request(app).post('/api/v1/classes').send(withTags);
    expect(t1.statusCode).toBe(201);
    const savedTagged = t1.body.code;

    const t2 = await request(app).post('/api/v1/classes').send(withoutTags);
    expect(t2.statusCode).toBe(201);
    const savedPlain = t2.body.code;

    const tagHot = await request(app).get('/api/v1/classes?tag=hot');
    expect(tagHot.statusCode).toBe(200);
    expect(tagHot.body.find((c) => c.code === savedTagged)).toBeTruthy();
    expect(tagHot.body.find((c) => c.code === savedPlain)).toBeFalsy();
  });
});
