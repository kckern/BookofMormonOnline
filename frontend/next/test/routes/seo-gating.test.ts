import { test, expect } from '@playwright/test'

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const bot = { 'User-Agent': BOT }

test.describe('remove-intent features 404 for bots', () => {
  test('/matters → 404', async ({ request }) => {
    const r = await request.get('/matters', { headers: bot })
    expect(r.status()).toBe(404)
  })
  test('/home → 404', async ({ request }) => {
    const r = await request.get('/home', { headers: bot })
    expect(r.status()).toBe(404)
  })
  test('deliberate fallbacks stay 200 (regression guard)', async ({ request }) => {
    for (const p of ['/search', '/user']) {
      const r = await request.get(p, { headers: bot })
      expect(r.status(), p).toBe(200)
    }
  })
})

test.describe('sitemap excludes non-crawl features', () => {
  test('/sitemap.xml has no /history URLs but keeps content', async ({ request }) => {
    const r = await request.get('/sitemap.xml', { headers: bot })
    const xml = await r.text()
    expect(xml).not.toContain('<loc>https://bookofmormon.online/history')
    expect(xml).toContain('<loc>https://bookofmormon.online/people</loc>')
  })
})
