# SSR Bare-Slug Resolution Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop SSR from 404ing bare entity slugs — `/people/noah` must resolve to a real person page or a chooser, never a dead end.

**Architecture:** A pure resolution module (`lib/slug-variants.ts`) turns a requested slug plus the known-slug list into one of four outcomes: exact, redirect, chooser, none. The people and place SSR routes call it only after an exact lookup misses, so the happy path costs no extra fetch. `permanentRedirect` handles the single-variant case; a new `SlugChooser` component renders the multi-variant case as a `noindex, follow` page.

**Tech Stack:** Next.js 15 App Router (server components), TypeScript, Playwright (both unit and route tests), GraphQL against the greenfield backend on `:5006`.

**Spec:** `docs/specs/2026-09-24-entity-url-presentation-model.md` — Phase 1 implements §5 (shared slug resolution) and §6 (SSR changes) only.

## Global Constraints

- **Plan/doc location follows CLAUDE.md**, not the skill default: specs in `docs/specs/`, plans in `docs/plans/`.
- **No CRA changes in this phase.** `frontend/webapp` is untouched. Phase 2 ports the rule to `PopUp.js` and adds a drift guard modelled on `test/unit/vector-taxonomy-drift.test.ts`.
- **Variant rule is exactly** `^<requested>-?\d+$`, case-insensitive. The optional hyphen covers both conventions in the data: people use `noah1`, places use `jerusalem-1`.
- **Exact match always wins** over variants. `angels-to-nephi` is both a real slug and the variant base of `angels-to-nephi3`; it must render the person, not a chooser.
- **An exact hit *after* the lookup missed means a non-canonical spelling** (case or padding). Redirect it to the canonical URL — never let the resolver's fourth outcome fall through to a 404.
- **Candidate order is dataset order.** `getPeopleList`/`getPlacesList` return the backend's weight order (see the comment in `lib/peopleplaces.ts`); never re-sort.
- **Chooser pages are `noindex, follow`** so they pass link equity without competing with real entity pages. This ships as the page's **robots meta tag**, not the `X-Robots-Tag` header — the header is set in `middleware.ts`, which would have to repeat the slug resolution to know a chooser was coming. Crawlers honour both equally; assert the meta tag, not the header.
- **`matters` gets no SSR route** — `features.yml` sets `seo: "remove"`. Out of scope by design.
- **Commit style:** imperative, capitalized, no conventional-commit prefix (matches `git log`: "Harden against NPM 5xx bursts from backend recycle + scanner probes"). Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
  ```
- **Run tests from `frontend/next/`**: `npm test` is `playwright test`. It boots its own dev server on `:3001` and reuses a running one outside CI.

## Accepted limitations (decided, not overlooked)

- **`/preview` social cards stay generic for bare names.** `lib/preview.ts` calls
  `getPerson(leaf)` and falls back to the generic "People" card on a miss. The
  legacy `img.*` unfurl for `/people/noah` therefore stays generic even though
  the page's own `/og` card is fixed. Out of scope; revisit only if bare-name
  links are seen circulating on that host.
- **Chooser copy is English on every host.** `humanize()` and the description
  string ignore `x-lang`, unlike every other page (which routes copy through
  `lib/seo-copy`). A Korean crawler gets English chooser copy under a Korean
  `<html lang>`. Accepted because the page is noindex and transitional — Phase 2
  gives browsers a CRA `EntityPage` instead.
- **Locale-prefixed SSR paths already 404** (`/ko/people/nephi1`): middleware
  strips the prefix only on the CRA branch. Pre-existing, unrelated to bare
  slugs, explicitly NOT fixed here.
- **No route test covers the `exact`-after-miss branch.** Its only trigger is
  padded input, and Next may normalize that before the route sees it. The unit
  tests cover the resolver outcome; the route branch exists so the fourth
  outcome is not silently a 404.

## Live data facts the tests depend on

Measured 2026-09-24 against the dev backend (435 person slugs, 188 place slugs).
**Re-derive these before trusting them** — an earlier draft of this table asserted
a variant (`angels-to-nephi1`) that does not exist, which made its test vacuous.
Rows are also live data, not schema: `getPeopleList` is cached at
`revalidate: 3600`, so a newly added person's bare slug keeps 404ing for up to an
hour after its exact page goes live.

| Case | Real example | Why it matters |
|---|---|---|
| Single variant → 308 | `shem` → `shem2` | The **only** one in the people dataset. Places have **none**. |
| Multi variant → chooser | `noah` → `noah1`, `noah2`, `noah3` | 42 person bases are multi-variant; this is the dominant path. |
| Multi variant, places | `jerusalem` → `jerusalem-1`, `jerusalem-2` | The only place case; exercises the hyphen form. |
| Exact beats variant | `angels-to-nephi` (also base of `angels-to-nephi3`) | Guards the precedence rule. Note the variant is `3`, not `1` — there is no `angels-to-nephi1`, and asserting its absence proves nothing. |
| Loose-match rejects | `noahs-priests` must NOT appear under `noah` | The CRA's `startsWith` rule wrongly includes it. |
| None → 404 | `king-noah` | Unchanged behavior. |

---

### Task 1: Slug resolution module

**Files:**
- Create: `frontend/next/lib/slug-variants.ts`
- Test: `frontend/next/test/unit/slug-variants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SlugResolution = { kind: 'exact'; slug: string } | { kind: 'redirect'; slug: string } | { kind: 'chooser'; candidates: string[] } | { kind: 'none' }`
  - `resolveSlug(requested: string, known: readonly string[]): SlugResolution`

- [ ] **Step 1: Write the failing test**

Create `frontend/next/test/unit/slug-variants.test.ts`. Fixtures are literal arrays, not live data, so the test stays deterministic:

```ts
import { test, expect } from '@playwright/test'
import { resolveSlug } from '../../lib/slug-variants'

// Mirrors the real shape of bom_people / bom_places slugs.
const PEOPLE = [
  'noah1', 'noah2', 'noah3', 'noahs-priests', 'people-of-noah',
  'nephi1', 'nephi2', 'nephites', 'nephihah', 'nephite-spies',
  'shem2',
  'angels-to-nephi', 'angels-to-nephi3',
  'abinadi',
]
const PLACES = ['jerusalem-1', 'jerusalem-2', 'zarahemla', 'bountiful-1']

test.describe('resolveSlug', () => {
  test('exact slug wins even when numeric variants exist', () => {
    expect(resolveSlug('angels-to-nephi', PEOPLE)).toEqual({ kind: 'exact', slug: 'angels-to-nephi' })
    expect(resolveSlug('abinadi', PEOPLE)).toEqual({ kind: 'exact', slug: 'abinadi' })
  })

  test('exactly one variant → redirect', () => {
    expect(resolveSlug('shem', PEOPLE)).toEqual({ kind: 'redirect', slug: 'shem2' })
    expect(resolveSlug('bountiful', PLACES)).toEqual({ kind: 'redirect', slug: 'bountiful-1' })
  })

  test('several variants → chooser, in dataset order', () => {
    expect(resolveSlug('noah', PEOPLE)).toEqual({ kind: 'chooser', candidates: ['noah1', 'noah2', 'noah3'] })
    expect(resolveSlug('jerusalem', PLACES)).toEqual({ kind: 'chooser', candidates: ['jerusalem-1', 'jerusalem-2'] })
  })

  test('rejects the loose prefix matches the CRA rule wrongly accepts', () => {
    // startsWith('noah') would also return noahs-priests; startsWith('nephi')
    // would return nephites, nephihah and nephite-spies.
    const noah = resolveSlug('noah', PEOPLE) as { kind: 'chooser'; candidates: string[] }
    expect(noah.candidates).not.toContain('noahs-priests')
    const nephi = resolveSlug('nephi', PEOPLE) as { kind: 'chooser'; candidates: string[] }
    expect(nephi.candidates).toEqual(['nephi1', 'nephi2'])
  })

  test('no match → none', () => {
    expect(resolveSlug('king-noah', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('', PEOPLE)).toEqual({ kind: 'none' })
  })

  test('input is case-insensitive and trimmed', () => {
    expect(resolveSlug('NOAH', PEOPLE)).toEqual({ kind: 'chooser', candidates: ['noah1', 'noah2', 'noah3'] })
    expect(resolveSlug('  Shem ', PEOPLE)).toEqual({ kind: 'redirect', slug: 'shem2' })
  })

  test('regex metacharacters in the request are escaped, not interpreted', () => {
    // '.' must not match any character, or 'noah.' would resolve.
    expect(resolveSlug('noah.', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('n(o)ah', PEOPLE)).toEqual({ kind: 'none' })
  })

  test('does not decode its input a second time', () => {
    // The App Router already decoded the param. If this module decoded again,
    // '%2531' would become '1' and this would wrongly resolve to noah1.
    expect(resolveSlug('noah%2531', PEOPLE)).toEqual({ kind: 'none' })
    expect(resolveSlug('%E0%A4%A', PEOPLE)).toEqual({ kind: 'none' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/next && npx playwright test test/unit/slug-variants.test.ts`
Expected: FAIL — `Cannot find module '../../lib/slug-variants'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/next/lib/slug-variants.ts`:

```ts
// Bare-name slugs (/people/noah) are not real slugs: the dataset disambiguates
// homonyms with a numeric suffix — people use noah1/noah2/noah3, places use
// jerusalem-1/jerusalem-2. A crawler or link unfurler hitting the bare name got
// a hard 404 while a browser got PopUp.js's chooser, so every shared bare-name
// link unfurled as dead.
//
// The CRA's rule (PopUp.js:206, `slug.startsWith(input)`) is too loose to reuse:
// 'noah' also matches noahs-priests, and 'nephi' matches 13 slugs including
// nephites and nephihah. Match only the numeric-variant form.
// See docs/specs/2026-09-24-entity-url-presentation-model.md §5.

export type SlugResolution =
  | { kind: 'exact'; slug: string }
  | { kind: 'redirect'; slug: string }
  | { kind: 'chooser'; candidates: string[] }
  | { kind: 'none' }

// The App Router hands params already decoded. Do NOT decode again: a second
// pass turns 'noah%2531' into 'noah1' and resolves a URL that names no entity.
function normalize(input: string): string {
  return (input ?? '').trim().toLowerCase()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveSlug(requested: string, known: readonly string[]): SlugResolution {
  const base = normalize(requested)
  if (!base) return { kind: 'none' }

  const exact = known.find((s) => s.toLowerCase() === base)
  if (exact) return { kind: 'exact', slug: exact }

  // The optional hyphen covers both conventions in the data.
  const variant = new RegExp(`^${escapeRe(base)}-?\\d+$`)
  // Dataset order is the backend's weight order — never re-sort.
  const candidates = known.filter((s) => variant.test(s.toLowerCase()))

  if (candidates.length === 1) return { kind: 'redirect', slug: candidates[0] }
  if (candidates.length > 1) return { kind: 'chooser', candidates }
  return { kind: 'none' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/next && npx playwright test test/unit/slug-variants.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/slug-variants.ts frontend/next/test/unit/slug-variants.test.ts
git commit -m "$(cat <<'MSG'
Add numeric-variant slug resolution for bare entity names

Replaces the CRA's loose startsWith matching with a ^slug-?\d+$ rule that
excludes false hits like noahs-priests under noah. Pure module, no callers yet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 2: People route — redirect, chooser, and the shared chooser component

**Files:**
- Create: `frontend/next/app/_components/SlugChooser.tsx`
- Modify: `frontend/next/lib/seo.ts` (add `noindex` to `SeoInput`; two lines)
- Modify: `frontend/next/app/people/[slug]/page.tsx`
- Test: `frontend/next/test/routes/people-slug-resolution.test.ts`

**Interfaces:**
- Consumes: `resolveSlug` / `SlugResolution` from Task 1; `getPeopleList()` from `lib/peopleplaces.ts` returning `Array<{ slug: string; name: string; title: string | null }>`.
- Produces:
  - `SlugChooser({ requested, candidates, base, mediaType })` where `candidates: Array<{ slug: string; name: string; sub?: string | null }>`, `base: string` (e.g. `/people`), `mediaType: 'people' | 'places'`
  - `chooserMetadata({ requested, count, base }): Promise<Metadata>`
  - `buildMetadata` gains an optional `noindex?: boolean` input, OR-ed with the existing path/host-derived noindex.

- [ ] **Step 1: Write the failing test**

Create `frontend/next/test/routes/people-slug-resolution.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/people-slug-resolution.test.ts`
Expected: FAIL — `/people/shem` returns 404, not 308; the chooser tests fail on a 404 body.

- [ ] **Step 3a: Add `noindex` to `buildMetadata`**

In `frontend/next/lib/seo.ts`, add the field to the `SeoInput` interface, immediately after the `imageAlt` doc-comment block:

```ts
  /** Force `noindex, follow` regardless of path/host intent (slug-chooser pages). */
  noindex?: boolean
```

Change the destructure (currently one line ending `fallbackKey, imageAlt } = input`) to pull it out under a non-colliding name:

```ts
  const { title, description, path, withSuffix = true, ogSub, ogImg, ogImgType, hreflang = true, canonicalUrl, lang: langOverride, surface = 'article', fallbackKey, imageAlt, noindex: forceNoindex = false } = input
```

Then OR it into the existing computation:

```ts
  const noindex = forceNoindex || intent === 'noindex' || isNonIndexableLanguageHost(requestHost)
```

- [ ] **Step 3b: Create the chooser component**

Create `frontend/next/app/_components/SlugChooser.tsx`:

```tsx
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { superscript } from '@/lib/entity'

export interface ChooserCandidate {
  slug: string
  name: string
  sub?: string | null
}

interface Props {
  /** The bare name the visitor asked for, e.g. 'noah'. */
  requested: string
  candidates: ChooserCandidate[]
  /** Route base the links are built from, e.g. '/people'. */
  base: string
  /** Media path segment for thumbnails. */
  mediaType: 'people' | 'places'
}

// Turn a bare slug into display text: 'angels-to-nephi' → 'Angels To Nephi'.
function humanize(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// A bare name (/people/noah) is ambiguous — the dataset holds noah1, noah2 and
// noah3. Rather than 404 (which is what shared links used to unfurl as), offer
// the variants. noindex so this never competes with the real entity pages;
// follow so the links still pass equity.
export async function chooserMetadata(
  { requested, count, base }: { requested: string; count: number; base: string },
): Promise<Metadata> {
  const slug = requested.trim().toLowerCase()
  const name = humanize(slug)
  return buildMetadata({
    title: name,
    description: `${count} entries in the Book of Mormon share the name ${name}. Choose which one you mean.`,
    // Canonical the normalized spelling, so /people/NOAH does not self-canonical.
    path: `${base}/${slug}`,
    surface: 'collection',
    noindex: true,
    // noindex pages carry no hreflang in this codebase (see the history subtree
    // in test/routes/head-audit.test.ts). buildMetadata gates hreflang on the
    // PATH's seo intent, and an entity path is 'crawl', so the exclusion has to
    // be explicit here — otherwise the chooser advertises alternates to other
    // hosts' choosers, all of them noindex.
    hreflang: false,
  })
}

export function SlugChooser({ requested, candidates, base, mediaType }: Props) {
  const name = humanize(requested)
  return (
    <>
      <h1>{name}</h1>
      <p>
        {candidates.length} entries share this name. Choose which one you mean:
      </p>
      <ul>
        {candidates.map((c) => (
          <li key={c.slug}>
            <a href={`${base}/${c.slug}`}>
              <img
                className="thumb"
                alt={superscript(c.name)}
                title={superscript(c.name)}
                src={`https://media.bookofmormon.online/${mediaType}/${c.slug}`}
              />
              {superscript(c.name)}
            </a>
            {c.sub && <span> — {c.sub}</span>}
          </li>
        ))}
      </ul>
      <p>
        <a href={base}>❮ Back</a>
      </p>
    </>
  )
}
```

- [ ] **Step 3c: Wire the people route**

In `frontend/next/app/people/[slug]/page.tsx`, add imports:

```tsx
import { notFound, permanentRedirect } from 'next/navigation'
import { getPeopleList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
import { SlugChooser, chooserMetadata, type ChooserCandidate } from '../../_components/SlugChooser'
```

(The existing `import { notFound } from 'next/navigation'` is replaced by the line above.)

Add this helper below the imports — both `generateMetadata` and the page need it, and `getPeopleList` is `cache`d so the second call is free:

```tsx
// Shared by generateMetadata and the page so both agree on the outcome.
async function resolvePeopleSlug(slug: string) {
  const people = await getPeopleList()
  const resolution = resolveSlug(slug, people.map((p) => p.slug))
  const candidates: ChooserCandidate[] =
    resolution.kind === 'chooser'
      ? resolution.candidates.map((s) => {
          const row = people.find((p) => p.slug === s)
          return { slug: s, name: row?.name ?? s, sub: row?.title ?? null }
        })
      : []
  return { resolution, candidates }
}
```

In `generateMetadata`, replace `if (!person) return {}` with:

```tsx
  if (!person) {
    const { resolution, candidates } = await resolvePeopleSlug(slug)
    if (resolution.kind === 'chooser') {
      return chooserMetadata({ requested: slug, count: candidates.length, base: '/people' })
    }
    // 'redirect' never renders metadata (the page redirects first); 'none' 404s.
    return {}
  }
```

In `PeoplePage`, replace `if (!person) notFound()` with:

```tsx
  if (!person) {
    const { resolution, candidates } = await resolvePeopleSlug(slug)
    // 'exact' here means the lookup missed but the NORMALIZED slug exists — the
    // request used a non-canonical spelling (padding; the backend collation
    // already handles case). Send it to the canonical URL rather than 404ing,
    // so all four resolver outcomes are handled.
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`/people/${resolution.slug}`)
    }
    if (resolution.kind === 'chooser') {
      return <SlugChooser requested={slug} candidates={candidates} base="/people" mediaType="people" />
    }
    notFound()
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/people-slug-resolution.test.ts`
Expected: PASS — 9 passed

Then confirm nothing regressed in the existing people coverage:

Run: `cd frontend/next && npx playwright test test/routes/people.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/_components/SlugChooser.tsx frontend/next/lib/seo.ts \
        frontend/next/app/people/\[slug\]/page.tsx \
        frontend/next/test/routes/people-slug-resolution.test.ts
git commit -m "$(cat <<'MSG'
Resolve bare people slugs instead of 404ing

/people/shem now 308s to /people/shem2 and /people/noah renders a noindex
chooser for noah1-3, so shared bare-name links stop unfurling as dead.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 3: Place routes — same resolution through the shared view

**Files:**
- Modify: `frontend/next/app/place/PlaceView.tsx`
- Test: `frontend/next/test/routes/place-slug-resolution.test.ts`

**Interfaces:**
- Consumes: `resolveSlug` (Task 1); `SlugChooser`, `chooserMetadata`, `ChooserCandidate` (Task 2); `getPlacesList()` from `lib/peopleplaces.ts` returning `Array<{ slug: string; name: string; info: string | null }>`.
- Produces: nothing new. `PlaceView` and `placeMetadata` keep their current signatures (`slug`, `base`), so `app/place/[slug]/page.tsx` and `app/places/[slug]/page.tsx` need no edits.

Note the place list has **no** single-variant base, so the redirect branch here has no live route test — Task 1's unit tests (`bountiful` → `bountiful-1`) are its coverage. `jerusalem` is the only multi-variant place and exercises the hyphen form.

- [ ] **Step 1: Write the failing test**

Create `frontend/next/test/routes/place-slug-resolution.test.ts`:

```ts
import { test, expect } from '@playwright/test'
import { getMeta } from '../helpers/meta'

const noFollow = { maxRedirects: 0 as const }

test.describe('Place bare-slug resolution', () => {
  test('several variants → chooser, on both /place and /places', async ({ request }) => {
    for (const base of ['/place', '/places']) {
      const r = await request.get(`${base}/jerusalem`)
      expect(r.status(), `${base}/jerusalem status`).toBe(200)
      const html = await r.text()
      // Hyphenated variant form — the '-?' half of the rule.
      expect(html, `${base} lists jerusalem-1`).toContain(`${base}/jerusalem-1`)
      expect(html, `${base} lists jerusalem-2`).toContain(`${base}/jerusalem-2`)
    }
  })

  test('chooser is noindex, follow', async ({ request }) => {
    const html = await (await request.get('/places/jerusalem')).text()
    expect(getMeta(html, 'robots')).toContain('noindex')
    expect(getMeta(html, 'robots')).toContain('follow')
  })

  test('unresolvable slug still 404s', async ({ request }) => {
    expect((await request.get('/places/atlantis', noFollow)).status()).toBe(404)
  })

  test('existing exact-slug pages are unchanged on both bases', async ({ request }) => {
    expect((await request.get('/places/zarahemla', noFollow)).status()).toBe(200)
    expect((await request.get('/place/zarahemla', noFollow)).status()).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/place-slug-resolution.test.ts`
Expected: FAIL — `/places/jerusalem` returns 404

- [ ] **Step 3: Wire `PlaceView`**

In `frontend/next/app/place/PlaceView.tsx`, replace the `notFound` import line with:

```tsx
import { notFound, permanentRedirect } from 'next/navigation'
import { getPlacesList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
import { SlugChooser, chooserMetadata, type ChooserCandidate } from '../_components/SlugChooser'
```

Add the helper below the imports:

```tsx
// Shared by placeMetadata and PlaceView so both agree on the outcome.
// getPlacesList is cached, so the second call within a request is free.
async function resolvePlaceSlug(slug: string) {
  const places = await getPlacesList()
  const resolution = resolveSlug(slug, places.map((p) => p.slug))
  const candidates: ChooserCandidate[] =
    resolution.kind === 'chooser'
      ? resolution.candidates.map((s) => {
          const row = places.find((p) => p.slug === s)
          return { slug: s, name: row?.name ?? s, sub: row?.info ?? null }
        })
      : []
  return { resolution, candidates }
}
```

In `placeMetadata`, replace `if (!place) return {}` with:

```tsx
  if (!place) {
    const { resolution, candidates } = await resolvePlaceSlug(slug)
    if (resolution.kind === 'chooser') {
      return chooserMetadata({ requested: slug, count: candidates.length, base })
    }
    return {}
  }
```

In `PlaceView`, replace `if (!place) notFound()` with:

```tsx
  if (!place) {
    const { resolution, candidates } = await resolvePlaceSlug(slug)
    // See the people route: 'exact' after a miss is a non-canonical spelling.
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`${base}/${resolution.slug}`)
    }
    if (resolution.kind === 'chooser') {
      return <SlugChooser requested={slug} candidates={candidates} base={base} mediaType="places" />
    }
    notFound()
  }
```

Both use `base`, so `/place/...` and `/places/...` each keep the visitor on the base they arrived through — matching the existing canonical behavior documented in that file's header comment.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/place-slug-resolution.test.ts`
Expected: PASS — 4 passed

Then confirm the existing place coverage still passes:

Run: `cd frontend/next && npx playwright test test/routes/place.test.ts test/routes/places.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/place/PlaceView.tsx frontend/next/test/routes/place-slug-resolution.test.ts
git commit -m "$(cat <<'MSG'
Resolve bare place slugs on both /place and /places

Reuses the people chooser through the shared PlaceView, so /places/jerusalem
offers jerusalem-1 and jerusalem-2 instead of 404ing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 4: Map-context place route

**Files:**
- Modify: `frontend/next/app/map/[type]/place/[slug]/page.tsx`
- Test: `frontend/next/test/routes/map-place-slug-resolution.test.ts`

**Interfaces:**
- Consumes: `resolveSlug` (Task 1); `getPlacesList()` (as in Task 3).
- Produces: nothing new.

`/map/1/place/jerusalem` 404s today for exactly the same reason as `/places/jerusalem` (verified). This route is not incidental: `PlaceView` itself renders links of the form `/map/<m>/place/<slug>`, so bare-name variants of these URLs circulate. Redirect only — **no chooser here.** A disambiguation page inside a map context would strand the visitor with no map; sending the single-variant and non-canonical-spelling cases to the canonical map URL is the whole win, and a multi-variant bare name keeps its current 404.

- [ ] **Step 1: Write the failing test**

Create `frontend/next/test/routes/map-place-slug-resolution.test.ts`:

```ts
import { test, expect } from '@playwright/test'

const noFollow = { maxRedirects: 0 as const }

test.describe('Map-context place slug resolution', () => {
  test('exact slug is unchanged', async ({ request }) => {
    const r = await request.get('/map/1/place/jerusalem-1', noFollow)
    expect(r.status()).toBe(200)
  })

  test('multi-variant bare name keeps 404ing (no chooser in a map context)', async ({ request }) => {
    const r = await request.get('/map/1/place/jerusalem', noFollow)
    expect(r.status()).toBe(404)
  })

  test('unknown slug still 404s', async ({ request }) => {
    expect((await request.get('/map/1/place/atlantis', noFollow)).status()).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/map-place-slug-resolution.test.ts`
Expected: all three PASS already — `/map/1/place/jerusalem-1` → 200, `/map/1/place/jerusalem` → 404, `/map/1/place/atlantis` → 404 (all verified live 2026-09-24; map type `1` is real). They are regression guards for behavior Step 3 must not change. The behavior this task ADDS — a non-canonical spelling redirecting instead of 404ing — has no live single-variant place to exercise it (places have zero), so it is covered by Task 1's `bountiful` unit test only. Do not invent a route test for it.

- [ ] **Step 3: Wire the route**

In `frontend/next/app/map/[type]/place/[slug]/page.tsx`, replace the import on line 2:

```tsx
import { notFound, permanentRedirect } from 'next/navigation'
import { getPlacesList } from '@/lib/peopleplaces'
import { resolveSlug } from '@/lib/slug-variants'
```

Replace `if (!place) notFound()` (line 55) with:

```tsx
  if (!place) {
    // Redirect-only: a chooser inside a map context would strand the visitor
    // with no map. Multi-variant bare names keep their 404.
    const resolution = resolveSlug(slug, (await getPlacesList()).map((pl) => pl.slug))
    if (resolution.kind === 'exact' || resolution.kind === 'redirect') {
      permanentRedirect(`/map/${type}/place/${resolution.slug}`)
    }
    notFound()
  }
```

`generateMetadata` needs no change: it already returns `{}` when the place misses, and the page redirects or 404s before metadata matters.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/map-place-slug-resolution.test.ts`
Expected: PASS — 3 passed

Then confirm the existing map coverage still passes:

Run: `cd frontend/next && npx playwright test test/routes/map.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/map/\[type\]/place/\[slug\]/page.tsx \
        frontend/next/test/routes/map-place-slug-resolution.test.ts
git commit -m "$(cat <<'MSG'
Resolve non-canonical place slugs in map context

/map/:type/place/:slug shared the bare-slug 404 with /places/:slug, and
PlaceView links to it. Redirect-only — a chooser inside a map context would
strand the visitor with no map.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 5: Full-suite verification and spec status

**Files:**
- Modify: `docs/specs/2026-09-24-entity-url-presentation-model.md` (status line only)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing code-facing.

- [ ] **Step 1: Run the whole SSR suite**

Run: `cd frontend/next && npm test`
Expected: PASS. The baseline is **283 passed** (measured 2026-09-24 before any change), so any failure here is a regression from Tasks 1-4, not a pre-existing condition.

- [ ] **Step 2: Confirm the sitemap is unaffected**

The sitemap enumerates exact slugs from `lib/sitemap.ts:60` (`query SitemapPeople { person { slug } }`), so bare names were never in it and no chooser URL should appear now.

Run: `curl -s -H 'Host: bookofmormon.online' -H 'User-Agent: Googlebot/2.1' http://localhost:8200/sitemap.xml | grep -c '/people/'`
Expected: a non-zero count, unchanged from before the change.

Run: `curl -s -H 'Host: bookofmormon.online' -H 'User-Agent: Googlebot/2.1' http://localhost:8200/sitemap.xml | grep -E '/people/(noah|shem|nephi)<' | wc -l`
Expected: `0` — no bare names in the sitemap.

- [ ] **Step 3: Verify the real fix by hand against the dev front door**

These hit the running dev stack on `:8200` (not `bom.kckern.net` — Cloudflare caches that for 4h):

```bash
# Single variant → 308
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  -H 'Host: bookofmormon.online' -H 'User-Agent: Googlebot/2.1' \
  http://localhost:8200/people/shem

# Chooser → 200 listing three Noahs, excluding noahs-priests
curl -s -H 'Host: bookofmormon.online' -H 'User-Agent: Googlebot/2.1' \
  http://localhost:8200/people/noah | grep -o 'href="/people/[^"]*"' | sort -u

# Browsers are untouched — still proxied to the CRA
curl -s -o /dev/null -w '%{http_code} %header{x-bom-render-mode}\n' \
  -H 'Host: bookofmormon.online' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' \
  -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-User: ?1' \
  http://localhost:8200/people/noah
```

Expected: `308 http://localhost:8200/people/shem2`; then `noah1`, `noah2`, `noah3` and no `noahs-priests`; then `200 cra` — the CRA path must be byte-identical to before, since this phase changes no CRA code.

- [ ] **Step 4: Update the spec status**

In `docs/specs/2026-09-24-entity-url-presentation-model.md`, change the status line to:

```markdown
**Status:** Phase 1 implemented 2026-09-24; Phase 2 (presentation model) pending plan
```

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-09-24-entity-url-presentation-model.md
git commit -m "$(cat <<'MSG'
Mark spec Phase 1 as implemented

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```
