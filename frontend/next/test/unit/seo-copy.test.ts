import { test, expect } from '@playwright/test'
import { localizedOrFallback, seoEntityDescription, seoPageDescription } from '../../lib/seo-copy'

const LANGS = ['en', 'ko', 'es', 'fr', 'de', 'swe', 'vn', 'ru', 'tgl']

test('every indexable language has nonempty static SEO copy', () => {
  for (const lang of LANGS) {
    for (const key of ['home', 'about', 'contents', 'people', 'places', 'maps', 'timeline', 'facsimiles', 'search', 'user'] as const) {
      expect(seoPageDescription(lang, key), `${lang}.${key}`).toBeTruthy()
    }
  }
})

test('an untranslated overlay uses the requested-language entity fallback', () => {
  const fallback = localizedOrFallback('fr', 'English source text', 'English source text', 'Néphi')
  expect(fallback).toBe(seoEntityDescription('fr', 'Néphi'))
  expect(fallback).toContain('Explorez')
})

test('a real localized overlay is preserved', () => {
  expect(localizedOrFallback('ko', '번역된 설명', 'English description', '니파이')).toBe('번역된 설명')
})
