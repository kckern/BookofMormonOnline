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

test.describe('default shell does not link noindexed sections', () => {
  test('/ shell has no History nav link', async ({ request }) => {
    const r = await request.get('/', { headers: bot })
    const html = await r.text()
    expect(html).not.toContain('href="/history"')
    expect(html).toContain('href="/people"') // sanity: other nav links present
  })
})

test.describe('SSR access defaults open', () => {
  test('an unrecognized indexer gets SSR without being named in a bot allowlist', async ({ request }) => {
    const r = await request.get('/lehites', {
      headers: { 'user-agent': 'ResearchIndexer/1.0', accept: 'text/html' },
    })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-resolved-lang']).toBe('en')
    expect(r.headers()['x-bom-render-mode']).toBe('ssr')
    expect(r.headers()['x-bom-client-class']).toBe('unknown')
    expect(await r.text()).toContain('<h1')
  })

  test('a named crawler is identified without changing its SSR treatment', async ({ request }) => {
    const r = await request.get('/lehites', { headers: bot })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-bom-render-mode']).toBe('ssr')
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
  })

  test('SEO assets identify the asset rendering path', async ({ request }) => {
    const r = await request.get('/robots.txt', {
      headers: { 'user-agent': 'ResearchIndexer/1.0' },
    })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-bom-render-mode']).toBe('asset')
    expect(r.headers()['x-bom-client-class']).toBe('unknown')
  })
})

test.describe('history is noindex for bots', () => {
  test('/history → 200 + noindex meta + header', async ({ request }) => {
    const r = await request.get('/history', { headers: bot })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
    expect(await r.text()).toContain('noindex')
  })
  test('/ko/history → noindex header (locale stripped)', async ({ request }) => {
    const r = await request.get('/ko/history', { headers: bot })
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
  })
  test('crawl pages have no noindex header', async ({ request }) => {
    const r = await request.get('/people', { headers: bot })
    expect(r.headers()['x-robots-tag']).toBeUndefined()
  })
})

test.describe('canonical is host-aware', () => {
  test('canonical uses x-forwarded-host + proto (authorized host)', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'xn--289a67xla.kr', 'x-forwarded-proto': 'https' },
    })
    const html = await r.text()
    expect(html).toContain('rel="canonical" href="https://xn--289a67xla.kr/people"')
  })
  test('unauthorized x-forwarded-host is redirected to canonical (not served)', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'evil.example.com', 'x-forwarded-proto': 'https' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/people')
  })
})
