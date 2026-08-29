import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'
import { expectSsrPage } from '../helpers/ssr'

// "jaredites" is a static page that exists in bom_prd
const PATH = '/jaredites'

test.describe('Page catch-all route /{slug}', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getTitle(html)).toBeTruthy()
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is present', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const desc = getMeta(html, 'og:description')
    const img = getMeta(html, 'og:image')
    expect(desc || img).toBeTruthy()
  })

  test('og:image is absolute URL and resolves to PNG', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const img = getMeta(html, 'og:image')!
    expect(img).toMatch(/^https?:\/\//)
    const path = new URL(img).pathname + new URL(img).search
    const r = await request.get(path)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })

  test('generic unknown single-segment is a real 404', async ({ request }) => {
    const r = await request.get('/zzz-no-such-page-xyz')
    expect(r.status()).toBe(404)
  })

  test('unknown entity slug (2-segment) is a real 404', async ({ request }) => {
    expect((await request.get('/people/zzz-no-such-person-xyz')).status()).toBe(404)
  })

  // Section kind: 2-segment non-numeric — the bulk of the sitemap.
  test('section route /{page}/{section} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/lehites/lehis-prophetic-call')
  })

  test('title-page section renders without a null-parent heading error', async ({ request }) => {
    const html = await expectSsrPage(request, '/moroni/finishing-touches')
    expect(html).toContain('Title Page')
  })
})
