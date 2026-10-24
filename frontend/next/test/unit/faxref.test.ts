import { test, expect } from '@playwright/test'
import { refFromSlug } from '../../lib/faxref'

test.describe('refFromSlug', () => {
  test('verse slugs', () => {
    expect(refFromSlug('alma.32.21')).toBe('Alma 32:21')
    expect(refFromSlug('1.nephi.3.7')).toBe('1 Nephi 3:7')
    expect(refFromSlug('words.of.mormon.1.3')).toBe('Words Of Mormon 1:3')
  })
  test('ranges and chapters', () => {
    expect(refFromSlug('alma.32.21~23')).toBe('Alma 32:21–23')
    expect(refFromSlug('alma.32')).toBe('Alma 32')
  })
  test('page numbers and romans are not refs', () => {
    expect(refFromSlug('100')).toBeNull()
    expect(refFromSlug('iv')).toBeNull()
  })
})
