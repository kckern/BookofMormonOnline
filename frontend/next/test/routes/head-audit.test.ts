import { test, expect } from '@playwright/test'
import { getTitle, getCanonical, getMeta, getRobots, getHreflang } from '../helpers/meta'

// One representative URL per crawl route class (all route through buildMetadata).
const CRAWL = ['/people/nephi1', '/place/jerusalem-1', '/art/1000', '/contents', '/about']

for (const path of CRAWL) {
  test(`head is complete + hreflang present: ${path}`, async ({ request }) => {
    const html = await (await request.get(path, { headers: { 'x-forwarded-host': 'bookofmormon.online', 'x-forwarded-proto': 'http' } })).text()
    expect(getTitle(html)).toBeTruthy()
    const canon = getCanonical(html)
    expect(canon).toMatch(/^https?:\/\//)
    expect(canon).toContain(path)
    expect(getMeta(html, 'og:title')).toBeTruthy()

    expect(getMeta(html, 'og:description')).toBeTruthy()
    expect(getMeta(html, 'twitter:description')).toBeTruthy()
    expect(getMeta(html, 'description')).toBeTruthy()

    expect(getMeta(html, 'og:image')).toBeTruthy()
    expect(getMeta(html, 'og:image:secure_url')).toBe(getMeta(html, 'og:image'))
    expect(getMeta(html, 'og:image:alt')).toBeTruthy()
    expect(getMeta(html, 'twitter:image:alt')).toBeTruthy()
    expect(getMeta(html, 'og:url')).toBe(canon)
    expect(canon).toMatch(/^https:\/\//)
    expect(getMeta(html, 'og:site_name')).toBeTruthy()
    expect(getMeta(html, 'og:locale')).toBeTruthy()
    expect(getHreflang(html, 'ko')).toBeTruthy()
    expect(getHreflang(html, 'x-default')).toBeTruthy()
  })
}

test('history subtree is noindex with no hreflang', async ({ request }) => {
  const html = await (await request.get('/history')).text()
  expect((getRobots(html) ?? '').toLowerCase()).toContain('noindex')
  expect(getHreflang(html, 'ko')).toBeNull()
})

test('static descriptions are localized rather than English fallbacks', async ({ request }) => {
  const french = await (await request.get('/about', { headers: { 'x-forwarded-host': 'livredemormon.fr' } })).text()
  expect(getMeta(french, 'description')).toContain('Découvrez')
  expect(getMeta(french, 'description')).not.toContain('What is Book of Mormon Online')

  const korean = await (await request.get('/contents', { headers: { 'x-forwarded-host': 'xn--289a67xla.kr' } })).text()
  expect(getMeta(korean, 'description')).toContain('목차')
})

test('public documents carry the security header baseline', async ({ request }) => {
  const headers = (await request.get('/about')).headers()
  expect(headers['strict-transport-security']).toBe('max-age=31536000')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('SAMEORIGIN')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(headers['content-security-policy']).toContain('https://static.cloudflareinsights.com')
  expect(headers['content-security-policy']).toContain('https://static.getclicky.com')
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'")
  expect(headers['content-security-policy']).toContain("object-src 'none'")
})

test('the /특별반 alias opts out of hreflang but keeps a complete head', async ({ request }) => {
  const html = await (await request.get('/%ED%8A%B9%EB%B3%84%EB%B0%98')).text()
  expect(getTitle(html)).toBeTruthy()
  expect(getCanonical(html)).toBeTruthy()
  expect(getHreflang(html, 'ko')).toBeNull()
})
