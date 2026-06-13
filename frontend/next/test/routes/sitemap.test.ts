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
})
