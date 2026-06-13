import { test, expect } from '@playwright/test'
import { getMeta, getTitle } from '../helpers/meta'

// Uses a real chapter from bom_prd. 1 Nephi 1 is the canonical first chapter.
const REF = '/1-nephi/1'

test.describe('Scripture route /{slug}/{blockno}', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(REF)
    expect(res.status()).toBe(200)
  })

  test('returns valid HTML document', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(html).toMatch(/<!DOCTYPE html>/i)
    expect(html).toContain('</html>')
  })

  test('<title> is non-empty and not the default fallback', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const title = getTitle(html)
    expect(title).toBeTruthy()
    expect(title).not.toBe('Book of Mormon')
    // Should contain a chapter reference or heading
    expect(title!.length).toBeGreaterThan(3)
  })

  test('og:title is present and non-empty', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(getMeta(html, 'og:title')).toBeTruthy()
  })

  test('og:description is present and non-empty', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    expect(getMeta(html, 'og:description')).toBeTruthy()
  })

  test('og:image is an absolute URL', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const img = getMeta(html, 'og:image')
    expect(img).toBeTruthy()
    expect(img).toMatch(/^https?:\/\//)
  })

  test('og:image URL resolves to a PNG', async ({ request }) => {
    const res = await request.get(REF)
    const html = await res.text()
    const img = getMeta(html, 'og:image')!
    // Strip host so the request goes through the test server
    const path = new URL(img).pathname + new URL(img).search
    const imgRes = await request.get(path)
    expect(imgRes.status()).toBe(200)
    expect(imgRes.headers()['content-type']).toContain('image/png')
  })

  test('page body contains scripture text (not empty)', async ({ page }) => {
    await page.goto(REF)
    // Some text content should be visible — not a blank page
    const text = await page.locator('body').innerText()
    expect(text.trim().length).toBeGreaterThan(50)
  })
})
