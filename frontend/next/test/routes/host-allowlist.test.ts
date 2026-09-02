import { test, expect } from '@playwright/test'

const bot = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
// maxRedirects: 0 is REQUIRED — Playwright follows redirects by default, which
// would chase the 301 Location out to the live production site.
const noFollow = { maxRedirects: 0 as const }

test.describe('unauthorized host → canonical English 301', () => {
  test('preserves path + query', async ({ request }) => {
    const r = await request.get('/reign-of-judges/94?x=1', {
      headers: { ...bot, 'x-forwarded-host': 'sugardoodle.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/reign-of-judges/94?x=1')
  })

  test('opengraph alias redirects even for a crawler UA (before SSR)', async ({ request }) => {
    const r = await request.get('/history/1841-03-15-x', {
      headers: { ...bot, 'x-forwarded-host': 'opengraph.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/history/1841-03-15-x')
  })

  test('new alias redirects to canonical', async ({ request }) => {
    const r = await request.get('/read/1.nephi.1', {
      headers: { ...bot, 'x-forwarded-host': 'new.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/read/1.nephi.1')
  })

  test('unrelated external domain redirects to canonical', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'evil.example.com' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/people')
  })
})

test.describe('authorized + infra hosts are NOT redirected', () => {
  test('language host serves (200)', async ({ request }) => {
    const r = await request.get('/contents', {
      headers: { ...bot, 'x-forwarded-host': 'swe.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(200)
  })
  test('apex serves (200)', async ({ request }) => {
    const r = await request.get('/people', { headers: bot, ...noFollow })
    expect(r.status()).toBe(200)
  })
  test('localhost (no forwarded host) serves — harness default (200)', async ({ request }) => {
    const r = await request.get('/', { headers: bot, ...noFollow })
    expect(r.status()).toBe(200)
  })
})
