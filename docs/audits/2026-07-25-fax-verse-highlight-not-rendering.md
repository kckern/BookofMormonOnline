# Fax verse-level highlights do not render (desktop leaf→page index drift)

**Date:** 2026-07-25
**Scope:** `frontend/webapp/src/views/Facsimiles` (desktop viewer) + `backend/src/data/loaders/mediamisc.ts` (faxIndex loader)
**Status:** Root cause confirmed; no fix applied yet.
**Related:** `docs/audits/2026-07-24-fax-page-numbering-ssot.md`, `docs/plans/2026-07-23-single-witness-layout-redesign.md`

## Symptom

At `http://<dev>:8200/fax/1871/24` (and by extension any fax page whose image-file
number is preceded by a page with no indexed verses), **no verse hotspots or
highlight boxes render**, even though:

- the box data exists in the DB,
- the `/fax/boxes/...` API returns it (HTTP 200 JSON),
- the browser successfully fetches it.

The two-page spread displays; hovering/clicking a verse does nothing; no
`.faxHotspot`, no `.faxCutoutRing`, no verse modal.

## Reproduction

Headless Chromium (Playwright) against `http://10.0.0.10:8200/fax/1871/24`:

| Viewport | Box API calls | Hotspots / overlay rendered |
|---|---|---|
| Desktop 1280px | 200 JSON, ids `31625–31659` | `.faxVerseLayer`/`.faxVerseHotspots` containers mount but hold **0 `.faxHotspot`** |
| Mobile 390px | 200 JSON | **0 `.faxHighlightBox`** (overlay is deep-link-only by design — see §Secondary) |

Note the desktop fetch is for verses **31625–31659**, which the box table stores
under **image page 46–47** — not page 24.

## Root cause: positional indexing of a sparse distinct-page list

Two independent "page" numberings are being cross-joined on the assumption that
they line up 1:1, and they don't.

1. **Box geometry** (`bom_xtras_fax_index.page`) — the real scan image-file number.
   For edition `1871`, page 24 holds verses `31349–31383` (1 Nephi 19:8–20:2).

2. **The faxIndex loader** (`backend/src/data/loaders/mediamisc.ts:115`) groups
   `bom_xtras_fax_index` by `page` and returns **one row per distinct page that
   has verses**, ordered by page:

   ```ts
   .select(['version','page'])
   .select(eb => [eb.fn.min('verse_id')…, eb.fn.max('verse_id')…, …])
   .where('version','=',slug)
   .groupBy(['version','page'])
   .orderBy('page','asc')
   ```

   Pages with **no** indexed verses (front matter, plates, blanks) produce no row,
   so the array is **sparse** — array index ≠ image-file number.

3. The frontend consumes that array **positionally**
   (`frontend/webapp/src/views/Facsimiles/Facsimiles.js:23`):

   ```js
   export const getRefFromIndex = (pageIndex, pageNum) => {
     const itemIndex = parseInt(pageNum) - 1;              // 24 → 23
     const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
     …
   ```

   `pageIndex = [...placeholders(len 0), ...pages]` (placeholder count is
   `pgfirstVerse − 1 = 0` for 1871). So `pageIndex[23]` = the **24th distinct page
   row**, not image page 24.

### The drift, measured

```sql
SELECT rn, page, first_v FROM (
  SELECT page, MIN(verse_id+0) first_v,
         ROW_NUMBER() OVER (ORDER BY page) rn
  FROM bom_xtras_fax_index WHERE version='1871' GROUP BY page) t
WHERE rn IN (1,23,24,25);
```

| ordinal (rn) | actual DB page | first verse |
|---|---|---|
| 1  | 1  | 31103 |
| 23 | 44 | 31617 |
| 24 | **46** | **31625** |
| 25 | 47 | 31643 |

Ordinal 24 → DB page 46 (page 45 has no indexed verses, and ~22 earlier pages are
likewise skipped). So `getRefFromIndex(pageIndex, 24)` returns the verse range for
**page 46** (`31625–31659`).

### Why that kills the hotspots

The rendered leaf keeps its true image-file number, `pageNumInt = 24`
(`faxGeometry.js:44`, `buildLeafIndex`). The verse overlay joins boxes to the page
by that number (`FacsimilePageViewer.js:723`):

```js
const pageVerses = faxVerses.versesByPage.get(page.pageNumInt) || []; // .get(24)
```

But `useFaxVerses` fetched the **page-46** verse range (from the drifted
`getRefFromIndex`), and `/fax/boxes` tags those boxes `imagePage: 46/47`
(`backend/src/media/fax/route.ts:162`, `imagePage = b.page + offset`, offset 0 for
1871). So `versesByPage` is keyed `{46,47}` while the lookup asks for `24` →
**empty → zero hotspots**. The container renders, the children don't.

## Why mobile displays the correct page but desktop doesn't

Mobile (`FacsimilePageViewerMobile` / `FaxScrollPageRow`) addresses pages by the
image-file number directly and rendered image `024.png` with the correct header
ref (`Page 24 · 1 Nephi 19:8–20:2`). The desktop spread path is the one that runs
the drifted positional `getRefFromIndex` join. Net effect: **desktop and mobile
disagree on what "page 24" contains** — a route-parity break on top of the
missing highlights.

## Suggested fix direction (not yet applied)

The index array must be addressable by **image-file page number**, not by array
position. Options, in rough order of preference:

1. **Key by page, not position.** Have the faxIndex loader (or the frontend
   normalizer) produce a `Map<page, {firstVerseId, verseCount}>` (or a
   dense array padded to `page` with gaps as `[0,0]`), and have
   `getRefFromIndex` look up by `pageNum` rather than `pageIndex[pageNum-1]`.
   This also makes `versesByPage.get(pageNumInt)` line up automatically.
2. Alternatively, keep the array dense (0-filled for pageless scans) so
   positional indexing stays valid — but that reintroduces the offset foot-guns
   the SSoT audit warns about; option 1 is cleaner.

Any fix should be validated against an edition with front matter/plates
(e.g. 1837 offset −4, 2013 offset −9) since those stress both the placeholder
count and the gap handling.

## Secondary findings (surfaced during this audit)

- **Mobile highlight overlay is deep-link-only, by design.** `refParam` is
  `?ref=` or a *lettered* slug (`FacsimilePageViewerMobile.js:59`); a plain
  numeric page URL yields `refParam = null`, so `useFaxHighlight` returns EMPTY
  and draws no overlay. Not a bug on its own, but means a page URL never shows
  the mobile overlay regardless of the issue above.
- **Mobile verse deep-link drops the ref.** `/fax/1871/1.nephi.19.8` redirects to
  `/fax/1871/24` (page number), losing the target verse, so nothing highlights.
  (Slug format `1.nephi.19.8` is unverified as canonical — treat as a lead.)
- **Desktop verse deep-link hangs.** `/fax/1871/1.nephi.19.8` sits on the loader
  spinner and never renders the spread within ~13s. Likely the same drift
  starving the ref→page resolution; needs a separate confirm.
- **`:5005` serves no fax boxes; `:5006` does.** `GET /fax/boxes/1871/ids/…`
  returns data only on the green-field backend (`:5006`). Consistent with the
  existing "greenfield backend topology" note — verify backend facts against
  `backend/`, not `src/`.

## Evidence / how to re-run

- SQL via `backend/scripts/sql-cli.mjs -e "…" --execute` (read-only reader creds;
  raw SELECTs, sandbox does not apply).
- Playwright scripts used during the audit: `/tmp/pw-fax*.mjs`; screenshots
  `/tmp/fax-*.png` (desktop spread renders, no highlights; mobile page 24 renders,
  no overlay).
- Data confirmation: `version='1871'` has 6,740 boxes / 6,604 verses, pages
  1–453, `pageScale=700`; page 24 = 35 verses `31349–31383`.
