import { test, expect } from '@playwright/test'

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const bot = { 'User-Agent': BOT }

test.describe('/fax/:edition/:page share URLs', () => {
  test('a verse link has its own title, description and is noindex', async ({ request }) => {
    const r = await request.get('/fax/1830/alma.32.21', { headers: bot })
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).toContain('Alma 32:21')
    expect(html).toMatch(/<title>[^<]*Alma 32:21[^<]*<\/title>/)
    expect(html).toMatch(/<meta name="robots" content="noindex/)
  })
  test('a page link has its own title', async ({ request }) => {
    const r = await request.get('/fax/1830/100', { headers: bot })
    expect(r.status()).toBe(200)
    expect(await r.text()).toMatch(/<title>[^<]*page 100[^<]*<\/title>/)
  })
  test('unknown edition is a 404', async ({ request }) => {
    expect((await request.get('/fax/no-such-edition/5', { headers: bot })).status()).toBe(404)
  })
})
