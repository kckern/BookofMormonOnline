import { test, expect } from '@playwright/test'

test.describe('Sitemap /sitemap.xml', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get('/sitemap.xml')).status()).toBe(200)
  })

  test('content-type is application/xml or text/xml', async ({ request }) => {
    const r = await request.get('/sitemap.xml')
    expect(r.headers()['content-type']).toMatch(/xml/)
  })

  test('contains at least one <loc> entry', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain('<loc>')
  })

  test('root URL appears in sitemap', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toMatch(/bookofmormon\.online/)
  })

  test('includes reciprocal localized alternate links', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain('hreflang="fr" href="https://livredemormon.fr/people"')
    expect(xml).toContain('hreflang="x-default" href="https://bookofmormon.online/people"')
  })

  test('English sitemap excludes the Korean-only Study Edition', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).not.toContain('<loc>https://bookofmormon.online/studyedition</loc>')
  })
})
