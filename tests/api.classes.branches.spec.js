import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildApp } from '../apps/api/server.js'

const app = buildApp()

describe('Classes branch coverage', () => {
  it('POST /api/v1/classes 400 when missing code/title AND 409 when duplicate', async () => {
    
    const r1 = await request(app).post('/api/v1/classes').send({ title: 'NoCode' })
    expect(r1.statusCode).toBe(400)
    const r2 = await request(app).post('/api/v1/classes').send({ code: 'ONLYCODE' })
    expect(r2.statusCode).toBe(400)

    
    const unique = `CSE_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    await request(app).delete(`/api/v1/classes/${unique}`)

   
    const r3 = await request(app).post('/api/v1/classes').send({ code: unique, title: 'Unique' })
    expect(r3.statusCode).toBe(201)
    const saved = r3.body.code 

    
    const dup = await request(app).post('/api/v1/classes').send({ code: saved, title: 'Dup' })
    expect(dup.statusCode).toBe(409)
    expect(dup.body?.error).toBe(true)
  })

  

  it('GET /api/v1/classes filters hit q/tag/instructor branches', async () => {
   
    await request(app).post('/api/v1/classes').send({
      code: 'CSEFILT',
      title: 'Filtering',
      instructor: 'Dr. Smith',
      tags: ['intro', '2025']
    })

    const q = await request(app).get('/api/v1/classes?q=CSE')
    expect(q.statusCode).toBe(200)

    const byTag = await request(app).get('/api/v1/classes?tag=intro')
    expect(byTag.statusCode).toBe(200)

    const byIns = await request(app).get('/api/v1/classes?instructor=smith')
    expect(byIns.statusCode).toBe(200)
  })

  it('PUT /api/v1/classes/:code with non-array tags hits guard branch', async () => {
  
    await request(app).post('/api/v1/classes').send({
      code: 'CSETAGS',
      title: 'Tags Keep Array',
      tags: ['keep-me']
    })

   
    const up = await request(app)
      .put('/api/v1/classes/CSETAGS')
      .send({ tags: 'not-an-array', title: 'Updated' })
    expect(up.statusCode).toBe(200)
    expect(Array.isArray(up.body?.tags)).toBe(true)       
    expect(up.body?.title).toBe('Updated')
  })
})
