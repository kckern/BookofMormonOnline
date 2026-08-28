import { test, expect } from '@playwright/test'
import { superscript } from '../../lib/entity'

test.describe('superscript (unicode)', () => {
  test('Korean disambiguator', () => { expect(superscript('니파이1')).toBe('니파이¹') })
  test('English still works', () => { expect(superscript('Nephi1')).toBe('Nephi¹') })
  test('does not mangle years/standalone numbers', () => {
    expect(superscript('1830')).toBe('1830')
    expect(superscript('Alma 32')).toBe('Alma 32')
  })
})
