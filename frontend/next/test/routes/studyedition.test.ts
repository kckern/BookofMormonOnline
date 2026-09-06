import { test, expect } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Study edition routes', () => {
  test('/studyedition renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/studyedition', { canonicalPath: '/%ED%8A%B9%EB%B3%84%EB%B0%98' })
  })
  test('/특별반 alias renders SSR content (percent-encoded canonical)', async ({ request }) => {
    const html = await (await request.get('/특별반')).text()
    expect(html).toContain('몰몬경—특별반')
  })
  test('public non-Korean hosts redirect to the canonical Korean route', async ({ request }) => {
    const r = await request.get('/studyedition', {
      headers: { 'x-forwarded-host': 'bookofmormon.online' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://xn--289a67xla.kr/%ED%8A%B9%EB%B3%84%EB%B0%98')
  })
})
