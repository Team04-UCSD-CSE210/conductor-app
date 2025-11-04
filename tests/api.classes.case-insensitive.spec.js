import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildApp } from '../apps/api/server.js'

const app = buildApp()

describe('Classes case-insensitive branches', () => {
  it('GET by :code and instructor filter are case-insensitive', async () => {
    const code = `CseMiX_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    await request(app).post('/api/v1/classes').send({
      code, title: 'Case Mix', instructor: 'Dr. Smith', tags: ['Intro']
    })

    
    const r1 = await request(app).get(`/api/v1/classes/${code.toUpperCase()}`)
    expect(r1.statusCode).toBe(200)
    expect(r1.body.code).toBe(code)

    
    const r2 = await request(app).get('/api/v1/classes?instructor=SMITH')
    expect(r2.statusCode).toBe(200)
    expect(Array.isArray(r2.body)).toBe(true)
  })
})
