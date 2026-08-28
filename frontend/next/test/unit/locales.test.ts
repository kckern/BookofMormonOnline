import { test, expect } from '@playwright/test'
import { langForHost, bcp47 } from '../../lib/locales'

test.describe('langForHost', () => {
  test('apex → en', () => { expect(langForHost('bookofmormon.online')).toBe('en') })
  test('korean punycode + utf8 → ko', () => {
    expect(langForHost('xn--289a67xla.kr')).toBe('ko')
    expect(langForHost('몰몬경.kr')).toBe('ko')
  })
  test('strips port + lowercases', () => { expect(langForHost('XN--289A67XLA.KR:443')).toBe('ko') })
  test('internal codes verbatim from CRA', () => {
    expect(langForHost('swe.bookofmormon.online')).toBe('swe')
    expect(langForHost('sachmacmon.vn')).toBe('vn')
    expect(langForHost('mormonovaknjiga.si')).toBe('slv')
  })
  test('unknown host → en', () => { expect(langForHost('evil.example.com')).toBe('en'); expect(langForHost(null)).toBe('en') })
})
test.describe('bcp47', () => {
  test('maps internal→tag', () => { expect(bcp47('swe')).toBe('sv'); expect(bcp47('vn')).toBe('vi'); expect(bcp47('ko')).toBe('ko') })
})
