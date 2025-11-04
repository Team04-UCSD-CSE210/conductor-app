// tests/api.classes.readfail.spec.js
import { describe, it, expect, vi, afterAll } from 'vitest'
import request from 'supertest'


vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()     
  return {
    ...actual,
    
    readFileSync: () => { throw new Error('simulated read error') },
  }
})


const { buildApp } = await import('../apps/api/server.js')
const app = buildApp()

afterAll(() => {
  
  vi.resetModules()
  vi.clearAllMocks()
  vi.unmock('fs')
})

describe('Classes read failure branch', () => {
  it('returns [] when reading classes.json fails (catch branch)', async () => {
    const res = await request(app).get('/api/v1/classes')
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})