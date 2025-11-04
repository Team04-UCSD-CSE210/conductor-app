// tests/api.classes.tags-array.spec.js
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { buildApp } from '../apps/api/server.js'

const app = buildApp()

describe('Classes tags array branches', () => {
  it('POST keeps array tags; PUT replaces tags with array', async () => {
    const code = `CSE_TAGS_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
    
    await request(app).delete(`/api/v1/classes/${code}`)

    
    const r1 = await request(app).post('/api/v1/classes').send({
      code, title: 'With Tags', tags: ['intro', '2025']
    })
    expect(r1.statusCode).toBe(201)
 
    const savedCode = r1.body.code
    expect(Array.isArray(r1.body.tags)).toBe(true)
    expect(r1.body.tags).toEqual(['intro', '2025'])

   
    const r2 = await request(app).put(`/api/v1/classes/${savedCode}`).send({
      title: 'With New Tags',
      tags: ['advanced', 'lab']
    })
    expect(r2.statusCode).toBe(200)
    expect(r2.body.title).toBe('With New Tags')
    expect(r2.body.tags).toEqual(['advanced', 'lab'])
  })
})
