import { test, expect } from '@playwright/test'
import { getCanonical, getTitle } from '../helpers/meta'

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

test.describe('self-on-host canonical', () => {
  test('korean host self-canonicalizes', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(getCanonical(html)).toBe('https://xn--289a67xla.kr/people/nephi1')
  })
  test('untrusted host still falls back to apex', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: { ...bot, 'x-forwarded-host': 'evil.example.com' } })).text()
    expect(getCanonical(html)!).toContain('bookofmormon.online/people/nephi1')
  })
})

test.describe('localized index titles', () => {
  test('/people index is Korean', async ({ request }) => {
    const html = await (await request.get('/people', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경에 나오는 인물')
  })
  test('/contents index is Korean', async ({ request }) => {
    const html = await (await request.get('/contents', { headers: ko })).text()
    expect(getTitle(html)).toContain('목차')
  })
  test('/about index is Korean', async ({ request }) => {
    const html = await (await request.get('/about', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몰경·KR 소개')
  })
  test('/timeline index is Korean', async ({ request }) => {
    const html = await (await request.get('/timeline', { headers: ko })).text()
    expect(getTitle(html)).toContain('연대표')
  })
  test('/places index is Korean', async ({ request }) => {
    const html = await (await request.get('/places', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경에 나오는 장소')
  })
  test('/map index is Korean', async ({ request }) => {
    const html = await (await request.get('/map', { headers: ko })).text()
    expect(getTitle(html)).toContain('지도 및 지리적 가설')
  })
  test('/fax index is Korean', async ({ request }) => {
    const html = await (await request.get('/fax', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경 전의 판 사본')
  })
  test('/history index is Korean', async ({ request }) => {
    const html = await (await request.get('/history', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경에 대한 역사적 출처')
  })
})

test.describe('localized chrome', () => {
  test('korean home title uses Korean suffix', async ({ request }) => {
    const html = await (await request.get('/', { headers: ko })).text()
    expect(getTitle(html)).toBe('몰몬경·KR: 몰몬경 학습 자원')
  })
  test('korean person title has Korean suffix', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경·KR')
  })
  test('apex home title unchanged', async ({ request }) => {
    const html = await (await request.get('/', { headers: bot })).text()
    expect(getTitle(html)).toBe('Book of Mormon Online: A Book of Mormon Study Resource')
  })
})
