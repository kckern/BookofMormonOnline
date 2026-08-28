import { test, expect } from '@playwright/test'

const bot = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
const ko = { ...bot, 'x-forwarded-host': 'xn--289a67xla.kr', 'x-forwarded-proto': 'https' }

test.describe('host→lang middleware', () => {
  test('korean host resolves to ko', async ({ request }) => {
    const r = await request.get('/', { headers: ko })
    expect(r.headers()['x-resolved-lang']).toBe('ko')
  })
  test('apex host resolves to en', async ({ request }) => {
    const r = await request.get('/', { headers: bot })
    expect(r.headers()['x-resolved-lang']).toBe('en')
  })
})
