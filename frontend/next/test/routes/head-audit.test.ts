import { test, expect } from '@playwright/test'
import { getTitle, getCanonical, getMeta, getRobots, getHreflang } from '../helpers/meta'

// One representative URL per crawl route class (all route through buildMetadata).
const CRAWL = ['/people/nephi1', '/place/jerusalem-1', '/art/1000', '/contents', '/about']

for (const path of CRAWL) {
  test(`head is complete + hreflang present: ${path}`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    expect(getTitle(html)).toBeTruthy()
    const canon = getCanonical(html)
    expect(canon).toMatch(/^https?:\/\//)
    expect(canon).toContain(path)
    expect(getMeta(html, 'og:title')).toBeTruthy()

    if (path !== '/contents') {
      // /contents intentionally passes description: '' to buildMetadata (PHP parity:
      // the PHP box emits a blank description for /contents). og:description and the
      // <meta name="description"> are therefore absent — that is correct behaviour,
      // not a straggler. All other crawl pages must have a real description.
      expect(getMeta(html, 'og:description')).toBeTruthy()
      expect(getMeta(html, 'description')).toBeTruthy()
    }

    expect(getMeta(html, 'og:image')).toBeTruthy()
    expect(getHreflang(html, 'ko')).toBeTruthy()
    expect(getHreflang(html, 'x-default')).toBeTruthy()
  })
}

test('history subtree is noindex with no hreflang', async ({ request }) => {
  const html = await (await request.get('/history')).text()
  expect((getRobots(html) ?? '').toLowerCase()).toContain('noindex')
  expect(getHreflang(html, 'ko')).toBeNull()
})

test('public documents carry the security header baseline', async ({ request }) => {
  const headers = (await request.get('/about')).headers()
  expect(headers['strict-transport-security']).toBe('max-age=31536000')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('SAMEORIGIN')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
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
