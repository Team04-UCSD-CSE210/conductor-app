import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildApp } from '../apps/api/server.js'

const app = buildApp()

describe('Users branch coverage', () => {
  it('POST /api/v1/users returns 400 when name is missing or whitespace', async () => {
    const r1 = await request(app).post('/api/v1/users').send({})
    expect(r1.statusCode).toBe(400)

    const r2 = await request(app).post('/api/v1/users').send({ name: '   ' })
    expect(r2.statusCode).toBe(400)
  })

  it('POST /api/v1/users accepts explicit id branch', async () => {
    const r = await request(app).post('/api/v1/users').send({ id: '42', name: 'Alice' })
    expect(r.statusCode).toBe(201)
    expect(String(r.body?.id)).toBe('42') 
  })

  it('GET/PUT/DELETE unknown id hit 404 branches', async () => {
    const g = await request(app).get('/api/v1/users/__nope__')
    expect(g.statusCode).toBe(404)

    const p = await request(app).put('/api/v1/users/__nope__').send({ name: 'X' })
    expect(p.statusCode).toBe(404)

    const d = await request(app).delete('/api/v1/users/__nope__')
    expect(d.statusCode).toBe(404)
  })
})
