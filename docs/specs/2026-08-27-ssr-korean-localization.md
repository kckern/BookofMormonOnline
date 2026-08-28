# SSR host-based localization (Korean-first)

**Date:** 2026-08-27
**Status:** Design (brainstormed + Fable-reviewed, empirically validated), pending plan
**Layer:** `frontend/next/` (the crawler-facing SSR app)
**Related:** [`../reference/ssr.md`](../reference/ssr.md);
[`2026-08-27-ssr-cutover-readiness.md`](./2026-08-27-ssr-cutover-readiness.md) (§SSR-not-localized).

## Problem

The SSR serves **English on every language domain**: `lib/graphql.ts` POSTs to a bare
`GRAPHQL_URL` (no language), `<html lang="en">` is hardcoded (`app/layout.tsx:14`), and the
chrome constants (`SITE_SUFFIX`, `DEFAULT_TITLE`, `DEFAULT_BODY` in `lib/seo.ts`) are English.
Crawlers on the Korean domain get an English page — a content-equivalence break vs the
localized CRA, and why Korean OG previews render in the wrong font.

**Parity target (live legacy PHP box, verified):** `몰몬경.kr` (`xn--289a67xla.kr`) serves:
home `<title>몰몬경·KR: 몰몬경 학습 자원</title>` + Korean meta description; person page
`<title>니파이¹ • 몰몬경·KR</title>`; self-canonical on the Korean host; a
`naver-site-verification` meta; og:image at the retired GD service (`preview.…/ko/…`).

## Empirically-verified facts (from the review — do not re-derive)

- **GraphQL localization works via the backend catch-all + last-path-segment lang.**
  `POST http://localhost:5006/graphql/ko` → `{"person":[{"name":"니파이1"}]}` (200).
  `resolveLang` (`backend/src/graphql/lang.ts`) takes the **last path segment**, clamped to
  `SUPPORTED_LANGUAGES` (`backend/src/config/env.ts`:
  `en,fr,de,nl,pt,ko,jpn,zh,ru,hi,eo,es,vn,tgl,th,ukr,tam,swe`). Bare `/graphql` → "graphql"
  → clamps to `en` (why it's English today). **Unknown codes clamp to `en` silently — no
  error.** → tests MUST assert localized strings, not just 200.
- **Korean data exists:** person `니파이1`, division `야렛인 시대`, 1118 localized labels.
  **Slug sets are byte-identical en↔ko** (person: 435 rows) → slug-invariance holds.
- **Labels contain** `home_title`=`몰몬경·KR`, `home_heading`=`몰몬경 학습 자원`, and all seven
  `menu_*` nav keys (`목차/연대표/지도/인물/장소/사본/소개`) — queried as `{ labels { key val } }`
  (field is **`val`**, not `value`). Labels do **NOT** contain the default body paragraph.

## Decisions (brainstorming + review)

- **General host→lang resolver** for all localized domains; **verify Korean first**.
- **Correctness facets:** lang-aware content, localized chrome (head + DefaultShell body/nav),
  `<html lang>`, og:image `lang`, self-on-host canonical, `naver-site-verification`.
- **Chrome:** labels-driven where available (title/suffix/nav); a **per-language table** for
  the default body paragraph (not in labels).
- **Deferred:** hreflang, per-language sitemaps, the `og?img=` art-thumbnail wiring.

## Architecture — one language, from the host, threaded everywhere

### 1. Host→lang resolver — `frontend/next/lib/locales.ts` (extend)
Two code spaces (the review's B2): **internal codes** (backend/labels/og) and **BCP47**
(`<html lang>`). Copy hosts + internal codes **verbatim from the CRA** (`Sidebar.js`
LanguageSelect, `frontend/webapp/src/models/BoMOnlineAPI.js`), including every live domain:

| host | internal (gql) | BCP47 (`<html lang>`) | backend-supported? |
|---|---|---|---|
| `bookofmormon.online` (apex) | `en` | `en` | yes |
| `몰몬경.kr` / `xn--289a67xla.kr` | `ko` | `ko` | yes |
| `libromormon.es` | `es` | `es` | yes |
| `livredemormon.fr` | `fr` | `fr` | yes |
| `buchmormon.de` | `de` | `de` | yes |
| `swe.bookofmormon.online` | `swe` | `sv` | yes |
| `sachmacmon.vn` | `vn` | `vi` | yes |
| `xn--80aahtjpadfibw.net` (ru) | `ru` | `ru` | yes |
| `mormonovaknjiga.si` | `slv` | `sl` | **NO → clamps to en** |
| `tr.bookofmormon.online` | `tr` | `tr` | **NO → clamps to en** |
| `tgl.bookofmormon.online` | `tgl` | `tl` | yes |

`langForHost(host) → internalCode` (normalize: lowercase, strip port; default `en`).
`bcp47(internalCode) → tag` (`swe→sv, jpn→ja, vn→vi, tgl→tl`, else identity). The host-key
set is the **canonical-host allowlist** (§7). Verify each host's live lang during planning;
document `slv`/`tr` as pre-existing backend gaps (they serve English until the backend adds
the codes — out of scope).

### 2. Middleware — host-based `x-lang`
Set `x-lang` from the **host** (`x-forwarded-host ?? host` → `langForHost`) instead of the URL
path. Keep the `LANG_PREFIXES` path-strip for the human-branch redirect. Add an
**`x-resolved-lang` response header** (the resolved internal code) as a debug/verification
surface (S6). Nothing consumes `x-lang` today except this middleware, so repurposing it is
safe.

### 3. Lang-aware GraphQL — `lib/graphql.ts`
`gql(query, variables, options)` resolves the internal lang as
**`options.lang ?? (await headers()).get('x-lang') ?? 'en'`** — and when `options.lang` is
provided it MUST short-circuit **before** calling `headers()` (so a pinned caller like the
sitemap does not trip a dynamic API and keeps its ISR — the §8 fix). It POSTs to
`${GRAPHQL_URL}${lang === 'en' ? '' : '/' + lang}`. The lang-specific URL keys the fetch
cache per language. Feasibility (verified): no `generateStaticParams`/`force-static` in
`app/`; every page is already dynamic via `buildMetadata`'s `headers()`; `headers()` inside
React `cache()` is request-scoped and fine.

### 4. Localized chrome — `lib/labels.ts` (new), a body table, `lib/seo.ts`, `DefaultShell`
**Export shape (resolves the review's contradiction):** keep the existing **English sync
constants** `SITE_SUFFIX` / `DEFAULT_TITLE` / `DEFAULT_BODY` exported unchanged (consumed by
`app/layout.tsx`'s static metadata and as the `en` fallback), AND add **async getters** that
the per-request paths use. Do not convert the constants themselves to async.

- `lib/labels.ts`: `getLabels(): Promise<Record<string,string>>` — a `cache()`d
  `{ labels { key val } }` fetch through the lang-aware `gql`; `label(key, fallback)`.
  For `lang === 'en'`, **short-circuit to the sync constants** (en labels are byte-identical —
  verified — so English pages gain no new backend dependency).
- `lib/seo.ts`: add `async getSiteChrome()` → `{ siteSuffix, defaultTitle, defaultBody }`:
  - `siteSuffix` ← label `home_title`; `defaultTitle` ← `home_title + ': ' + home_heading`
    (composes to `몰몬경·KR: 몰몬경 학습 자원`, and to the current English `DEFAULT_TITLE`
    byte-for-byte — verified).
  - `defaultBody` ← a **per-language table** `DEFAULT_BODY_BY_LANG` (not in labels — B1 fix;
    Korean captured from the live box; English = current constant; others → English until
    filled).
  - `buildMetadata`/`defaultMetadata` (already async) call `getSiteChrome()` for the
    suffix/default title/body instead of the sync constants.
- **Per-page index/static titles (the review's #11 parity gap):** the index/static routes
  hardcode English titles in their `generateMetadata` (`app/people/page.tsx:26`,
  `contents`, `about`, `fax`, `timeline`, `places`, …), so a Korean host renders mixed-language
  `People in the Book of Mormon • 몰몬경·KR`. The live box localizes these (`몰몬경에 나오는 인물`,
  `목차`) and the **label keys exist** (`title_people`, `title_places`, `table_of_contents`, …).
  Localize each via `label(<key>, <english fallback>)`; enumerate the full route→key map in
  planning (fallback keeps English if a key is missing).
- `app/_components/DefaultShell.tsx` (becomes async server component; both render sites
  — `app/page.tsx:12`, `app/[...path]/page.tsx:120` — can await it): nav labels via
  `label(menu_*)` **for `lang !== 'en'` only** (en `menu_contents`="Contents" ≠ our
  "Table of Contents"). Match the live box's per-lang nav set — the KR box shows **6** items
  (no `fax`); confirm per lang in planning.
- **Do NOT touch `app/layout.tsx`'s static `metadata` export** (S2) — it keeps importing the
  English sync constants as the inert default (every page emits `title.absolute`); only
  `<html lang>` changes there.

### 5. `<html lang>` — `app/layout.tsx`
`RootLayout` becomes async, reads `x-lang`, and sets `<html lang={bcp47(lang)}>`.

### 6. og:image language + Naver — `lib/seo.ts`
- `buildMetadata` reads `x-lang` and appends `&lang=${lang}` to `/og?…` when `lang !== 'en'`
  → `app/og/route.ts` (`isKorean = lang === 'ko'`) loads the Korean font
  (`public/fonts/IBMPlexSansKR-Regular.ttf`, present) so `BomOgCard` renders `니파이¹`.
- **`superscript()` fix (S1):** **two** ASCII-only regexes need the Unicode class (verified: no
  false positives on years/slugs across the ko corpus): `lib/entity.ts:11`
  `/([A-Za-z])(\d+)/g` → `/(\p{L})(\d+)/gu`, AND `app/people/page.tsx:16`'s local `supTitle`
  `/([A-Za-z])(\s*)(\d+)/g` → `/(\p{L})(\s*)(\d+)/gu` (the people-index disambiguator, e.g.
  `레이맨 여왕2` → `여왕²`).
- **`naver-site-verification` (S5):** emit
  `<meta name="naver-site-verification" content="2e4aebbde9e85f415075e53c9ebcad129e3a83e4">`
  (the live token, verified) **for the Korean host only** (Naver Search Console; the middleware
  already special-cases the Yeti/Naver crawler).

### 7. Self-on-host canonical — `lib/seo.ts safeHost`
Extend `safeHost`'s allowlist to: **any host in the host→lang map** (§1) +
`*.bookofmormon.online` + `localhost`; else apex fallback (keeps the injection guard). Ensure
the match handles the punycode form (`xn--289a67xla.kr`) as it arrives in the Host header. A
Korean page then emits `canonical = https://xn--289a67xla.kr/…`.

### 8. Sitemap — pin English (S3)
`app/sitemap.xml/route.ts` has `revalidate = 3600` (ISR). Because `gql()` now reads
`headers()`, the sitemap would go fully dynamic. Pass `options.lang: 'en'` on **all 8** gql
calls in `lib/sitemap.ts` (lines 43, 45, 63, 67, 74, 87, 102, 124) — or wrap them in a small
`enGql` helper — to keep it English-pinned and preserve ISR. This works only because the
override short-circuits before `headers()` (§3). Slug sets are language-invariant, so the URL
set is unchanged. Per-language sitemaps remain deferred.

## Data flow
```
host ─▶ middleware: x-lang = langForHost(host);  +X-Resolved-Lang header
          │
   ┌──────┼───────────┬──────────────┬───────────────┬──────────────┐
   ▼      ▼           ▼              ▼               ▼              ▼
 gql/{lang}  layout   buildMetadata  labels()+body   safeHost      sitemap
 (content)  <html>   canonical(host) table (chrome+  (self-canon   (pin en →
            lang     +og&lang+naver  nav non-en)     on host)       keep ISR)
```

## Testing & verification
- **Parity anchor:** live `몰몬경.kr` (`xn--289a67xla.kr`) head tags. `scripts/parity.mjs` can
  diff our SSR (Korean host header) against it — but keep assertions targeted (the KR box emits
  no `<html>` tag, so `lang="ko"` is an improvement, not a full-head diff).
- **Playwright (localhost, bot UA):** send `x-forwarded-host: xn--289a67xla.kr` and assert on
  representative routes (`korean.test.ts`):
  - `<html lang="ko">`,
  - a **Korean** `<title>` — `/people/nephi1` contains `니파이` and suffix `몰몬경·KR`
    (assert the Korean *string*, since unknown codes clamp to en silently),
  - self-canonical `https://xn--289a67xla.kr/…`,
  - `og:image` URL contains `lang=ko`,
  - `naver-site-verification` present on the Korean host,
  - **regression:** apex host → English content + apex canonical + no `lang`/naver.
  Requires the local backend to serve Korean at `${base}/ko` (verified for person/division).
- The existing bot-UA suite stays green (`expectSsrPage` canonical pathname compare is
  host-agnostic).

## Scope
**Touched:** `lib/locales.ts` (host→lang + bcp47), `middleware.ts` (host-based x-lang +
x-resolved-lang), `lib/graphql.ts` (lang endpoint + `lang` override), `lib/labels.ts` (new),
`lib/seo.ts` (async chrome from labels + body table, og `lang`, naver, `safeHost`),
`lib/entity.ts` (superscript unicode), `app/layout.tsx` (`<html lang>`),
`app/_components/DefaultShell.tsx` (nav labels non-en), `app/sitemap.xml`/`lib/sitemap.ts`
(pin en), tests.

**NOT in scope (deferred):** hreflang, per-language `/sitemap.xml`, `og?img=` art thumbnail,
and the `slv`/`tr` backend-language gaps (those domains stay English until the backend adds the
codes).

## Acceptance criteria
- A bot request with a Korean host gets: `<html lang="ko">`, Korean content + chrome (title
  `몰몬경·KR`, `니파이¹`, Korean meta description, **localized index/static titles** e.g.
  `/people` → `몰몬경에 나오는 인물`, `/contents` → `목차`), self-canonical on the Korean host,
  og:image `lang=ko`, and the `naver-site-verification` meta — matching `몰몬경.kr` head parity.
- The English apex is unchanged (English content/chrome, apex canonical, no `lang`/naver).
- Other supported domains resolve to their language via the map; `slv`/`tr` documented as
  staying English (backend gap).
- Sitemap ISR preserved (pinned en); existing bot-UA SSR suite stays green.

## Open items (resolve in planning)
- **Per-language body paragraph:** capture the Korean `DEFAULT_BODY` from the live box; decide
  whether other langs fall back to English now or are captured too (recommend Korean + English
  now, others English-fallback).
- **Nav item set per language:** the KR box shows 6 items (no `fax`); confirm the per-lang set
  to match each live box.
- **Index/static title→label-key map:** enumerate every hardcoded-English index/static title
  (`app/people`, `places`, `contents`, `about`, `fax`, `timeline`, `map`, `history` index, …)
  and its `title_*` label key; fallback to the English string if a key is absent.
- **Proxy host forwarding (S6 — pre-rollout, mandatory):** verify NPM forwards the public host
  via `x-forwarded-host` (curl through the proxy, check `X-Resolved-Lang`); if it doesn't,
  every domain silently stays English. This gates rollout.
- **Prod `GRAPHQL_URL`:** must not carry a lang-code subdomain (`resolveLang` checks the GraphQL
  host's subdomain first); confirm the prod value.
