import { expect, type APIRequestContext } from '@playwright/test'
import { getTitle, getMeta, getCanonical, getH1 } from './meta'

// Asserts the common SSR-page contract for a bot request:
//   200, non-empty <title> (optionally containing a substring), a path-correct
//   absolute canonical, og:title, (optional) og:description, an og:image that
//   resolves to a PNG, and a body <h1>. Returns the HTML for extra assertions.
// canonicalPath defaults to `path`; pass it when the emitted canonical is
// percent-encoded (e.g. /특별반). Host-awareness is covered by seo-gating.test.ts;
// here we assert the canonical PATHNAME only, so it's environment-agnostic.
export async function expectSsrPage(
  request: APIRequestContext,
  path: string,
  opts: { titleIncludes?: string; canonicalPath?: string; requireDescription?: boolean } = {},
): Promise<string> {
  const requireDescription = opts.requireDescription ?? true
  const res = await request.get(path)
  expect(res.status(), `${path} status`).toBe(200)
  const html = await res.text()

  const title = getTitle(html)
  expect(title, `${path} <title>`).toBeTruthy()
  if (opts.titleIncludes) {
    expect(title!.toLowerCase(), `${path} <title> includes`).toContain(opts.titleIncludes.toLowerCase())
  }

  const canonical = getCanonical(html)
  expect(canonical, `${path} canonical present`).toBeTruthy()
  expect(canonical!, `${path} canonical absolute`).toMatch(/^https?:\/\//)
  expect(new URL(canonical!).pathname, `${path} canonical pathname`).toBe(opts.canonicalPath ?? path)

  expect(getMeta(html, 'og:title'), `${path} og:title`).toBeTruthy()
  if (requireDescription) {
    expect(getMeta(html, 'og:description'), `${path} og:description`).toBeTruthy()
  }

  const img = getMeta(html, 'og:image')
  expect(img, `${path} og:image present`).toBeTruthy()
  expect(img!, `${path} og:image absolute`).toMatch(/^https?:\/\//)
  const imgPath = new URL(img!).pathname + new URL(img!).search
  const imgRes = await request.get(imgPath)
  expect(imgRes.status(), `${path} og:image resolves`).toBe(200)
  expect(imgRes.headers()['content-type'], `${path} og:image png`).toContain('image/png')

  expect(getH1(html), `${path} <h1>`).toBeTruthy()
  return html
}
