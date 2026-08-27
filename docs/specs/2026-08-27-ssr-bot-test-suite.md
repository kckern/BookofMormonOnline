# Bot-UA SSR test suite

**Date:** 2026-08-27
**Status:** Design (brainstormed + Fable-reviewed, empirically validated), pending plan
**Layer:** `frontend/next/` (Playwright tests)
**Related:** [`../reference/ssr.md`](../reference/ssr.md);
[`2026-08-27-ssr-cutover-readiness.md`](./2026-08-27-ssr-cutover-readiness.md).

## Problem

The Next SSR layer serves crawlers (`middleware.ts` UA-split: bot → SSR, human → rewrite
to CRA on :8201). The existing Playwright route tests assert SSR output (title, og,
canonical, 404s) but run under the config's **Chrome UA** (`devices['Desktop Chrome']`),
so every `request.get()` is proxied to the **CRA**, not the SSR. Measured: **22 tests
fail** at baseline because they receive the CRA shell instead of SSR HTML.

**Goal:** a bot-UA SSR suite with representative coverage that confirms SSR responses
across every route class. Resolving the misconfigured failures is the direct consequence.

## Decisions (brainstorming + review)

- **Approach:** fix the harness UA + correct wrong expectations/URLs + expand coverage.
- **Global bot UA** at the Playwright **project** level (all tests use the `request`
  fixture except `scripture.test.ts:61` which uses `page` — both inherit the project UA).
- **Coverage:** every SSR route class, one representative URL each + edges.
- **Assertion depth:** status + head tags + body sanity (not full content-equivalence —
  that's `parity.mjs`/`body-diff.mjs`' job vs the PHP box).
- **Soft-404:** assert the actual behavior as a **named characterization test** (generic
  unknown single-segment → 200 `DefaultShell`; unknown entity slug → real 404), labeled
  "KNOWN soft-404 — PHP parity" and asserting DefaultShell content, so a future fix knows
  to update it.

## Empirically-verified facts (from the review; do not re-derive)

- UA flip alone: **33 → 48 passing**; **7 still fail** afterward (enumerated below).
- Precedence: `{ ...devices['Desktop Chrome'], userAgent: BOT_UA }` overrides the device
  UA; the `request` fixture inherits `use.userAgent`; `BOT_RE` (`middleware.ts:19`) matches
  Googlebot; `/og` is served UA-agnostic (`middleware.ts:37-38`).
- `<h1>` is emitted by every SSR class (DefaultShell, people, place, history doc,
  SectionView, timeline, contents, fax, about, maps, map-type, studyedition, art,
  commentary) → a universal `getH1` body-sanity check is safe.
- **Working representative URLs (verified live):** `/people/nephi1`, `/place/jerusalem-1`,
  `/jaredites` (page), `/lehites/64` (textblock), `/lehites/lehis-prophetic-call`
  (section), `/fax/original`, `/timeline/lehite-family`, `/map/neareast`,
  `/map/neareast/place/assyria`, `/history/1836-03-oliver-cowdery`,
  `/history/joseph-smith`, `/history/witnesses`, `/art/1000`, `/commentary/1012904101`,
  `/contents`, `/about`, `/studyedition`, `/특별반`, `/maps`, `/places/{slug}`.
- **Harness canonical:** with no forwarded headers, the SSR emits
  `http://localhost:3001{path}` (host `localhost` is allowlisted by `safeHost`; dev injects
  `x-forwarded-proto: http`). `og:image` resolves via `metadataBase` to
  `https://bookofmormon.online/og?…` **even on localhost**.
- `/특별반` canonical is emitted percent-encoded (`/%ED%8A%B9%EB%B3%84%EB%B0%98`).

## The 7 post-flip failures — corrections (no more "enumerate by running")

1. `pages.test.ts:39` "unknown page returns 404" → the generic single-segment
   `/zzz…` is a **200 soft-404**. Rewrite as the named characterization test asserting
   **200 + DefaultShell content**; add a separate case that an unknown **entity** slug
   (`/people/zzz…`, 2-segment) is a real **404**.
2-7. `scripture.test.ts` (6 tests) → they request `/1-nephi/1`, which the SSR **404s**
   (there is no book/chapter route; the catch-all treats it as a textblock and finds
   nothing; `lib/scripture.ts` is dead code). **Retarget the file to `/lehites/64`** (the
   real textblock form, as used by `parity.mjs:21`). This is a representative-URL
   correction, not an expectation change.

## Discovered out-of-scope gap (record, do NOT fix here)
`/{book}/{chapter}` (e.g. `/1-nephi/1`) is **not an SSR route** — the catch-all classifies
it as a textblock and 404s, while the CRA serves it to humans. So the most shareable
scripture URL form returns a **bot 404** today (an SEO gap). `lib/scripture.ts`
(`getReadBlock`, a `read(ref)` query) exists but is wired to no route. This is a separate
issue from the test suite; note it for a future spec, and retarget `scripture.test.ts` to
the working textblock URL rather than papering over the gap.

## Architecture

### Harness change — the linchpin
`playwright.config.ts`: define `BOT_UA` (import from `test/helpers/meta.ts`) and set it on
the `chromium` project's `use` after the spread:
```ts
use: { ...devices['Desktop Chrome'], userAgent: BOT_UA }
```

### Shared helpers — `test/helpers/meta.ts`
Keep `getMeta`, `getTitle`. Add:
- `getCanonical(html): string | null` — `<link rel="canonical" href="…">` value.
- `getRobots(html): string | null` — `<meta name="robots" content="…">` value.
- `getH1(html): string | null` — first `<h1>` text.
- `export const BOT_UA` — the Googlebot UA (also imported by `playwright.config.ts`).

### Coverage — one file per route class under `test/routes/`
Existing (correct after the UA flip; fix the two above): `people`, `place`, `pages`,
`scripture` (retargeted), `sitemap`, `og`, `robots`.

New/extended files:
- `history.test.ts` — `/history` index + `/history/1836-03-oliver-cowdery` (doc) +
  `/history/joseph-smith` + `/history/witnesses`; reaffirm `noindex` (meta + header).
- `fax.test.ts` — `/fax` index + `/fax/original`.
- `map.test.ts` — `/map` index + `/maps` (distinct) + `/map/neareast` +
  `/map/neareast/place/assyria`.
- `timeline.test.ts` — `/timeline` index + `/timeline/lehite-family`.
- `commentary.test.ts` — `/commentary/1012904101` (id from a textblock page; no index).
- `art.test.ts` — `/art/1000` (no index/sitemap; hardcode verified id).
- `contents.test.ts` — `/contents`.
- `about.test.ts` — `/about`.
- `studyedition.test.ts` — `/studyedition` + `/특별반` (same body; own canonical, expect
  the percent-encoded `/%ED%8A%B9%EB%B3%84%EB%B0%98` path).
- `default-shell.test.ts` — `/` (DefaultShell): 200, default title, nav present, canonical.
- Add a **section-kind** case to `pages.test.ts` (or a `section.test.ts`):
  `/lehites/lehis-prophetic-call` (2-segment non-numeric — the bulk of the sitemap,
  currently untested); the file already covers the page kind, and `scripture.test.ts`
  covers textblock.
- Extend `place.test.ts` (or add `places.test.ts`) for `/places/{slug}` (distinct route
  with its own canonical base).

Gating (`/matters`,`/home`→404; `/history*` noindex) stays in `seo-gating.test.ts`.

### Per-route assertions (status + head + body sanity)
- **Status:** 200 for valid; 404 for unknown entity slug where the class has one.
- **Head:**
  - non-empty, relevant `<title>`.
  - **canonical** present, absolute (`/^https?:\/\//`), and **`new URL(canonical).pathname
    === expectedPath`** — environment-agnostic (asserts the path, not the harness host).
    Host-awareness itself is already covered by `seo-gating.test.ts` (ko subdomain + evil
    fallback); do NOT hardcode `https://bookofmormon.online` here.
  - `og:title` + `og:description` non-empty.
  - `og:image` present and absolute; to check it resolves, **strip host and refetch by
    pathname+search** (the existing `people.test.ts` pattern) — because og:image is apex
    (`https://bookofmormon.online/og?…`) even on localhost — then assert `200` +
    `image/png`.
- **Body sanity:** `getH1(html)` truthy (real SSR HTML, not an empty shell).
- **Class edges:** `/history*` → `noindex` meta + `X-Robots-Tag`; unknown-slug per above.

## File structure

**Modified:** `playwright.config.ts` (bot UA); `test/helpers/meta.ts` (getters + `BOT_UA`);
`test/routes/pages.test.ts` (soft-404 characterization + section-kind case);
`test/routes/scripture.test.ts` (retarget to `/lehites/64`); `test/routes/place.test.ts`
(or new `places.test.ts`) for `/places/{slug}`.

**Created:** `test/routes/history.test.ts`, `fax.test.ts`, `map.test.ts`,
`timeline.test.ts`, `commentary.test.ts`, `art.test.ts`, `contents.test.ts`,
`about.test.ts`, `studyedition.test.ts`, `default-shell.test.ts`.

**Not touched:** app/lib runtime code (tests only); `parity.mjs`/`body-diff.mjs`; the
book/chapter SSR gap (recorded above, separate spec).

## Verification
- `cd frontend/next && npx playwright test` → **all** route + unit + gating suites green
  (the 22 baseline failures resolved: 20 via the UA flip, `pages.test.ts:39` via the
  soft-404 characterization, scripture via retargeting). No test depends on the CRA.
- Each new file: status + head (path-correct absolute canonical) + body-sanity pass.
- `seo-gating.test.ts` still green (gating unaffected).
- Perf note: ~10 new files fan out across workers against a cold `next dev`
  (compile-on-first-hit + GraphQL). Baseline bot run was ~26s wall (30s per-test timeout).
  If flaky under load, set `workers: 1` or add a warm-up; be aware CI `retries: 2` can mask
  data flakiness.

## Acceptance criteria
- The Playwright project sends a bot UA by default; the whole suite exercises the SSR.
- Every SSR route class (incl. `/places`, `/maps`, `/history/joseph-smith|witnesses`, the
  catch-all section kind) has coverage: status + head + body sanity for a representative
  URL + class edges.
- All previously-failing tests pass (UA flip + the two corrections).
- No new reliance on the CRA; no app/lib runtime changes; the book/chapter gap is recorded,
  not silently masked.

## Open items
- **Commentary/art id stability:** `/commentary/1012904101` and `/art/1000` are hardcoded
  verified ids (no index/sitemap to derive from). If either proves unstable, derive
  commentary from a textblock page (`/lehites/64` → first `/commentary/…` link); art has no
  index, so it stays hardcoded (or the test is skipped with a note).
