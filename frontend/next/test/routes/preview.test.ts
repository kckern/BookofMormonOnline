import { test, expect } from '@playwright/test'

// The legacy PHP GD preview service (img.bookofmormon.online/<slug>) ported to
// the /preview route: the middleware rewrites any img.* path to it, gathering
// card fields from our data layer and rendering the shared og card.
test.describe('preview social cards (img.* port)', () => {
  test('direct /preview?q=<page> → PNG card', async ({ request }) => {
    const r = await request.get('/preview?q=lehites&lang=en')
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
    expect((await r.body()).length).toBeGreaterThan(10000)
  })

  test('img.* host rewrites any path to a preview card', async ({ request }) => {
    for (const slug of ['/lehites', '/lehites/1', '/contents', '/']) {
      const r = await request.get(slug, { headers: { 'x-forwarded-host': 'img.bookofmormon.online' } })
      expect(r.status(), slug).toBe(200)
      expect(r.headers()['content-type'], slug).toContain('image/png')
    }
  })

  test('img-kr host renders a Korean card (different bytes than English)', async ({ request }) => {
    const en = (await (await request.get('/lehites', { headers: { 'x-forwarded-host': 'img.bookofmormon.online' } })).body()).length
    const ko = (await (await request.get('/lehites', { headers: { 'x-forwarded-host': 'img-kr.bookofmormon.online' } })).body()).length
    expect(ko).toBeGreaterThan(10000)
    expect(ko).not.toBe(en) // Korean title/desc/font → a materially different image
  })
})
