import { test, expect } from '@playwright/test'
import { getHreflang } from '../helpers/meta'

test.describe('hreflang alternates', () => {
  test('a content page emits supported-lang alternates + x-default', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    expect(getHreflang(html, 'ko')).toBe('https://xn--289a67xla.kr/people/nephi1')
    expect(getHreflang(html, 'es')).toBe('https://libromormon.es/people/nephi1')
    expect(getHreflang(html, 'sv')).toBe('https://swe.bookofmormon.online/people/nephi1')
    expect(getHreflang(html, 'vi')).toBe('https://sachmacmon.vn/people/nephi1')
    expect(getHreflang(html, 'en')).toBe('https://bookofmormon.online/people/nephi1')
    expect(getHreflang(html, 'x-default')).toBe('https://bookofmormon.online/people/nephi1')
  })

  test('non-backend-supported langs (slv/tr) are NOT emitted', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    expect(getHreflang(html, 'sl')).toBeNull()
    expect(getHreflang(html, 'tr')).toBeNull()
  })

  test('a noindex subtree (/history) emits no hreflang', async ({ request }) => {
    const html = await (await request.get('/history')).text()
    expect(getHreflang(html, 'ko')).toBeNull()
    expect(getHreflang(html, 'x-default')).toBeNull()
  })

  test('the /특별반 alias opts out of hreflang', async ({ request }) => {
    const html = await (await request.get('/%ED%8A%B9%EB%B3%84%EB%B0%98')).text()
    expect(getHreflang(html, 'ko')).toBeNull()
  })
})
