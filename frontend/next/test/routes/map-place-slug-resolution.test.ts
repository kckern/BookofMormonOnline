import { test, expect } from '@playwright/test'

const noFollow = { maxRedirects: 0 as const }

test.describe('Map-context place slug resolution', () => {
  test('exact slug is unchanged', async ({ request }) => {
    const r = await request.get('/map/1/place/jerusalem-1', noFollow)
    expect(r.status()).toBe(200)
  })

  test('multi-variant bare name keeps 404ing (no chooser in a map context)', async ({ request }) => {
    const r = await request.get('/map/1/place/jerusalem', noFollow)
    expect(r.status()).toBe(404)
  })

  test('unknown slug still 404s', async ({ request }) => {
    expect((await request.get('/map/1/place/atlantis', noFollow)).status()).toBe(404)
  })
})
