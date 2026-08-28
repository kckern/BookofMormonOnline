import { test, expect } from '@playwright/test'
import { slugify, BOM_BOOKS, bomChapterSlugs } from '../../lib/scripture'

test.describe('slugify (ported from the CRA reader)', () => {
  test('chapter refs → dot slug', () => {
    expect(slugify('Alma 32')).toBe('alma.32')
    expect(slugify('1 Nephi 3')).toBe('1.nephi.3')
    expect(slugify('Words of Mormon 1')).toBe('words.of.mormon.1')
  })
  test('colons → dots, hyphens → tildes, lowercased', () => {
    expect(slugify('Alma 32:21')).toBe('alma.32.21')
    expect(slugify('Alma 32:21-24')).toBe('alma.32.21~24')
  })
})

test.describe('BoM chapter table', () => {
  test('has 15 books totalling 239 chapters', () => {
    expect(BOM_BOOKS.length).toBe(15)
    expect(BOM_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(239)
  })
  test('enumerates 239 chapter slugs, first and last correct', () => {
    const slugs = bomChapterSlugs()
    expect(slugs.length).toBe(239)
    expect(slugs[0]).toBe('1.nephi.1')
    expect(slugs[slugs.length - 1]).toBe('moroni.10')
  })
})
