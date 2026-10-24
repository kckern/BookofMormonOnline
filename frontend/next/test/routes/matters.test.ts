import { test, expect } from '@playwright/test'

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const bot = { 'User-Agent': BOT }

test.describe('/matters (server-rendered, crawlable)', () => {
  test('index lists the three groups and links to matters', async ({ request }) => {
    const r = await request.get('/matters', { headers: bot })
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).toContain('<h1>Matters of the Book of Mormon</h1>')
    for (const g of ['narrative', 'material', 'concepts']) expect(html).toContain(`href="/matters/${g}"`)
    expect(html).toContain('href="/matters/circumcision"')
    expect(html).not.toMatch(/<meta name="robots" content="noindex/)
    expect(html).toMatch(/rel="canonical" href="[^"]*\/matters"/)
  })

  test('group page lists only that group', async ({ request }) => {
    const r = await request.get('/matters/concepts', { headers: bot })
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).toContain('<h1>Concepts matters</h1>')
    expect(html).toContain('href="/matters/circumcision"')
    expect(html).not.toMatch(/<meta name="robots" content="noindex/)
  })

  test('a matter page has its text, verse links, related links, JSON-LD and canonical', async ({ request }) => {
    const r = await request.get('/matters/circumcision', { headers: bot })
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).toContain('<h1>Circumcision</h1>')
    expect(html).toContain('Moroni 8:8')
    expect(html).toContain('href="/downfall/53"')
    expect(html).toContain('href="/people/jesus-christ"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toMatch(/rel="canonical" href="[^"]*\/matters\/circumcision"/)
    expect(html).not.toMatch(/<meta name="robots" content="noindex/)
  })

  test('an unknown matter is a real 404', async ({ request }) => {
    const r = await request.get('/matters/no-such-matter-xyz', { headers: bot })
    expect(r.status()).toBe(404)
  })

  test('sitemap lists matters', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml', { headers: bot })).text()
    expect(xml).toContain('<loc>https://bookofmormon.online/matters</loc>')
    expect(xml).toContain('<loc>https://bookofmormon.online/matters/concepts</loc>')
    expect(xml).toContain('<loc>https://bookofmormon.online/matters/circumcision</loc>')
  })
})
