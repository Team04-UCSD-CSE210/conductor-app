// tests/api.classes.conflict.spec.js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildApp } from '../apps/api/server.js'

const app = buildApp()

describe('Classes conflict branch', () => {
  it('POST /api/v1/classes returns 409 when code already exists', async () => {
    
    const unique = `CSE_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const payload = { code: unique, title: 'Once' }

    const r1 = await request(app).post('/api/v1/classes').send(payload)
    expect(r1.statusCode).toBe(201)

    const r2 = await request(app).post('/api/v1/classes').send(payload)
    expect(r2.statusCode).toBe(409)
    expect(r2.body?.error).toBe(true)
  })
})
