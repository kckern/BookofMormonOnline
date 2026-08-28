import { test, expect } from '@playwright/test'
import { getTitle, getCanonical, getMeta, getHreflang } from '../helpers/meta'

const APEX = 'https://bookofmormon.online'

function ldBlocks(html: string): any[] {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const out: any[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]))
  return out
}

test.describe('/read chapter route', () => {
  test('chapter URL renders the chapter with apex canonical', async ({ request }) => {
    const html = await (await request.get('/read/alma.32')).text()
    expect(getTitle(html)).toContain('Alma 32')
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/)
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    expect(html.toLowerCase()).toContain('seed')
    expect(html).toContain('/read/alma.31')
    expect(html).toContain('/read/alma.33')
  })

  test('verse URL renders the whole chapter, canonical → chapter', async ({ request }) => {
    const html = await (await request.get('/read/alma.32/21')).text()
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/)
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
  })

  test('verse-range URL → chapter, canonical → chapter', async ({ request }) => {
    const html = await (await request.get('/read/alma.32.21~24')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
  })

  test('chapter-range URL does NOT self-canonical (B1 guard)', async ({ request }) => {
    const html = await (await request.get('/read/alma.32~33')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    expect(getCanonical(html)).not.toContain('~')
  })

  test('hyphen-slug form resolves', async ({ request }) => {
    const html = await (await request.get('/read/alma-17/7')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.17`)
  })

  test('single-chapter book + over-number consolidate', async ({ request }) => {
    expect(getCanonical(await (await request.get('/read/enos.1')).text())).toBe(`${APEX}/read/enos.1`)
    expect(getCanonical(await (await request.get('/read/enos.2')).text())).toBe(`${APEX}/read/enos.1`)
  })

  test('book boundaries: first has no prev, last no next, cross-book next', async ({ request }) => {
    const first = await (await request.get('/read/1.nephi.1')).text()
    expect(first).not.toContain('/read/1.nephi.0')
    const last = await (await request.get('/read/moroni.10')).text()
    expect(last).not.toContain('/read/moroni.11')
    const cross = await (await request.get('/read/1.nephi.22')).text()
    expect(cross).toContain('/read/2.nephi.1')
  })

  test('junk ref → 404', async ({ request }) => {
    expect((await request.get('/read/zznotabook')).status()).toBe(404)
  })

  test('no hreflang on /read; language host still canonicals to apex with English text', async ({ request }) => {
    const html = await (await request.get('/read/alma.32', {
      headers: { 'x-forwarded-host': 'xn--289a67xla.kr' },
    })).text()
    expect(getHreflang(html, 'ko')).toBeNull()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/)
    expect(html).toContain('/read/alma.31')
  })

  test('JSON-LD: Article + BreadcrumbList', async ({ request }) => {
    const blocks = ldBlocks(await (await request.get('/read/alma.32')).text())
    const article = blocks.find((b) => b['@type'] === 'Article')
    expect(article).toBeTruthy()
    expect(article.headline).toContain('Alma 32')
    expect(article.url).toBe(`${APEX}/read/alma.32`)
    expect(article.inLanguage).toBe('en')
    expect(blocks.find((b) => b['@type'] === 'BreadcrumbList')).toBeTruthy()
  })
})

test.describe('/read chapters in sitemap.xml', () => {
  test('sitemap lists all 239 chapter URLs, first and last present', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    const readUrls = [...xml.matchAll(/<loc>([^<]*\/read\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(readUrls.length).toBe(239)
    expect(readUrls).toContain('https://bookofmormon.online/read/1.nephi.1')
    expect(readUrls).toContain('https://bookofmormon.online/read/moroni.10')
  })
})
