import { test, expect } from '@playwright/test'

test.describe('Robots /robots.txt', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200)
  })

  test('contains Sitemap directive', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('Sitemap:')
  })

  test('allows all user agents by default', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    // Next.js renders "User-Agent" (capital A); both casings are valid per the robots.txt spec
    expect(body.toLowerCase()).toContain('user-agent: *')
  })

  test('uses the language host sitemap and omits it for unsupported locales', async ({ request }) => {
    const ko = await (await request.get('/robots.txt', { headers: { 'x-forwarded-host': 'xn--289a67xla.kr' } })).text()
    expect(ko).toContain('Sitemap: https://xn--289a67xla.kr/sitemap.xml')
    const sl = await (await request.get('/robots.txt', { headers: { 'x-forwarded-host': 'mormonovaknjiga.si' } })).text()
    expect(sl).not.toContain('Sitemap:')
  })
})
