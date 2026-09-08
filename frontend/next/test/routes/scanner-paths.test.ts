import { test, expect } from '@playwright/test'

const bot = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
const noFollow = { maxRedirects: 0 as const }

test.describe('scanner/secret probes → cheap 404 (no redirect, no SSR)', () => {
  for (const path of ['/.env', '/.env.backup', '/.git/config', '/actuator/configprops', '/storage/logs/laravel.log']) {
    test(`${path} → 404`, async ({ request }) => {
      const r = await request.get(path, { headers: bot, ...noFollow })
      expect(r.status()).toBe(404)
    })
  }

  test('probe on a spoofed host still 404s (not 301 to canonical)', async ({ request }) => {
    const r = await request.get('/.env', {
      headers: { ...bot, 'x-forwarded-host': 'api-prod.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(404)
  })
})

test.describe('legitimate .well-known and dotted assets stay reachable', () => {
  test('/.well-known/assetlinks.json → 200', async ({ request }) => {
    const r = await request.get('/.well-known/assetlinks.json', { headers: bot, ...noFollow })
    expect(r.status()).toBe(200)
  })
})
