# OG Artwork/Portrait Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make art/people/place OG cards render the actual artwork/portrait (not a generic text card), robustly.

**Architecture:** The `/og` route gets a fixed, whitelisted, sanitized, preflight-checked image path; `buildMetadata` passes `img`+`imgtype` from the art/people/place pages; `BomOgCard` gets width/height attributes as a Satori crash backstop.

**Tech Stack:** Next.js 15 SSR, `next/og` (Satori) ImageResponse, Playwright.

**Spec:** `docs/specs/2026-08-27-og-thumbnails.md`
**All paths relative to `frontend/next/`.** Run commands from `frontend/next/`.

**Verified facts:** media paths — art `media.…/art/{id}` (200), people `media.…/people/{slug}` (200), places `media.…/places/{slug}` (200); the current route hardcodes the WRONG `art/square/{id}.jpg` (404). Missing images 404 (common — moroni/lehi/jerusalem 404; nephi/alma/zarahemla/land-of-nephi/art-1000 are 200). Satori **throws/drops the connection** on a 404 `<img src>` unless the img has width/height **attributes**. HEAD is supported; `AbortSignal.timeout` is available (Node runtime). The Playwright project sends a Googlebot UA by default (so `request.get()` on a page hits the SSR).

---

## File Structure
**Modify:** `app/og/route.ts` (fix path + imgtype whitelist + sanitize + preflight), `app/og/BomOgCard.tsx` (img width/height attrs), `lib/seo.ts` (`ogImg`/`ogImgType` → og params), `app/art/[id]/page.tsx`, `app/people/[slug]/page.tsx`, `app/place/PlaceView.tsx`, `test/routes/og.test.ts`.

---

## Task 1: `/og` route — fixed, whitelisted, sanitized, preflighted + card backstop

**Files:** Modify `app/og/route.ts`, `app/og/BomOgCard.tsx`; Test `test/routes/og.test.ts`.

- [ ] **Step 1: Write the failing tests.** APPEND to `test/routes/og.test.ts`:
```ts
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
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/og.test.ts -g "og image thumbnails"`
Expected: FAIL — the valid-art case uses the wrong `art/square/...` path (404) so it won't render the image (size not greater), and/or the missing case crashes.

- [ ] **Step 3: Fix the route.** In `app/og/route.ts`, REPLACE the current image block:
```ts
  // Art image: numeric art ID → media CDN URL
  const artId = searchParams.get('img')
  const artUrl = artId
    ? `https://media.bookofmormon.online/art/square/${artId}.jpg`
    : undefined
```
with:
```ts
  // Thumbnail: id/slug + whitelisted type → media path. Sanitize (fetch normalizes
  // '../', so an unsanitized img could traverse to another media path). Preflight so a
  // missing image (404, common) degrades to a text card instead of crashing Satori.
  const MEDIA = 'https://media.bookofmormon.online'
  const imgId = searchParams.get('img')
  const imgType = searchParams.get('imgtype') ?? 'art'
  const MEDIA_PATH: Record<string, string> = {
    art: `${MEDIA}/art/${imgId}`,
    people: `${MEDIA}/people/${imgId}`,
    places: `${MEDIA}/places/${imgId}`,
  }
  let artUrl: string | undefined
  if (imgId && /^[A-Za-z0-9_-]+$/.test(imgId) && MEDIA_PATH[imgType]) {
    const candidate = MEDIA_PATH[imgType]
    try {
      const head = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
      if (head.ok) artUrl = candidate
    } catch {
      /* unreachable/timeout → leave artUrl undefined (text card) */
    }
  }
```
(Leave the rest of the route — `title`/`sub`/`desc`/`lang`, `isKorean`, the `ImageResponse`/fonts — unchanged; `artUrl` still flows into `BomOgCard`.)

- [ ] **Step 4: Add the crash backstop to `BomOgCard`.** In `app/og/BomOgCard.tsx`, the `<img>` (inside `{artUrl && (…)}`) currently has `src`/`alt`/`style`. Add explicit `width`/`height` **attributes** (Satori needs these to survive an image it can't fetch):
```tsx
        <img
          src={artUrl}
          alt=""
          width={260}
          height={260}
          style={{
            position: 'absolute',
            right: 30,
            top: 30,
            width: 260,
            height: 260,
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
```

- [ ] **Step 5: Run — passes.**
Run: `npx playwright test test/routes/og.test.ts`
Expected: PASS (existing 5 og tests + 3 new). If the "larger than text-only" byte assertion is flaky, confirm `/og?img=1000&imgtype=art` visibly renders the artwork (the card PNG should be materially larger); only relax to `>=` if a real rendering issue is ruled out.

- [ ] **Step 6: Commit.**
```bash
git add app/og/route.ts app/og/BomOgCard.tsx test/routes/og.test.ts
git commit -m "$(printf 'feat(next): og route renders whitelisted thumbnails, preflighted + crash-safe\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Wire `img`/`imgtype` through `buildMetadata` and the pages

**Files:** Modify `lib/seo.ts`, `app/art/[id]/page.tsx`, `app/people/[slug]/page.tsx`, `app/place/PlaceView.tsx`; Test `test/routes/og.test.ts`.

- [ ] **Step 1: Write the failing tests.** APPEND to `test/routes/og.test.ts` (add `import { getMeta } from '../helpers/meta'` at the top if absent):
```ts
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
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/og.test.ts -g "pages request their thumbnail"`
Expected: FAIL — og:image URLs have no `img=` param yet.

- [ ] **Step 3: Add `ogImg`/`ogImgType` to `SeoInput` + og params.** In `lib/seo.ts`:
- In the `SeoInput` interface, add (after `ogSub?: string`):
```ts
  /** Thumbnail id/slug for the og:image card (art id, or people/place slug). */
  ogImg?: string
  /** Which media type ogImg addresses (drives the /og imgtype param). */
  ogImgType?: 'art' | 'people' | 'places'
```
- In `buildMetadata`, add `ogImg, ogImgType` to the destructure:
```ts
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub, ogImg, ogImgType } = input
```
- After the existing `if (lang !== 'en') ogParams.set('lang', lang)` line (and before `const ogImage = …`), add:
```ts
  if (ogImg) {
    ogParams.set('img', ogImg)
    if (ogImgType) ogParams.set('imgtype', ogImgType)
  }
```

- [ ] **Step 4: Pass the identity from each page.**
- `app/art/[id]/page.tsx` `generateMetadata` `buildMetadata({...})` — add `ogImg: id, ogImgType: 'art',` (the `id` is already destructured from params).
- `app/people/[slug]/page.tsx` `generateMetadata` `buildMetadata({...})` — add `ogImg: slug, ogImgType: 'people',` (the `slug` is already in scope).
- `app/place/PlaceView.tsx` `placeMetadata(slug, base)` `buildMetadata({...})` — add `ogImg: slug, ogImgType: 'places',` (the `slug` param covers both `/place/:slug` and `/places/:slug`; the portrait path is `places` for both).

- [ ] **Step 5: Run — passes.**
Run: `npx playwright test test/routes/og.test.ts -g "pages request their thumbnail"`
Expected: PASS (4 tests) — art/people/place og:image carry `img=`+`imgtype=`; `/contents` has none.

- [ ] **Step 6: Typecheck + commit.**
Run: `npx tsc --noEmit` (expect clean).
```bash
git add lib/seo.ts app/art/\[id\]/page.tsx app/people/\[slug\]/page.tsx app/place/PlaceView.tsx test/routes/og.test.ts
git commit -m "$(printf 'feat(next): art/people/place pages request their og thumbnail\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check.**
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: OG + full SSR suite.**
Run: `npx playwright test`
Expected: all pass (og thumbnails + the whole existing suite, incl. korean). No regressions.

- [ ] **Step 3: Live end-to-end spot-check (with a dev server up).**
Run:
```bash
# art page's og:image resolves to a real image; people/place too
for p in "art/1000" "people/nephi1" "place/jerusalem-1"; do
  OG=$(curl -s -A Googlebot "http://localhost:3001/$p" | grep -oiE 'property="og:image" content="[^"]*"' | sed -E 's/.*content="([^"]*)".*/\1/;s/&amp;/\&/g')
  echo "$p → $OG"
  # the /og route returns a 200 png (renders the thumbnail via preflight)
  curl -s -o /dev/null -w "   /og → %{http_code} %{content_type}\n" "http://localhost:3001${OG#http*//localhost:3001}"
done
```
Expected: each og:image URL contains `img=…&imgtype=…`; fetching the `/og?…` URL returns `200 image/png`.

- [ ] **Step 4: Confirm graceful fallback for a portrait-less entity.**
Run: `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:3001/og?title=X&img=moroni&imgtype=people"`
Expected: `200 image/png` (text card — `moroni` has no portrait; must not 500/drop).

---

## Self-Review

**Spec coverage:**
- Fix art media path (`/art/{id}`) + imgtype whitelist (art/people/places) + sanitize `img` + preflight-HEAD fallback → Task 1. ✓
- `BomOgCard` width/height crash backstop → Task 1 Step 4. ✓
- `buildMetadata` `ogImg`/`ogImgType` → og params → Task 2 Step 3. ✓
- Art/people/place pass their identity (slug-derived, no data change) → Task 2 Step 4. ✓
- Tests: metadata carries `img`+`imgtype` (art/people/place) and not on text pages; `/og` valid→200png, missing→200png fallback, traversal→200png; live media resolves → Tasks 1–3. ✓
- Korean composition (portrait + `lang=ko`): the lang param is already appended before `img` in `buildMetadata`, and a Korean art page's og:image will carry both — covered by the existing korean og test + the new art test; no separate task needed. ✓
- Accepted deviation (small-portrait blur) → no code; documented. ✓

**Placeholder scan:** No TBD/TODO; full code in every step; commands have expected output. The byte-size assertion has an explicit relax-only-if-justified note (not a placeholder).

**Type/name consistency:** `ogImg`/`ogImgType: 'art'|'people'|'places'` defined in Task 2 Step 3, used identically in Task 2 Step 4. `imgtype` param values (`art`/`people`/`places`) match `MEDIA_PATH` keys (Task 1) and `ogImgType` (Task 2). `img` param name consistent across route + buildMetadata + tests.
