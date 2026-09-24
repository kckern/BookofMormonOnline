import { test, expect, type APIRequestContext } from '@playwright/test'
import { getMeta, getTitle, getHreflang } from '../helpers/meta'

// Playwright follows redirects by default; 0 is required to assert the 308.
const noFollow = { maxRedirects: 0 as const }

// The redirect branch is data-coupled: exactly ONE single-variant base exists in
// the people dataset today (shem → shem2). Hard-coding it means that the day
// someone adds shem1, this test fails as a confusing 200-instead-of-308 rather
// than as "the fixture moved". Derive the base from the live index instead, so
// the test asserts the RULE and skips cleanly if the dataset stops exercising it.
async function singleVariantBase(
  request: APIRequestContext,
  base: string,
): Promise<{ bare: string; slug: string } | null> {
  const html = await (await request.get(base)).text()
  const slugs = [...html.matchAll(new RegExp(`href="${base}/([^"]+)"`, 'g'))].map((m) => m[1])
  const known = new Set(slugs.map((x) => x.toLowerCase()))
  const groups = new Map<string, string[]>()
  for (const slug of slugs) {
    const m = slug.match(/^(.*?)-?\d+$/)
    if (!m || known.has(m[1])) continue // exact-wins bases can't test redirect
    groups.set(m[1], [...(groups.get(m[1]) ?? []), slug])
  }
  for (const [bare, variants] of groups) {
    if (variants.length === 1) return { bare, slug: variants[0] }
  }
  return null
}

test.describe('People bare-slug resolution', () => {
  test('single variant → 308 to the canonical slug', async ({ request }) => {
    const found = await singleVariantBase(request, '/people')
    test.skip(!found, 'dataset currently has no single-variant person slug')
    const r = await request.get(`/people/${found!.bare}`, noFollow)
    expect(r.status()).toBe(308)
    expect(r.headers()['location']).toContain(`/people/${found!.slug}`)
  })

  test('several variants → 200 chooser listing every variant', async ({ request }) => {
    const r = await request.get('/people/noah')
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).toContain('/people/noah1')
    expect(html).toContain('/people/noah2')
    expect(html).toContain('/people/noah3')
  })

  test('chooser excludes loose prefix matches', async ({ request }) => {
    const html = await (await request.get('/people/noah')).text()
    expect(html).not.toContain('/people/noahs-priests')
  })

  test('chooser is noindex, follow', async ({ request }) => {
    const html = await (await request.get('/people/noah')).text()
    expect(getMeta(html, 'robots')).toContain('noindex')
    expect(getMeta(html, 'robots')).toContain('follow')
  })

  test('chooser emits no hreflang alternates', async ({ request }) => {
    // Convention in this codebase: noindex pages carry no hreflang. See the
    // history-subtree assertion in test/routes/head-audit.test.ts.
    const html = await (await request.get('/people/noah')).text()
    expect(getHreflang(html, 'ko')).toBeNull()
    expect(getHreflang(html, 'x-default')).toBeNull()
  })

  test('chooser has a title naming what was requested', async ({ request }) => {
    const html = await (await request.get('/people/noah')).text()
    expect(getTitle(html)?.toLowerCase()).toContain('noah')
  })

  test('exact slug still wins over its own variants', async ({ request }) => {
    // angels-to-nephi is a real slug AND the variant base of angels-to-nephi3.
    // Assert against the slug that EXISTS — an earlier draft asserted the
    // absence of 'angels-to-nephi1', which is not in the dataset at all, so the
    // test passed even with the resolver removed.
    const r = await request.get('/people/angels-to-nephi', noFollow)
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html).not.toContain('/people/angels-to-nephi3')
    // Positive assertion: the person page rendered, not a chooser.
    expect(getTitle(html)?.toLowerCase()).toContain('angels')
  })

  test('unresolvable slug still 404s', async ({ request }) => {
    expect((await request.get('/people/king-noah', noFollow)).status()).toBe(404)
  })

  test('existing exact-slug pages are unchanged', async ({ request }) => {
    const r = await request.get('/people/nephi1', noFollow)
    expect(r.status()).toBe(200)
    expect(getTitle(await r.text())?.toLowerCase()).toContain('nephi')
  })
})
