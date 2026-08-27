import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'
import { expectSsrPage } from '../helpers/ssr'

// nephi1 is the most prominent person in bom_prd (slug uses numeric suffix)
const PATH = '/people/nephi1'

test.describe('People route /people/{slug}', () => {
  test('/people index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/people', { titleIncludes: 'people' })
  })

  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> contains the person name', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const title = getTitle(html)
    expect(title).toBeTruthy()
    // Title should include "Nephi" (case-insensitive)
    expect(title!.toLowerCase()).toContain('nephi')
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
  })

  test('og:image is an absolute URL', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')
    expect(img).toMatch(/^https?:\/\//)
  })

  test('og:image resolves to PNG', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')!
    const path = new URL(img).pathname + new URL(img).search
    const r = await request.get(path)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })

  test('unknown person returns 404', async ({ request }) => {
    const r = await request.get('/people/zzz-does-not-exist-xyz')
    expect(r.status()).toBe(404)
  })
})
