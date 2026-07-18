# Multi-Edition Cropped-Verse FaxVerseTile — Design Spec

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Author:** Claude (brainstormed with KC)

## 1. Background & motivation

`frontend/webapp/src/views/Home/tiles/FaxVerseTile.js` is a home-feed sampler tile
that currently shows a **single whole-page thumbnail** of one facsimile edition for a
sampled verse, plus the verse text below. With the new dynamic facsimile render API
(`/fax/render/{version}/{mode}/w{width}/{selector}.{ext}`, see
`docs/specs/2026-07-18-fax-render-api-design.md`), we can instead show the **cropped
verse image** — just the highlighted passage — and show it for **up to 3 editions of
the same verse at once**, as a "see this verse across editions" comparison.

## 2. Decisions locked (from brainstorming)

1. **Concept:** one sampled verse, cropped-verse images from **up to 3 editions**.
2. **Edition choice:** the currently-sampled edition **plus 2 others** that have a box
   for that verse (seeded variety across reloads).
3. **Layout:** crops **stacked vertically**, each with a small edition label.
4. **Crop URL base:** point at the **backend render route** now, via a single
   configurable base constant, so it can flip to the media CDN later once CloudFront
   failover is wired. (The render endpoint is NOT on `media.bookofmormon.online` yet.)
5. **Click target:** each crop **deep-links to that edition's fax viewer at the verse**
   (`/fax/{version}/{ref}`).
6. Keep the verse-text excerpt (`ScriptureExcerpt`) and the ref bar (scripture popup).

## 3. Current state (verified)

- GraphQL query (`GraphQLQueries.js:1789`): `faxVerse { version title format page verseId ref }`.
- Schema (`backend/schema/HomeSampler.graphql:101`): `type FaxVersePage { version title format page verseId ref }`.
- Resolver (`backend/src/graphql/resolvers/homesampler.ts:196` `sampleFaxVerse`): samples
  one `(version, page, verseId)` from `bom_xtras_fax_index ⋈ bom_xtras_fax (hide=0)`,
  returns `{ version, title, format, page, verseId, ref: generateReference([verseId]) }`.
- Frontend URL bases (`BoMOnlineAPI.js`): `assetUrl = "https://media.bookofmormon.online"`
  (static CDN — render endpoint NOT served here yet). GraphQL/backend origin is
  `REACT_APP_API_URL` (dev `http://localhost:5006`; same-origin/proxy otherwise).
- The render endpoint is served by the **backend** (`backend/src/media/fax/route.ts`),
  which exports `canonicalSelector` in `backend/src/media/fax/canonical.ts`.

## 4. Backend — schema + resolver

Extend `FaxVersePage` (keep existing fields for back-compat; they mirror the primary
sampled edition = `editions[0]`):

```graphql
type FaxEdition {
  version: String!
  title: String
  page: Int!
}

type FaxVersePage {
  version: String
  title: String
  format: String
  page: Int
  verseId: Int
  ref: String
  selector: String            # canonical render slug for the verse, e.g. "1-nephi-1.1"
  editions: [FaxEdition!]!     # sampled edition first, then up to 2 more (max 3)
}
```

`sampleFaxVerse` changes:
1. Sample one `(version, verseId)` as today (keeps the seeded behaviour + existing fields).
2. Query all editions with a box for that `verseId` and `f.hide = 0`:
   `SELECT DISTINCT i.version, f.title, i.page FROM bom_xtras_fax_index i JOIN bom_xtras_fax f ON f.slug = i.version WHERE i.verse_id = <verseId> AND f.hide = 0`.
3. Order the **sampled edition first**, then up to 2 more in a seeded order
   (`ORDER BY MD5(CONCAT(version, ':', seed))`), cap the total at 3 → `editions`.
4. Compute `selector = canonicalSelector([verseId])` (import from `../../media/fax/canonical.js`;
   reuse, do not duplicate the slug logic). For a single verse this yields a ref slug
   like `1-nephi-1.1` (falls back to `ids/<verseId>` if it doesn't round-trip).

The `editions[i].page` is that edition's own `bom_xtras_fax_index.page` (used for the
deep-link fallback). The render `selector` is shared across editions (same verse).

## 5. Frontend — URL construction

- Add ONE config constant to `BoMOnlineAPI.js`:
  `export const renderBaseUrl = process.env.REACT_APP_API_URL || "";`
  (same-origin fallback when unset). Flipping to the media CDN later is a one-line change.
- **Crop image src:** `${renderBaseUrl}/fax/render/${version}/crop/w800/${selector}.jpg`.
  `w800` is in the render width whitelist; CSS scales it to the tile width.
- **Deep link per crop:** `/fax/${version}/${refSlug}`, where
  `refSlug = data.ref.replace(/[ :]+/g, '.').toLowerCase()` (the app's existing
  fax-viewer ref-slug convention). If `ref` is missing, fall back to the edition's
  `page` number (`/fax/${version}/${page}`), matching today's link.

## 6. Frontend — component (FaxVerseTile)

- Replace the single page-thumbnail `<img>` with a vertical stack of up to 3 rows.
  Each row: a small edition label (`title` or `version` year) + the cropped-verse
  `<img>`, wrapped in a `<Link to={/fax/{version}/{refSlug}}>`.
- Keep: the `tileHeading` (Facsimiles link), the ref bar (`faxPageBar` → `openScripture`),
  and the `ScriptureExcerpt` below — unchanged.
- Images: `loading="lazy"`. On error, the row hides itself (`onError` sets the row's
  `display:none`, or filters it out), so a failing edition drops out gracefully.
- Guard: if `!data?.editions?.length` (or no `selector`), render `null` (as today when
  `!data?.version`). Prefer `data.editions`; if absent (old cached payload), synthesize a
  single-edition list from the legacy `version`/`page` fields for resilience.

## 7. Styling

Add rules under `.faxVersePage` in `Sampler.css`:
- vertical stack of rows (`display:flex; flex-direction:column; gap`).
- each row: muted small edition label + full-width contained crop
  (`max-width:100%`, subtle border/rounded corners so it reads as a clipping).
- responsive: full tile width on mobile; stack degrades to 1–2 rows cleanly.

## 8. Error handling / edge cases

- Fewer than 3 editions with the verse → show what's available (1–2 rows).
- A crop that 404s/500s → `onError` removes that row.
- **Known caveat (not blocking):** "sampled + 2 others" can surface an edition with
  source-data alignment quirks (some 2013 verse boxes land on chapter headings — a
  separate fax-data issue, tracked independently). Cosmetic only.

## 9. Testing

- **Backend (Vitest, live DB):** `sampleFaxVerse` returns ≤3 editions with the sampled
  edition first, each having a real box for the verse; `selector` equals
  `canonicalSelector([verseId])`; back-compat fields still present.
- **Frontend:** update `frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js`
  — assert N edition rows render with the correct crop `src`
  (`${renderBaseUrl}/fax/render/${version}/crop/w800/${selector}.jpg`) and correct
  per-edition `/fax/{version}/{refSlug}` links; empty `editions` renders nothing;
  legacy-payload fallback renders one row.

## 10. Out of scope

- Wiring the render endpoint onto the media CDN (CloudFront failover) — separate infra;
  the `renderBaseUrl` constant is the seam for that switch.
- Fixing the 2013 (and any other edition) verse-box alignment data quirks — separate.
- Changing other sampler tiles.
