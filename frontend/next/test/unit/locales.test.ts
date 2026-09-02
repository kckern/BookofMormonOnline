import { test, expect } from '@playwright/test'
import { langForHost, bcp47, isAuthorizedHost, isInfraHost, isForceSsrHost, CANONICAL_EN_HOST, normalizeHost, safeHost } from '../../lib/locales'

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

test.describe('force-SSR mirror hosts (ssr.*)', () => {
  test('isForceSsrHost only for the ssr.* hosts', () => {
    expect(isForceSsrHost('ssr.bookofmormon.online')).toBe(true)
    expect(isForceSsrHost('ssr-kr.bookofmormon.online')).toBe(true)
    expect(isForceSsrHost('SSR.BOOKOFMORMON.ONLINE:443')).toBe(true)
    expect(isForceSsrHost('bookofmormon.online')).toBe(false)
    expect(isForceSsrHost('ssr.evil.com')).toBe(false)
  })
  test('are authorized to serve (no 301)', () => {
    expect(isAuthorizedHost('ssr.bookofmormon.online')).toBe(true)
    expect(isAuthorizedHost('ssr-kr.bookofmormon.online')).toBe(true)
  })
  test('lang resolves per mirror: ssr→en, ssr-kr→ko', () => {
    expect(langForHost('ssr.bookofmormon.online')).toBe('en')
    expect(langForHost('ssr-kr.bookofmormon.online')).toBe('ko')
  })
  test('canonical/og host maps to the REAL production host, never ssr.*', () => {
    expect(safeHost('ssr.bookofmormon.online')).toBe('bookofmormon.online')
    expect(safeHost('ssr-kr.bookofmormon.online')).toBe('xn--289a67xla.kr')
  })
})

test.describe('CANONICAL_EN_HOST', () => {
  test('is the apex and is itself authorized', () => {
    expect(CANONICAL_EN_HOST).toBe('bookofmormon.online')
    expect(isAuthorizedHost(CANONICAL_EN_HOST)).toBe(true) // never redirects to itself
  })
})

test.describe('isAuthorizedHost', () => {
  test('every HOST_LANG host is authorized', () => {
    expect(isAuthorizedHost('bookofmormon.online')).toBe(true)
    expect(isAuthorizedHost('swe.bookofmormon.online')).toBe(true)
    expect(isAuthorizedHost('buchmormon.de')).toBe(true)
    expect(isAuthorizedHost('몰몬경.kr')).toBe(true)
  })
  test('strips forwarded-chain, port, case', () => {
    expect(isAuthorizedHost('SWE.BOOKOFMORMON.ONLINE:443')).toBe(true)
    expect(isAuthorizedHost('buchmormon.de, proxy.internal')).toBe(true)
  })
  test('unknown subdomains are NOT authorized', () => {
    expect(isAuthorizedHost('new.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('opengraph.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('sugardoodle.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('ko.bookofmormon.online')).toBe(false) // ko host is 몰몬경.kr, not this
  })
  test('unrelated + empty hosts are NOT authorized', () => {
    expect(isAuthorizedHost('evil.example.com')).toBe(false)
    expect(isAuthorizedHost(null)).toBe(false)
    expect(isAuthorizedHost('')).toBe(false)
  })
})

test.describe('isInfraHost', () => {
  test('local / hostless / IP / single-label → infra (never redirected)', () => {
    expect(isInfraHost('localhost')).toBe(true)
    expect(isInfraHost('localhost:3001')).toBe(true)
    expect(isInfraHost('dev.local')).toBe(true)
    expect(isInfraHost('127.0.0.1')).toBe(true)
    expect(isInfraHost('10.0.1.12')).toBe(true)
    expect(isInfraHost('[::1]:8200')).toBe(true)
    expect(isInfraHost('bom-app')).toBe(true)  // single-label internal service name
    expect(isInfraHost('')).toBe(true)
    expect(isInfraHost(null)).toBe(true)
  })
  test('real public multi-label hosts → not infra', () => {
    expect(isInfraHost('new.bookofmormon.online')).toBe(false)
    expect(isInfraHost('bookofmormon.online')).toBe(false)
    expect(isInfraHost('evil.example.com')).toBe(false)
  })
})

test.describe('normalizeHost', () => {
  test('takes first forwarded entry, strips port, lowercases', () => {
    expect(normalizeHost('Buchmormon.DE, proxy.internal')).toBe('buchmormon.de')
    expect(normalizeHost('SWE.bookofmormon.online:443')).toBe('swe.bookofmormon.online')
    expect(normalizeHost(null)).toBe('')
    expect(normalizeHost('')).toBe('')
  })
})

test.describe('safeHost', () => {
  test('authorized hosts pass through (port preserved)', () => {
    expect(safeHost('bookofmormon.online')).toBe('bookofmormon.online')
    expect(safeHost('swe.bookofmormon.online')).toBe('swe.bookofmormon.online')
    expect(safeHost('xn--289a67xla.kr')).toBe('xn--289a67xla.kr')
    expect(safeHost('bookofmormon.online:443')).toBe('bookofmormon.online:443') // port kept in output
  })
  test('localhost still allowed for dev/harness', () => {
    expect(safeHost('localhost')).toBe('localhost')
  })
  test('unregistered *.bookofmormon.online falls back to apex', () => {
    expect(safeHost('new.bookofmormon.online')).toBe('bookofmormon.online')
    expect(safeHost('ko.bookofmormon.online')).toBe('bookofmormon.online')
  })
  test('unrelated + empty fall back to apex', () => {
    expect(safeHost('evil.example.com')).toBe('bookofmormon.online')
    expect(safeHost(null)).toBe('bookofmormon.online')
  })
})
