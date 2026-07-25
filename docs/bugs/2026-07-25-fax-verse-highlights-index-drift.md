# Fax verse highlights render zero hotspots — sparse faxIndex consumed as a dense array

**Date:** 2026-07-25
**Status:** FIXED 2026-07-25 on branch `fix/fax-verse-highlight-index-drift` (commits `fb11d1c5` buildDensePages, `f7070463` getRefFromIndex move, `7e01d1c2` the flip). Verified live — see "Fix & verification" below. Caveat: offset≠0 editions (rebom, poetic) have the drift fixed but remain blocked by a **separate** pre-existing bug — see `docs/bugs/2026-07-25-fax-boxes-offset-keying-mismatch.md`.
**Scope:**
- `backend/src/data/loaders/mediamisc.ts` — faxIndex loader (`faxIndexBySlug`)
- `frontend/webapp/src/views/Facsimiles/Facsimiles.js` — `getRefFromIndex`, `pageIndex` assembly
- `frontend/webapp/src/views/Facsimiles/faxGeometry.js` — `buildLeafIndex`
- `frontend/webapp/src/views/Facsimiles/faxVerseData.js` — `spreadVerseIds`, `mergeBoxes`
- `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js` — `versesByPage.get(pageNumInt)`
- `backend/src/media/fax/route.ts` — `/fax/boxes` `imagePage` tagging

**Related:** `docs/audits/2026-07-25-fax-verse-highlight-not-rendering.md` (the audit this write-up
confirms and sharpens), `docs/audits/2026-07-24-fax-page-numbering-ssot.md`,
`docs/plans/2026-07-23-single-witness-layout-redesign.md`

---

## Symptom

On the desktop two-page spread (e.g. `/fax/1871/24`), **no verse hotspots or highlight
cutouts render**, even though the box data exists, `/fax/boxes/...` returns HTTP 200 JSON,
and the browser fetches it. The `.faxVerseLayer` / `.faxVerseHotspots` containers mount but
hold **zero** `.faxHotspot` children. Hovering/clicking a verse does nothing.

The tell: on `/fax/1871/24` the desktop path fetches boxes for verses **31625–31659**, which
belong to scan **page 46**, not page 24. Page 24's real verses are `31349–31383`.

## Root cause

**One `pageReference` array is produced sparse (gap-collapsed) but consumed dense (addressable
by image-file page number). The two numbering schemes silently disagree, so every page after
the first internal gap fetches the wrong verse range.**

### The broken invariant

The whole desktop pipeline assumes `pageIndex` is a **dense array keyed by image-file page
number** — this is stated outright in two comments:

- `Facsimiles.js:49-54`: placeholders "skip the leading CONTENT pages … so getRefFromIndex —
  which is keyed by image-file number — lands `pages[0]` on image file `pgfirstVerse`."
- `faxGeometry.js:46-52`: "The CANONICAL user-facing page number is the scan image-file number
  (`pageNumInt`) … and the boxes join."

But the source array is **not** dense. The faxIndex loader
(`backend/src/data/loaders/mediamisc.ts:115-134`) does:

```ts
.select(['version', 'page'])
.select(eb => [ eb.fn.min('verse_id')…, eb.fn.max('verse_id')…, eb.fn.count('verse_id').distinct()… ])
.where('version', '=', slug)
.groupBy(['version', 'page'])
.orderBy('page', 'asc')
```

`groupBy(page)` emits **one row per distinct page that has indexed verses**. Pages with no
indexed verses (plates, illustrations, blanks, chapter-break leaves) produce **no row** — so
the array's position index ≠ image-file number.

The frontend then pads only for **leading** gaps and consumes the rest **positionally**:

```js
// Facsimiles.js:55, 64-65
const blankPageCount = pgfirstVerse - 1;                       // 1871: pgfirstVerse=1 → 0
const placeholderArray = Array.from({ length: blankPageCount }, () => [0, 0]);
setPageIndex([...placeholderArray, ...pages]);                 // 1871: pageIndex === pages (sparse)

// Facsimiles.js:23-25  (called with i = image-file page number)
export const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;                     // page 24 → 23
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
```

The `pgfirstVerse - 1` placeholder pad compensates for gaps **before the first indexed page**.
It does **nothing** for **internal** pageless scans. So the moment any pageless scan sits
*between* two indexed pages, `pageIndex[imagePage-1]` points past its intended row, and the
error is **cumulative** — it grows by the running count of collapsed internal gaps.

### Data-flow trace (verified link by link)

1. `buildLeafIndex` (`faxGeometry.js:68`) sets `pageReference: getRef(pageIndex, i)` where `i`
   is the leaf's true image-file number (`pageNumInt`). For leaf 24 → `getRefFromIndex(pageIndex, 24)`
   → `pageIndex[23]` → the **24th distinct-page row** → the ref for scan page 46.
2. `spreadVerseIds` (`faxVerseData.js:160-167`) turns each leaf's (drifted) `pageReference` into
   verse ids via `lookupReference(ref).verse_ids` → ids for the page-46 range (`31625–31659`).
3. `useFaxVerses` (`useFaxVerses.js:34-40`) fetches `/fax/boxes/1871/ids/31625-…`.
4. `/fax/boxes` (`route.ts:160-165`) tags each box `imagePage: b.page + meta.offset` → 46/47
   (offset 0 for 1871). `mergeBoxes` (`faxVerseData.js:35-44`) → `byPageVerse` keyed **{46, 47}**;
   `hydrateVerses` carries those keys into `versesByPage`.
5. The render join (`FacsimilePageViewer.js:445` and `:723`) does
   `faxVerses.versesByPage.get(page.pageNumInt)` → `.get(24)`. The map is keyed **{46, 47}** →
   returns `undefined` → `|| []` → **zero hotspots**. The container renders; the children can't.

The overlay and boxes are keyed to the drifted **true** image page (46/47), while the render
join asks for the leaf's **actual** image page (24). They never meet.

## Evidence (live DB, 1871)

`bom_xtras_fax_index`, ordinal (row number over `ORDER BY page`) vs actual page:

| ordinal (rn) | DB page | first verse | verse count |
|---|---|---|---|
| 1  | 1  | 31103 | 4  |
| **10** | **24** | **31349** | **35** |
| 23 | 44 | 31617 | 8  |
| 24 | **46** | **31625** | 19 |
| 25 | 47 | 31643 | 17 |

Read this two ways, both from the same table:
- Image page **24** is only the **10th** indexed page (`rn=10`) — 14 of pages 1–24 carry no
  indexed verses in the 1871 scan.
- `getRefFromIndex(pageIndex, 24)` reads `pageIndex[23]` = `rn=24` = **page 46**. That is the
  22-page drift, made concrete.

Query (read-only reader creds; raw SELECT, sandbox does not apply):

```bash
cd backend && npx tsx scripts/sql-cli.mjs -e "SELECT rn, page, first_v, vc FROM ( \
  SELECT page, MIN(verse_id+0) first_v, COUNT(DISTINCT verse_id) vc, \
         ROW_NUMBER() OVER (ORDER BY page) rn \
  FROM bom_xtras_fax_index WHERE version='1871' GROUP BY page) t \
  WHERE rn IN (1,23,24,25) OR page IN (24,46) ORDER BY page" --execute
```

(env from `$XDG_RUNTIME_DIR/bom-dev.env`; boxes served by the green-field backend on `:5006`,
not `:5005` — consistent with the "greenfield backend topology" note.)

## Impacted versions

A version is affected iff it has **internal** pageless scans — blanks/plates/illustrations
*between* two indexed pages. Purely *leading* front matter (a page-1 gap) is already handled by
the `pgfirstVerse - 1` placeholder pad, so front-matter-only editions are fine.

Detection query — internal gaps = `(max_page - min_page + 1) - COUNT(DISTINCT page)`:

```bash
cd backend && npx tsx scripts/sql-cli.mjs -e "SELECT version, \
  (MAX(page)-MIN(page)+1)-COUNT(DISTINCT page) internal_gaps \
  FROM bom_xtras_fax_index GROUP BY version HAVING internal_gaps > 0 \
  ORDER BY internal_gaps DESC" --execute
```

**11 impacted versions:**

| Version | Internal gaps |
|---|---|
| 1842 | 189 |
| 1852 | 164 |
| 1854 | 164 |
| 1854l | 164 |
| 1866 | 164 |
| 1871 | 164 |
| 1874 | 164 |
| 1877 | 164 |
| 1849 | 148 |
| rebom | 6 |
| poetic | 1 |

**Not impacted** (contiguous indexed pages, or gaps confined to leading front matter):
1829, 1830, 1837, 1840, 1841, 1879, 1879l, 1881, 1882, 1883d, 1885, and the remaining editions
with `internal_gaps = 0`. Note 1837 (min page 11) and other front-matter editions read clean —
their leading gap is compensated; only interior gaps drift.

## Why a per-version offset cannot fix this

A single per-version page offset only corrects a **uniform** shift. This drift is a **step
function that grows with each internal gap**, not a constant. For 1871 the position→page drift
runs **0 → 164 across 101 distinct values** (`MIN/MAX(page - rn)` over the ordinal), so no single
offset lines all pages up — an early page needs +0 while a late one needs +164. The fix must make
the lookup keyed by image-file page (code), or backfill placeholder rows for every pageless scan
so the array is dense again (data — brittle, ~1,400 rows across the 11 versions, must be
re-maintained on any scan/index change). Option 1 in *Fix direction* is preferred.

## Why mobile shows the right page but desktop breaks

Mobile (`FacsimilePageViewerMobile` / `FaxScrollPageRow`) addresses pages by image-file number
directly and renders `024.png` with the correct header ref. Only the desktop spread runs the
drifted positional `getRefFromIndex` join. Net effect: **desktop and mobile disagree on what
"page 24" contains** — a route-parity break on top of the missing highlights.

## Fix direction (not yet applied)

The index must be addressable by **image-file page number**, not by array position. Preferred:

1. **Key by page, not position.** Have the loader (or a frontend normalizer) produce a
   `Map<page, {firstVerseId, verseCount}>` (or a dense array padded to `page` with `[0,0]` for
   gap scans), and change `getRefFromIndex` to look up by `pageNum` instead of
   `pageIndex[pageNum - 1]`. This makes `versesByPage.get(pageNumInt)` line up automatically and
   removes the leading-placeholder hack entirely.
2. Alternatively keep a dense 0-filled array positionally — but that reintroduces the offset
   foot-guns the SSoT audit warns about; option 1 is cleaner and kills the whole class.

Validate against editions with front matter/plates (1837 offset −4, 2013 offset −9) since those
stress both the leading-placeholder count and internal-gap handling.

## Regression test

A pure unit test on the resolver is enough to lock the invariant (no browser needed):

- Build a synthetic sparse index for a fake edition where page 3 has no verses:
  `pages` rows for image pages `[1, 2, 4, 5]`.
- Assert `getRefFromIndex(pageIndex, 4)` returns the range for **image page 4**, not the range
  for the 4th row (image page 5). Today it returns page 5's range → drift.
- Backstop with an integration assertion that for `1871`,
  `lookupReference(leafFor(24).pageReference).verse_ids` starts at `31349`, not `31625`, and that
  `versesByPage.get(24)` is non-empty after `useFaxVerses` resolves.

## Fix & verification (2026-07-25)

Implemented Fix-direction option 1 (key by image-file page). Three commits on
`fix/fax-verse-highlight-index-drift`:
- `fb11d1c5` — pure `buildDensePages(items)` in `backend/src/graphql/resolvers/mediamisc.ts` +
  vitest (`backend/test/graphql/faxIndex.test.ts`, 4 cases incl. interior + leading gap).
- `f7070463` — moved `getRefFromIndex` into `faxGeometry.js` (+ jest regression test), removed two
  dead imports. Behavior-neutral.
- `7e01d1c2` — the flip: resolver returns `buildDensePages(items)`; `Facsimiles.js` drops the
  leading-placeholder prepend and consumes the dense array directly.

**Live verification** (localhost, `bom-greenfield` restarted to load the resolver — it runs
`tsx` without `--watch`):
- GraphQL `faxIndex(1871)` now returns a **dense** array: `length 453`, index 23 (image page 24)
  = `[31349,35,1]` (was `[31625,…]`), **164 `[0,0]` gaps** = the measured internal-gap count.
- `/fax/1871/24` renders **35 hotspots** (was 0) with header ref **"1 Nephi 11:18-12:16"** — page
  24's true content. `/fax/1842/100` (most gaps, 189) renders **63 hotspots**, ref correct.
- The 9 offset-0 impacted editions (1842, 1849, 1852, 1854, 1854l, 1866, 1871, 1874, 1877) are
  fixed by this change (shared code path; 1871 + 1842 spot-checked live).

**Scope caveat — offset≠0 editions:** `/fax/1837/50` still shows 0 hotspots, but this is a
**separate pre-existing bug**, not a regression: 1837 (offset −4) resolves the correct refs, so the
drift fix works, but the boxes route keys boxes by `imagePage = b.page + offset` while the viewer
looks them up by `pageNumInt` — a mismatch this change never touches. Same for the two offset≠0
impacted editions **rebom (−26)** and **poetic (−47)**: drift fixed, hotspots still blocked by the
offset mismatch. Tracked in `docs/bugs/2026-07-25-fax-boxes-offset-keying-mismatch.md`.

## Secondary findings (carried from the audit, not re-verified here)

- Mobile highlight overlay is **deep-link-only by design** — a plain numeric page URL yields
  `refParam = null`, so no overlay regardless of this bug.
- Mobile verse deep-link (`/fax/1871/1.nephi.19.8`) redirects to the page number, dropping the
  target verse.
- Desktop verse deep-link hangs on the loader — likely the same drift starving ref→page
  resolution; needs a separate confirm.
