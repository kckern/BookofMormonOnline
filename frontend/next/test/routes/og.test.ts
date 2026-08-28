import { test, expect } from '@playwright/test'
import { getMeta } from '../helpers/meta'

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

test.describe('og image thumbnails', () => {
  test('valid art img → 200 png, larger than the text-only card', async ({ request }) => {
    const withImg = await request.get('/og?title=Art&img=1000&imgtype=art')
    expect(withImg.status()).toBe(200)
    expect(withImg.headers()['content-type']).toContain('image/png')
    const textOnly = await request.get('/og?title=Art')
    // the embedded artwork adds pixel data → larger PNG (proves the image path ran)
    expect((await withImg.body()).byteLength).toBeGreaterThan((await textOnly.body()).byteLength)
  })
  test('missing image → 200 png text-card fallback (no crash/dropped connection)', async ({ request }) => {
    const r = await request.get('/og?title=X&img=moroni&imgtype=people')
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })
  test('path-traversal img is rejected → 200 png', async ({ request }) => {
    const r = await request.get('/og?title=X&img=' + encodeURIComponent('../people/nephi') + '&imgtype=art')
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  })
})

test.describe('pages request their thumbnail', () => {
  test('/art/{id} og:image carries img + imgtype=art', async ({ request }) => {
    const og = getMeta(await (await request.get('/art/1000')).text(), 'og:image')!
    expect(og).toContain('img=1000')
    expect(og).toContain('imgtype=art')
  })
  test('/people/{slug} og:image carries img + imgtype=people', async ({ request }) => {
    const og = getMeta(await (await request.get('/people/nephi1')).text(), 'og:image')!
    expect(og).toContain('img=nephi1')
    expect(og).toContain('imgtype=people')
  })
  test('/place/{slug} og:image carries img + imgtype=places', async ({ request }) => {
    const og = getMeta(await (await request.get('/place/jerusalem-1')).text(), 'og:image')!
    expect(og).toContain('img=jerusalem-1')
    expect(og).toContain('imgtype=places')
  })
  test('a text page (/contents) has no img param', async ({ request }) => {
    const og = getMeta(await (await request.get('/contents')).text(), 'og:image')!
    expect(og).not.toContain('img=')
  })
})
