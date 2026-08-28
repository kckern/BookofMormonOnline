# OG image previews: artwork & portrait thumbnails

**Date:** 2026-08-27
**Status:** Design (brainstormed with KC), pending implementation plan
**Layer:** `frontend/next/` (SSR og:image route + metadata)
**Related:** [`../reference/ssr.md`](../reference/ssr.md); the OG investigation that found the
`img` param unwired.

## Problem

Every SSR page already emits a working `og:image` — the `/og` route renders a branded
text card (title/sub, now Korean-font-capable). But **art and people/place pages show a
generic text card, not the actual artwork/portrait.** The `/og` route + `BomOgCard` were
built with an `img`→thumbnail capability, but (a) no page ever passes it, and (b) its
hardcoded art path is **wrong** (`media.…/art/square/{id}.jpg` → 404; the real path is
`media.…/art/{id}`). This completes the "image previews" goal: art pages preview the
artwork, people/place pages preview the portrait.

## Verified media paths (probed live)

- **Art:** `https://media.bookofmormon.online/art/{id}` → 200 image/jpeg. (`/art/square/{id}.jpg` → 404 — the current bug.)
- **People:** `https://media.bookofmormon.online/people/{slug}` → 200 (slug-based; already the SSR `<img>` source on the live box).
- **Places:** `https://media.bookofmormon.online/places/{slug}` → 200 (plural `places`).
- **Missing images 404** (no placeholder) — so a portrait-less entity needs graceful handling.

## Decisions (brainstorming)

- **Scope:** art + people/place. The identity is slug/id already present in each page's
  `generateMetadata` — **no data-layer/GraphQL change**.
- **Image param:** a **whitelisted `imgtype`** scheme (`art`/`people`/`places`), not a raw
  URL — prevents a crafted `/og` URL from embedding an arbitrary external image in our
  branded card.
- **Missing image:** the `/og` route **preflight-HEADs** the media URL (short timeout) and
  renders the **text-only card** if it's not 200 — so portrait-less entities degrade
  gracefully instead of 500-ing the OG image.

## Architecture

### 1. `/og` route — `app/og/route.ts`
- Read `img` (id or slug) and `imgtype` (default `art`). **Sanitize `img` first** — accept
  only `/^[A-Za-z0-9_-]+$/` (art ids are numeric, people/place slugs are `[a-z0-9-]`); a
  value with `/`, `.`, `?`, `#` is rejected → no image. This closes a path-traversal seam
  (`img=../people/x` would otherwise resolve to a different media path, defeating the
  whitelist — verified: `fetch` normalizes `../`). Then build the media URL from the
  `imgtype` whitelist:
  ```
  art    → ${MEDIA}/art/${img}
  people → ${MEDIA}/people/${img}
  places → ${MEDIA}/places/${img}
  ```
  (`MEDIA = https://media.bookofmormon.online`.) An unknown `imgtype` → treat as no image.
- **Preflight:** if `img` is valid, `fetch(mediaUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) })`
  (HEAD is supported by the media host — verified; `AbortSignal.timeout` is available in the
  Node runtime — verified); set `artUrl = mediaUrl` only if `ok`. On any non-200/timeout/
  error → `artUrl = undefined` (text card). The preflight runs **per request** (the route is
  dynamic — it reads `searchParams` — so `revalidate = 86400` is inert; the cost is one HEAD
  per scrape, absorbed by the scraper's/CDN's own per-URL caching — acceptable).
- Pass `artUrl` to `BomOgCard`. Fonts (incl. the Korean font via `lang`) unchanged.

### 1b. `BomOgCard` crash backstop — `app/og/BomOgCard.tsx`
Preflight is not sufficient alone: the media GET during Satori render can still fail after a
passing HEAD (race/timeout/transient 5xx), and Satori **throws** on a failed `<img>` whose
size it can't determine — which drops the connection (verified empirically, worse than a
500). Add explicit **`width={260} height={260}` attributes** (not just CSS) to the card's
`<img>` — verified that this makes the failed-image case render a blank box instead of
throwing. Keep the preflight too (it avoids the reserved 320px gap + blank box on
known-missing portraits). Belt-and-suspenders.

### 2. `buildMetadata` — `lib/seo.ts`
- Add optional `ogImg?: string` + `ogImgType?: 'art' | 'people' | 'places'` to `SeoInput`.
- When `ogImg` is set, append to the existing `ogParams`: `img=${ogImg}` and (if
  `ogImgType`) `imgtype=${ogImgType}` — so the og:image URL becomes
  `/og?title=…&sub=…&lang=…&img=…&imgtype=…`.

### 3. Pages pass their identity
- `app/art/[id]/page.tsx` `generateMetadata`: add `ogImg: id, ogImgType: 'art'`.
- `app/people/[slug]/page.tsx`: add `ogImg: slug, ogImgType: 'people'`.
- `app/place/PlaceView.tsx` (shared by `/place/[slug]` + `/places/[slug]`): add
  `ogImg: slug, ogImgType: 'places'` (the portrait path is `places` for both routes).

## Testing
- **Use slugs that actually HAVE portraits** (verified live): people `nephi`, `alma`;
  places `zarahemla`, `bountiful`, `land-of-nephi`; art `1000`. **Many famous slugs 404**
  (moroni, lehi, jerusalem, cumorah) — those exercise the fallback, not the image.
- **Metadata:** `/art/{id}`, `/people/{slug}`, `/place/{slug}` og:image URLs contain
  `img=` + the correct `imgtype=`; other page types (e.g. `/contents`) do NOT.
- **Media resolves:** the built media URL for a known art/people/place returns 200 image.
- **`/og` route:** `GET /og?img=1000&imgtype=art` → 200 `image/png`; `GET
  /og?img=moroni&imgtype=people` (known 404) → **still 200 `image/png`** (text-card
  fallback, not a 500/dropped connection); `GET /og?img=../people/x&imgtype=art` (traversal)
  → 200 `image/png` text card (rejected `img`). Extend `test/routes/og.test.ts`.
- **Composition:** a Korean art page's og:image carries both `lang=ko` and `img=…` (the
  card shows the artwork + Korean title). Add to `test/routes/korean.test.ts` or the art
  test.
- Full SSR suite stays green.

## Scope
**Touched:** `app/og/route.ts` (fix art path + imgtype + sanitize + preflight),
`app/og/BomOgCard.tsx` (img width/height attributes — crash backstop), `lib/seo.ts`
(`ogImg`/`ogImgType` → params), `app/art/[id]/page.tsx`, `app/people/[slug]/page.tsx`,
`app/place/PlaceView.tsx`, tests.

**NOT in scope:** other page types (no portrait media — they keep the text card, which is
correct); the retired GD `preview.bookofmormon.online` service (already replaced by `/og`);
adding portrait fields to GraphQL (unnecessary — slug-derived).

## Acceptance criteria
- Art pages' og:image renders the artwork; people/place pages' render the portrait; the
  built media URLs resolve (200 image).
- A portrait-less entity's og:image is a 200 PNG text card (never a 500/broken image).
- The `img` scheme is type-whitelisted (no arbitrary-URL embedding).
- Korean art/people/place og:images compose the portrait with the Korean font/title.
- No GraphQL/data-layer change; full SSR suite green.

## Accepted deviation
- **Small portraits blur.** Some portraits are tiny (e.g. `people/nephi` is 100×120 px);
  upscaled into the 260×260 `objectFit: cover` box they look soft. Accepted — showing the
  portrait is better than a generic text card, and gating on dimensions would need an extra
  image fetch. Art (≈385×500) is fine.

## Open items (resolve in planning)
- **Preflight timeout value:** 2000 ms proposed; confirm it's comfortably under the OG
  route's overall budget and Satori render time.
