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

// Regression guard for the WebKit/mobile misrouting bug: real browsers that
// send NEITHER Sec-Fetch nor Sec-CH-UA (Safari desktop + every iOS browser,
// and Firefox with those headers stripped) were served SSR instead of the CRA.
// The gate is now User-Agent based, so a browser UA on a GET nav gets the CRA
// with no fetch-metadata/client-hint headers at all.
test.describe('real browsers reach the CRA without Sec-Fetch / Sec-CH-UA', () => {
  const browsers: Record<string, string> = {
    'Safari (desktop)':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'iOS Safari':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Firefox iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
    'Firefox (no Sec-Fetch)':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Chrome (headers stripped)':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
  for (const [name, uaString] of Object.entries(browsers)) {
    test(`${name} → CRA`, async ({ request }) => {
      // No sec-fetch-* or sec-ch-ua headers on purpose — WebKit never sends them.
      const r = await request.get('/', { headers: { 'user-agent': uaString } })
      expect(r.headers()['x-bom-render-mode'], name).toBe('cra')
      expect(r.headers()['x-bom-client-class'], name).toBe('browser')
    })
  }
})

test.describe('SSR access defaults open', () => {
  test('an unrecognized indexer gets SSR without being named in a bot allowlist', async ({ request }) => {
    const r = await request.get('/lehites', {
      headers: { 'user-agent': 'ResearchIndexer/1.0', accept: 'text/html' },
    })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-resolved-lang']).toBe('en')
    expect(r.headers()['x-bom-render-mode']).toBe('ssr')
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
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
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
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

test.describe('in-app WebViews reach the CRA', () => {
  const webviews: Record<string, string> = {
    'facebook-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]',
    'kakaotalk-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020',
  }
  for (const [name, ua] of Object.entries(webviews)) {
    test(`${name} → CRA`, async ({ request }) => {
      const r = await request.get('/', { headers: { 'user-agent': ua } })
      expect(r.headers()['x-bom-render-mode'], name).toBe('cra')
      expect(r.headers()['x-bom-client-class'], name).toBe('browser')
    })
  }
})

test.describe('headless clients stay on SSR', () => {
  test('HeadlessChrome → SSR', async ({ request }) => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36'
    const r = await request.get('/lehites', { headers: { 'user-agent': ua } })
    expect(r.headers()['x-bom-render-mode']).toBe('ssr')
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
  })
})

test.describe('HTML responses vary by User-Agent (cache safety)', () => {
  test('SSR page sets Vary: User-Agent', async ({ request }) => {
    const r = await request.get('/lehites', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })
    expect((r.headers()['vary'] || '').toLowerCase()).toContain('user-agent')
  })
  test('CRA page sets Vary: User-Agent', async ({ request }) => {
    const r = await request.get('/', { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15' } })
    expect((r.headers()['vary'] || '').toLowerCase()).toContain('user-agent')
  })
  test('SSR page sets Cache-Control no-store (app-router default)', async ({ request }) => {
    const r = await request.get('/lehites', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })
    const cc = (r.headers()['cache-control'] || '').toLowerCase()
    // Next.js app-router overrides the middleware's `private, no-cache` with its
    // own `no-store` — but both forbid shared-cache storage, which is what matters.
    expect(cc).toMatch(/no-store|no-cache/)
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
