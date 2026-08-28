import { test, expect } from '@playwright/test'
import { slugify, scripturePreview, BOM_BOOKS, bomChapterSlugs } from '../../lib/scripture-ref'

test.describe('slugify (ported from the CRA reader)', () => {
  test('chapter refs → dot slug', () => {
    expect(slugify('Alma 32')).toBe('alma.32')
    expect(slugify('1 Nephi 3')).toBe('1.nephi.3')
    expect(slugify('Words of Mormon 1')).toBe('words.of.mormon.1')
  })
  test('colons → dots, hyphens → tildes, lowercased', () => {
    expect(slugify('Alma 32:21')).toBe('alma.32.21')
    expect(slugify('Alma 32:21-24')).toBe('alma.32.21~24')
    expect(slugify('Alma 32-33')).toBe('alma.32~33') // chapter-range form (B1 guard input)
  })
})

test.describe('scripturePreview', () => {
  test('returns first non-empty body text, capped at maxWords', () => {
    const block = {
      ref: 'Alma 32', prev_ref: null, next_ref: null,
      sections: [
        { heading: 'H', blocks: [{ lines: [{ text: '', verse_num: 1 }] }] },
        { heading: null, blocks: [{ lines: [{ text: 'now as i said concerning faith', verse_num: 21 }] }] },
      ],
    }
    expect(scripturePreview(block, 3)).toBe('now as i…')
  })
  test('empty block → empty string', () => {
    expect(scripturePreview({ ref: 'x', prev_ref: null, next_ref: null, sections: [] })).toBe('')
  })
})

test.describe('BoM chapter table', () => {
  test('has 15 books totalling 239 chapters', () => {
    expect(BOM_BOOKS.length).toBe(15)
    expect(BOM_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(239)
  })
  test('enumerates 239 chapter slugs; first, a multi-word mid entry, and last are correct', () => {
    const slugs = bomChapterSlugs()
    expect(slugs.length).toBe(239)
    expect(slugs[0]).toBe('1.nephi.1')
    expect(slugs).toContain('words.of.mormon.1')
    expect(slugs[slugs.length - 1]).toBe('moroni.10')
  })
})
