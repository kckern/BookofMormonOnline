# SSR cutover-readiness: flag-driven crawl gating + host-aware canonical

**Date:** 2026-08-27
**Status:** Design (brainstormed + twice Fable-reviewed with KC), pending implementation plan
**Layer:** `frontend/next/` (the crawler-facing SSR app)
**Related:** architecture [`../reference/ssr.md`](../reference/ssr.md); gap audit
[`../audits/2026-08-27-ssr-cutover-seo-gaps.md`](../audits/2026-08-27-ssr-cutover-seo-gaps.md);
CRA flags [`2026-08-27-cutover-nav-gating.md`](./2026-08-27-cutover-nav-gating.md).

## Problem & principle

Humans and crawlers are served by two renderers (`middleware.ts` UA-split: bots →
Next SSR, humans → CRA). The CRA `HIDE_*` cutover flags run **only on the human path**,
so the crawl surface (SSR route status, `/sitemap.xml`, SSR links) ignores them. Result:
features "hidden" from users stay fully indexable, and — since routes stay live — a
searcher lands directly on the hidden feature.

**Invariant (flag parity):** a feature's visibility decision must hold in BOTH renderers.
The SSR layer must read the same flag config and let each feature's **SEO intent** drive
its route **HTTP status / robots meta**, its **sitemap** inclusion, and its **internal
SSR links**.

## Decisions (brainstorming + two Fable reviews)

- **Scope:** Workstream **A** (flag → SSR gating) + **C1** (host-aware canonical). **B**
  (History SSR ↔ redesign parity) is **deferred**. hreflang / per-language sitemaps /
  full localization are a separate finding (§ below).
- **Per-feature SEO intent:** Home = `remove`, Matters = `remove`, History = `noindex`.
- **History `/history/{slug}`:** serve **200 + noindex** (not a 301); the 301 is deferred-B.
- **Config source:** `features.yml` (CRA) stays the single source; a Next **prebuild
  script** parses it and writes `frontend/next/config/features.generated.json`, which
  `lib/features.ts` imports. No cross-app code imports, no runtime cross-dir read.
- **Enforcement split:** `remove` → `notFound()` in the route (flag-driven, narrow — not a
  blanket soft-404 change); `noindex` → `robots` **meta** via `app/history/layout.tsx`
  **plus** `X-Robots-Tag` from **middleware** (App Router layouts cannot set response
  headers).
- **C1 accepted cost:** `buildMetadata` becomes **async** and reads the request Host;
  four **static `metadata` exports** convert to `generateMetadata`, with a call-site
  ripple (~20 sites) adding `await`. Affected routes become dynamically rendered.

### SEO-intent model

| Intent | SSR route | robots | Sitemap | Applies to |
|---|---|---|---|---|
| `crawl` (default) | 200, self-canonical | index | included | all un-gated content |
| `noindex` | 200 | `noindex, follow` — meta (layout) **and** `X-Robots-Tag` (middleware) | excluded | History |
| `remove` | **404** (`notFound()`) | n/a (404) | excluded | Home, Matters |

Default when a feature is absent/`seo` unset: **`crawl`**. `404` (not `410`) for `remove`:
Home/Matters have no SSR routes and no index equity to expire.

> **SSR applies intent in ALL environments** — unlike the CRA's `HIDE_*`, which are
> `IS_PROD &&`-gated (prod-build-only). The SSR reads `seo`/`paths` directly with no
> `NODE_ENV` guard, so `curl -A Googlebot :8200/matters → 404` holds on dev too. Do **not**
> add a prod-only gate to the SSR path — it would break the dev verification plan. (The two
> gates differ deliberately: the CRA hides human nav only in prod builds; the SSR must
> reflect crawl intent wherever it serves bots.)

## Config model

`frontend/webapp/config/features.yml` (extended; CRA ignores the new keys):
```yaml
homeNav:      { hidden: true, seo: remove,  paths: [/home] }
mattersNav:   { hidden: true, seo: remove,  paths: [/matters] }
historyNav:   { hidden: true, seo: noindex, paths: [/history] }
passageNotes: { hidden: true }   # reader panel — no SSR/crawl surface; SSR ignores it
```
- `seo`: `crawl` | `noindex` | `remove` (absent ⇒ `crawl`). `paths`: URL prefixes (leading
  `/`; **path-segment** prefix match — `/history` matches `/history` + `/history/x`, not
  `/historyfoo`).
- **CRA safety (verified):** the CRA reads only `features.<flag>.hidden`
  (`frontend/webapp/src/models/featureFlags.js`) and a pre-built `hiddenFlags` map
  (`src/views/_Common/menuFilter.js`) — no key iteration — so `seo`/`paths` are inert.
  `gen-features.js` re-emits the whole YAML; regenerate + commit
  `features.generated.json` in the same change.

## Workstream A — flag → SSR crawl gating

### A1. Intent resolver — `frontend/next/lib/features.ts`
- **Imports** the prebuilt `frontend/next/config/features.generated.json` (JSON import,
  `resolveJsonModule: true` — bundled into the build; no runtime fs read, no runtime
  js-yaml). The js-yaml parse happens only in the prebuild script (A6).
- `seoIntentForPath(pathname): 'crawl' | 'noindex' | 'remove'`:
  1. Normalize: take `nextUrl.pathname` (query-free), strip a trailing slash, and **strip a
     leading locale segment** if it's a known language (so `/ko/history` → `/history`). Use
     `['en', ...LANG_PREFIXES]` — `middleware.ts`'s `LANG_PREFIXES` omits `en`, so include it
     explicitly (mirroring the middleware's own `CRA_LOCALE_SEG`) or `/en/history` slips
     through. Share the language list between `middleware.ts` and `lib/features.ts` (a small
     shared const) rather than duplicating.
  2. Longest **path-segment** prefix match against every feature's `paths`; return that
     feature's `seo`, else `'crawl'`.
- `gatedFeatures()`: parsed list, for the sitemap filter.
- Pure, no Next/React imports; unit-testable. (The `.mjs` sitemap-diff script **cannot**
  import this `.ts` module — it inlines the same tiny matcher against the generated JSON; see
  Verify.)

### A2. `remove` → real 404 (flag-driven, narrow) — `app/[...path]/page.tsx`
- The file has **two** entry points; guard **both** so the status *and* the body are a
  clean 404:
  - `generateMetadata`: if `seoIntentForPath(pathname) === 'remove'` → `notFound()`
    (avoids a wasted `getPageContent('home')` query and a stray `<link rel=canonical
    href="/home">` on the 404 body).
  - `CatchAllPage`: same guard at the top, before the dispatch.
- This 404s `/home`, `/matters` (which fall to the catch-all) **without** touching the
  single-segment `DefaultShell` 200 fallbacks (`/search`, `/user`, `/objects`, bare
  `/place`/`/art`/`/commentary`, bare lang prefixes) — those are owned by no feature →
  `crawl` → untouched. `/matters/{slug}`, `/home/community` already 404.
- Generic: a future `remove` feature with its own route calls the same guard.

### A3. `noindex` → robots meta + header (History)
- **Meta:** `frontend/next/app/history/layout.tsx` exports
  `metadata = { robots: { index: false, follow: true } }` **and** a pass-through default
  component (`export default function HistoryLayout({children}) { return children }` — a
  metadata-only layout file is invalid). Verified: all 200-serving
  history pages live under `app/history/` and none sets its own `robots`, so Next's
  per-key metadata merge inherits the layout's noindex (not clobbered). Redesign section
  paths (`/history/translation`, `/reception`, `/lost-116-pages`) currently 404 — no
  noindex needed there.
- **Header:** in `middleware.ts` **bot branch**, capture the `NextResponse.next(...)`
  return, and if `seoIntentForPath(pathname) === 'noindex'` call
  `res.headers.set('X-Robots-Tag', 'noindex, follow')` before returning it. (Compute intent
  on the locale-stripped path so `/ko/history` is covered.) Humans are rewritten to the CRA
  and never receive it.

### A4. Sitemap filter — `frontend/next/lib/sitemap.ts`
- `getSitemapUrls` omits any URL whose owning feature's intent ≠ `crawl`: drop
  `historyUrls()` + the `/history` static entry (verified the only `/history*` sources).
  `/home`, `/matters` aren't emitted today; the filter guarantees it.

### A5. SSR link chrome — `lib/seo.ts`
- Remove `/history` from `DEFAULT_NAV` (rendered by `DefaultShell`), so indexable shells
  stop linking a noindexed section. Intra-subtree `follow` links from history pages
  (e.g. `[slug]`'s `❮ Back` → `/history`) stay. (Verified DEFAULT_NAV consumers = only
  `DefaultShell.tsx` + `lib/seo.ts`; no test snapshot asserts the link.)

### A6. Prebuild config delivery
- `frontend/next/scripts/gen-features.mjs`: parses `../../webapp/config/features.yml`
  (resolve via `new URL('../../webapp/config/features.yml', import.meta.url)` — a `.mjs`
  ES module has **no `__dirname`**; matches the existing `scripts/*.mjs`) with **`js-yaml`**
  (added as a Next **devDependency**), writes
  `frontend/next/config/features.generated.json` (write-if-changed).
- Wire `predev` + `prebuild` in `frontend/next/package.json` (fires for `npm run dev`
  — used by `bom-nextjs.service` and the Playwright webServer — and `npm run build`).
- Commit the generated JSON **and** add `!frontend/next/config/features.generated.json` to
  `.gitignore` (the root has a global `*.json` ignore, same as the CRA's copy) so a fresh
  clone type-checks before any script runs.

## Workstream C1 — host-aware canonical (async refactor)

Canonical is host-blind today: `lib/seo.ts` sets `alternates.canonical = path` (bare)
against a hardcoded English `metadataBase` (`app/layout.tsx`), so every subdomain emits an
apex canonical.

- **`buildMetadata` becomes `async`** and reads the request Host + scheme via `headers()`,
  using **`x-forwarded-host ?? host`** and **`x-forwarded-proto ?? 'https'`** (traffic
  arrives Cloudflare → Nginx Proxy Manager → :8200; raw `host` may be `localhost:8200`, and
  a hardcoded scheme yields `https://localhost:8200` in local/harness runs). It emits an
  **absolute, host-correct** `canonical` **and** `og:url` per request; do not rely on
  `metadataBase` for these.
- **Convert the four static `metadata` exports to `generateMetadata`** (they call
  `buildMetadata`/`defaultMetadata` at module scope, where async `headers()` would throw):
  `app/page.tsx` (the homepage — highest-traffic bot page), `app/about/page.tsx`,
  `app/studyedition/page.tsx`, `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx`.
- **Call-site ripple — smaller than it looks.** All 21 page `generateMetadata` functions
  are already `async` and **return the helper result directly** (no spreads / property
  access), so once the helpers return `Promise<Metadata>` those sites type-check unchanged
  (Next awaits the returned promise) — no per-site `await` edits needed. The **mandatory**
  edits are the currently-**sync-annotated** helpers and static exports:
  - `lib/seo.ts` — `buildMetadata` and `defaultMetadata` (`: Metadata` → `async …:
    Promise<Metadata>`).
  - `lib/section.ts` `sectionMetadata` (already async — fine) and `app/place/PlaceView.tsx`
    `placeMetadata` (already async — fine); `app/history/_index.tsx` `historyMetadata`
    (**sync `: Metadata` → async**; 3 callers: history `page`/`joseph-smith`/`witnesses`).
  - the four static exports above.
  Every remaining site is a no-op. `next.config.ts` does **not** set
  `typescript.ignoreBuildErrors`, so any missed signature is a hard build error — no path to
  shipping `[object Promise]`. (Note: `lib/history.ts`/`lib/art.ts`/`lib/commentary.ts`
  reference `buildMetadata` in **comments only** — not ripple sites.)
- **Caching:** `headers()` forces **dynamic rendering** on affected routes (accepted;
  GraphQL stays shielded by fetch-level `revalidate`). Because the full-route cache is
  path-keyed, host-dependent values must be computed per request (which dynamic rendering
  ensures) — never leave a host value on a statically cached route.
- **Accepted deviation:** `og:image` (relative `/og?…` resolved via `metadataBase`) and
  `twitter:domain` (`SITE_DOMAIN` in `lib/seo.ts`) stay apex-hosted — cosmetic, not a
  ranking signal. Note in the code, fix later with localization.

## SSR-not-localized (separate finding, not fixed here)
The SSR fetches bare GraphQL (no language) and hardcodes `<html lang="en">`, so bots get
English on every subdomain — a content-equivalence gap vs the localized CRA, and why
hreflang/per-language sitemaps are out of scope (they'd mis-pair identical pages). Its own
workstream: lang-aware data layer + `<html lang>` + hreflang + per-language sitemaps + the
`og:image`/`twitter:domain` host fix + the hardcoded apex host in
`app/robots.txt/route.ts` (`Sitemap:` line) and `lib/sitemap.ts` (`BASE`). Record for a
future spec.

## Workstream B — DEFERRED (History parity)
Only if History is later promoted to `crawl`: SSR routes for the new section paths, a
`/history` SSR hub matching the redesign, un-stub `joseph-smith`/`witnesses`, and the
`/history/{slug}` → `/history/reception/{slug}` 301. Tracked in the audit (I3–I6).

## File structure

**New:** `frontend/next/lib/features.ts`; `frontend/next/app/history/layout.tsx`;
`frontend/next/scripts/gen-features.mjs`; `frontend/next/config/features.generated.json`
(committed); tests under `frontend/next/test/`.

**Modified:** `frontend/webapp/config/features.yml` (+ regenerated CRA
`features.generated.json`); `frontend/next/app/[...path]/page.tsx` (remove guard ×2);
`frontend/next/middleware.ts` (`X-Robots-Tag`); `frontend/next/lib/sitemap.ts` (filter);
`frontend/next/lib/seo.ts` (async `buildMetadata`, host-aware canonical/og:url, drop
`/history` from `DEFAULT_NAV`); the four static-metadata pages + ~20 `generateMetadata`
call sites (`await`); `frontend/next/scripts/sitemap-diff.mjs` (carve-out);
`frontend/next/playwright.config.ts` (bot UA); `frontend/next/package.json` (`predev`/
`prebuild`, `js-yaml` devDep); `.gitignore` (negation).

## Verification

- **Unit:** `seoIntentForPath` (segment-prefix, longest-match, locale-strip, trailing
  slash, `/historyfoo` non-match, default crawl); sitemap excludes History, keeps un-gated;
  `buildMetadata` canonical/og:url host-correct for apex + a lang subdomain, using
  `x-forwarded-host`.
- **Route/integration — MUST pin a crawler UA.** Today `playwright.config.ts` uses
  `devices['Desktop Chrome']`, so requests proxy to the CRA, not the SSR — existing route
  tests validate the wrong renderer and **will newly fail against the real SSR once the UA
  flips; budget a triage pass**. With a `Googlebot` UA:
  - `/matters`, `/home` → **404**; `/matters/{slug}`, `/home/community` → 404.
  - `/history`, `/history/{slug}` → **200** + `<meta name=robots content="noindex, follow">`
    **and** `X-Robots-Tag: noindex, follow`; `/ko/history` → same header (locale-strip).
  - `/search`, `/user`, `/ko` → still **200** (flag-driven A2 regression guard).
  - `/sitemap.xml` → no `/history*`; content/people/places/fax/maps/timeline intact.
  - Canonical on `/` and a lang-subdomain request → absolute, host-correct.
  - No indexable SSR page emits `<a href="/history">`.
- **Parity harnesses:**
  - `sitemap-diff.mjs`: has **no baseline** (live-diffs the PHP box, hard-fails on any
    missing bench URL). It's plain Node and **cannot import the TS resolver** — instead
    `JSON.parse` `config/features.generated.json` and inline the segment-prefix matcher;
    allow intentionally non-`crawl` bench paths (History) to be missing, keep the superset
    policy otherwise.
  - `parity.mjs`: A2 is flag-driven so `/search` etc. stay 200 (no break). A5's
    `DEFAULT_NAV` edit **cannot** fail parity — the nav sits past the 400-char body digest
    window and the digest is informational-only (excluded from failing fields). No change
    needed; do not over-claim.
- **Manual:** `curl -A Googlebot :8200/history` → noindex meta + header;
  `-A Googlebot :8200/matters` → 404; `-A Googlebot :8200/search` → 200; check canonical
  host on a subdomain request.

## Sequencing (for the plan)
1. Config: `features.yml` `seo`/`paths` + CRA regen; `gen-features.mjs` prebuild + gitignore
   negation; `lib/features.ts` + tests.
2. A2 remove guard (×2) + A4 sitemap filter + A5 link removal.
3. A3 History noindex (layout meta + middleware header, locale-aware).
4. C1: async `buildMetadata` + 4 static→`generateMetadata` + call-site ripple + host-aware
   canonical/og:url (`x-forwarded-host`).
5. Verification: bot-UA harness (+ triage pre-existing failures) + `sitemap-diff` carve-out.

## Acceptance criteria
- Bots: `remove` → 404; `noindex` → 200 + noindex (meta + header, incl. `/ko/history`);
  `crawl`/un-gated → unchanged 200 (incl. the `DefaultShell` fallbacks).
- `/sitemap.xml` excludes every non-`crawl` feature; un-gated coverage unchanged.
- No **indexable** SSR page links to a `remove`/`noindex` feature; intra-subtree `follow`
  links from noindexed pages allowed.
- Canonical + `og:url` use the serving host (`x-forwarded-host`), per request, no
  path-cache host bleed. (`og:image`/`twitter:domain` apex — accepted, documented.)
- Single source of truth: SSR intent derives from `features.yml`; no flag state duplicated.
- Harness runs under a crawler UA; `sitemap-diff` passes with the History carve-out.

## Open items
- **De-index speed (rollout tactic, optional):** noindex + immediate sitemap removal slows
  Google's recrawl of the ~1024 History URLs. If speed matters, use a transition window
  (leave History in the sitemap briefly) or Search Console removals. Decide at rollout.
- **Confirm proxy Host forwarding:** verify NPM passes the public subdomain via
  `x-forwarded-host` before relying on it for canonical; add a check to the plan.
