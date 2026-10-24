import { test, expect } from '@playwright/test'
import { seoIntentForPath } from '../../lib/features'

test.describe('seoIntentForPath', () => {
  test('un-gated path → crawl', () => {
    expect(seoIntentForPath('/people')).toBe('crawl')
    expect(seoIntentForPath('/')).toBe('crawl')
  })
  test('remove features → remove', () => {
    expect(seoIntentForPath('/home')).toBe('remove')
    expect(seoIntentForPath('/matters')).toBe('crawl') // Matters is crawlable since 2026-10-23
    expect(seoIntentForPath('/home/user')).toBe('remove')
    expect(seoIntentForPath('/home')).toBe('remove')
    expect(seoIntentForPath('/home/community')).toBe('remove')
  })
  test('history → noindex, incl. deep + slug paths', () => {
    expect(seoIntentForPath('/history')).toBe('noindex')
    expect(seoIntentForPath('/history/lost-116-pages')).toBe('noindex')
  })
  test('utility surfaces are noindex', () => {
    expect(seoIntentForPath('/search')).toBe('noindex')
    expect(seoIntentForPath('/user/jane')).toBe('noindex')
  })
  test('segment-prefix only — /historyfoo is NOT history', () => {
    expect(seoIntentForPath('/historyfoo')).toBe('crawl')
    expect(seoIntentForPath('/homepage')).toBe('crawl')
  })
  test('locale prefix is stripped before matching', () => {
    expect(seoIntentForPath('/ko/history')).toBe('noindex')
    expect(seoIntentForPath('/en/home')).toBe('remove')
    expect(seoIntentForPath('/fr/home/community')).toBe('remove')
  })
  test('trailing slash + query are ignored', () => {
    expect(seoIntentForPath('/history/')).toBe('noindex')
    expect(seoIntentForPath('/home?q=x')).toBe('remove')
  })
})
