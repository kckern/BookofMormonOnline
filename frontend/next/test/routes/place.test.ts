import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

// jerusalem-1 is the primary Jerusalem entry in bom_prd
const PATH = '/place/jerusalem-1'

test.describe('Places route /place/{slug}', () => {
  test('returns 200', async ({ request }) => {
    expect((await request.get(PATH)).status()).toBe(200)
  })

  test('<title> contains the place name', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    const title = getTitle(html)
    expect(title!.toLowerCase()).toContain('jerusalem')
  })

  test('og:title is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is non-empty', async ({ request }) => {
    const html = await (await request.get(PATH)).text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
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

  test('unknown place returns 404', async ({ request }) => {
    const r = await request.get('/place/zzz-no-such-place-xyz')
    expect(r.status()).toBe(404)
  })
})
