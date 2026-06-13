import { test, expect } from '@playwright/test'

test.describe('Robots /robots.txt', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200)
  })

  test('contains Sitemap directive', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('Sitemap:')
  })

  test('allows all user agents by default', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('User-agent: *')
  })
})
