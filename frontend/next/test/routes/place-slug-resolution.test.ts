import { test, expect } from '@playwright/test'
import { getMeta } from '../helpers/meta'

const noFollow = { maxRedirects: 0 as const }

test.describe('Place bare-slug resolution', () => {
  test('several variants → chooser, on both /place and /places', async ({ request }) => {
    for (const base of ['/place', '/places']) {
      const r = await request.get(`${base}/jerusalem`)
      expect(r.status(), `${base}/jerusalem status`).toBe(200)
      const html = await r.text()
      // Hyphenated variant form — the '-?' half of the rule.
      expect(html, `${base} lists jerusalem-1`).toContain(`${base}/jerusalem-1`)
      expect(html, `${base} lists jerusalem-2`).toContain(`${base}/jerusalem-2`)
    }
  })

  test('chooser is noindex, follow', async ({ request }) => {
    const html = await (await request.get('/places/jerusalem')).text()
    expect(getMeta(html, 'robots')).toContain('noindex')
    expect(getMeta(html, 'robots')).toContain('follow')
  })

  test('unresolvable slug still 404s', async ({ request }) => {
    expect((await request.get('/places/atlantis', noFollow)).status()).toBe(404)
  })

  test('existing exact-slug pages are unchanged on both bases', async ({ request }) => {
    expect((await request.get('/places/zarahemla', noFollow)).status()).toBe(200)
    expect((await request.get('/place/zarahemla', noFollow)).status()).toBe(200)
  })
})
