import { test, expect } from '@playwright/test'
import { getCanonical, getRobots, getH1 } from '../helpers/meta'

const HTML = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://bookofmormon.online/people/nephi1"/>
<meta name="robots" content="noindex, follow"/>
</head><body><h1><a href="/x">Nephi <sup>1</sup></a></h1><p>body</p></body></html>`

test.describe('meta helpers', () => {
  test('getCanonical extracts the canonical href', () => {
    expect(getCanonical(HTML)).toBe('https://bookofmormon.online/people/nephi1')
    expect(getCanonical('<html></html>')).toBeNull()
  })
  test('getRobots extracts the robots content', () => {
    expect(getRobots(HTML)).toBe('noindex, follow')
    expect(getRobots('<html></html>')).toBeNull()
  })
  test('getH1 extracts h1 text, stripping nested tags', () => {
    expect(getH1(HTML)).toBe('Nephi 1')
    expect(getH1('<html></html>')).toBeNull()
  })
})
