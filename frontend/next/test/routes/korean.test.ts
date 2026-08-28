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

test.describe('lang-aware content', () => {
  test('korean host serves Korean person name', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(html).toContain('니파이') // Nephi in Korean (assert the STRING — unknown codes clamp to en)
  })
  test('apex host still English', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: bot })).text()
    expect(html.toLowerCase()).toContain('nephi')
  })
})

test.describe('sitemap stays English + valid', () => {
  test('/sitemap.xml has content URLs regardless of host', async ({ request }) => {
    const r = await request.get('/sitemap.xml', { headers: ko })
    expect(r.status()).toBe(200)
    expect(await r.text()).toContain('<loc>https://bookofmormon.online/people</loc>')
  })
})

test.describe('fax catalog is the fixed cross-language set on every host', () => {
  test('korean /fax lists the full catalog (not just the 5 ko), no double-count', async ({ request }) => {
    const html = await (await request.get('/fax', { headers: ko })).text()
    const links = [...html.matchAll(/href="\/fax\/([^"]+)"/g)].map((m) => m[1])
    expect(new Set(links).size).toBeGreaterThan(40) // the ~57 catalog, not just 5
    expect(links.filter((s) => s === '1962k').length).toBe(1) // ko-only edition appears once
  })
})
