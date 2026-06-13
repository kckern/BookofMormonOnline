import { test, expect } from '@playwright/test'

test.describe('OG image route /og', () => {
  test('returns 200 with content-type image/png', async ({ request }) => {
    const res = await request.get('/og?title=Test+Title&sub=Subtitle&desc=Description&lang=en')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type']
    expect(ct).toContain('image/png')
  })

  test('image body is non-empty (has pixel data)', async ({ request }) => {
    const res = await request.get('/og?title=1+Nephi+1&sub=Book+of+Mormon&desc=And+it+came+to+pass&lang=en')
    const buf = await res.body()
    // PNG header: 8-byte magic + IHDR chunk (25 bytes) — real images are much larger
    expect(buf.byteLength).toBeGreaterThan(500)
  })

  test('PNG header bytes are correct (real PNG, not an error body)', async ({ request }) => {
    const res = await request.get('/og?title=Nephi&sub=Prophet&desc=A+man&lang=en')
    const buf = await res.body()
    // PNG magic: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // 'P'
    expect(buf[2]).toBe(0x4e) // 'N'
    expect(buf[3]).toBe(0x47) // 'G'
  })

  test('Korean lang param does not crash the route', async ({ request }) => {
    const res = await request.get('/og?title=%EB%8B%88%ED%8C%8C%EC%9D%B4&lang=ko')
    expect(res.status()).toBe(200)
  })

  test('missing params return a valid image (graceful fallback)', async ({ request }) => {
    const res = await request.get('/og')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })
})
