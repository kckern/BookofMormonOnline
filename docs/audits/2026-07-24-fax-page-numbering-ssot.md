# Fax Page-Numbering SSoT Audit

**Date:** 2026-07-24
**Trigger:** Page-input value and URL route value for the page number disagree;
per-page references look wrong on some editions.
**Scope:** `frontend/webapp/src/views/Facsimiles/` numbering + `getRefFromIndex`.

## TL;DR

There are **two legitimate real-world page identities** for a fax edition, and
the UI silently mixes them, plus one outright indexing bug:

1. **Image-file number** (`pageNumInt` / `pageSlugLeaf`) — the scan file
   `001.jpg…`, used for **asset URLs and the route slug**.
2. **Printed folio** (`faxPageNum` / `faxPageSlug` = `pageNumInt − faxOffset`) —
   the number physically printed on the page, used for the **page-input box, the
   "Page X" label, the slider aria text, and the jump-to-page form**.

Because `faxOffset ≠ 0` for essentially every edition, these two never agree, so
the input box and the URL show different numbers. Separately,
`getRefFromIndex`'s placeholder padding **double-counts `pgoffset`**, shifting
every per-page reference by `pgoffset` on front-matter editions — which also
silently breaks the new verse inspector there.

## The numbering quantities (and their single sources)

Built in `faxGeometry.js#buildLeafIndex`:

| Field | Definition | Used for |
|---|---|---|
| `leafCursor` (`idx`) | array position, 0-based | internal indexing |
| `i` | `idx − pgoffset` (≤0 = front matter, >0 = content page) | asset file #, ref lookup |
| `pageNumInt` | `i` when `i>0`, else null | image-file #, join key to boxes `imagePage` |
| `pageNumRoman` | roman(`idx`) for front matter | front-matter slug |
| **`pageSlugLeaf`** | `pageNumRoman ‖ pageNumInt` | **URL route slug + asset URL** |
| `faxPageNum` | `pageNumInt − faxOffset` | printed folio (display) |
| **`faxPageSlug`** | `pageNumRoman ‖ faxPageNum` | **page input, "Page X" label, slider aria** |
| `pageReference` | `getRefFromIndex(pageIndex, i)` | refs rail, inspector spread ref |

`faxOffset` = `faxIndex.offset` (per-edition, from the index API). `pgoffset` =
`fax.pgoffset` (front-matter leaf count). `pgfirstVerse` = image-file number of
the first indexed page (name is misleading — it is a page number, not a verse).

## Confirmed metadata (dev backend, 2026-07-24)

| Edition | pages | pgoffset | pgfirstVerse | faxOffset |
|---|---|---|---|---|
| 1830 | 590 | 0 | 5 | −6 |
| 1837 | 621 | 0 | 7 | — |
| 1841 | 649 | 0 | 9 | — |
| 1879 | 623 | 8 | 1 | — |
| 1920 | 568 | 8 | — | −8 |
| 2013 | 536 | 9 | 1 | −9 |

## Finding 1 — page input ≠ URL (identity mismatch) — **SSoT violation**

- **URL route** (`FacsimilePageViewer.js:361`):
  `history.replace('/fax/${slug}/${targetPage.pageSlugLeaf}')` → **image-file #**.
- **Page input** (`FacsimilePageViewer.js:869`):
  `defaultValue={leftPage?.faxPageSlug}` and the jump form matches on
  `faxPageNum` (`:860`) → **printed folio**.
- **Slider aria** (`:843`) and **"Page X" label** (`:630`, `:632`) → **printed folio**.

**Evidence:** load `/fax/2013/50` → route says `50`, input box shows `58`
(`faxPageNum` of the even-left leaf; `50 → 49 + |−9| = 58`). Same on 1830:
route `50`, input `56` (`faxOffset −6`). Every edition with `faxOffset ≠ 0`
exhibits the gap; the size is `|faxOffset|` (± the left-page parity adjustment).

There is no single canonical page identity — surfaces pick whichever field their
author reached for. That is the SSoT violation the user observed.

## Finding 2 — `/ {item.pages}` denominator is the wrong domain — **SSoT violation**

`FacsimilePageViewer.js:868,873` uses `item.pages` (image-file **count**) as the
`max` and the "`/ N`" denominator, while the numerator in the same input is the
printed folio. "Folio 58 / 536 image-files" mixes two domains; on editions where
folio and image-file diverge, the denominator is simply the wrong scale.

## Finding 3 — per-page reference shifted by `pgoffset` — **BUG (defect)**

`Facsimiles.js:49`:

```js
const blankPageCount = pgoffset + pgfirstVerse - 1;
const pageIndex = [...Array(blankPageCount).fill([0,0]), ...pages];
```

`getRefFromIndex(pageIndex, i)` (`Facsimiles.js:23`) reads `pageIndex[i − 1]`
where `i = pageNumInt` (the **image-file number**). The first indexed tuple
`pages[0]` sits at `pageIndex[blankPageCount]` and must be returned for
image-file page `pgfirstVerse`, i.e. we need:

```
blankPageCount = pgfirstVerse − 1
```

But the code uses `pgoffset + pgfirstVerse − 1`. Front-matter leaves have `i ≤ 0`
and never reach real tuples (their `getRef` call indexes negatively → `[0,0]` →
null ref), so **`pgoffset` must not enter `blankPageCount` at all**. The extra
`pgoffset` shifts every content-page reference earlier by `pgoffset`.

- `pgoffset = 0` editions (1830/1837/1841): `blankPageCount` happens to be
  correct (`0 + pgfirstVerse − 1`), so refs are right — which is why the bug was
  invisible on 1830.
- `pgoffset > 0` editions (1879/1920/2013): refs shift by `pgoffset`.

**Evidence:** `/fax/2013/50` displays "1 Nephi 17:41-51", but the `/fax/boxes`
response for those verses reports `imagePage` **39–42**, not 50. `50 − 9 (pgoffset)
= 41` — the shown reference belongs ~9 pages earlier, exactly `pgoffset`.

**Fix:** `const blankPageCount = pgfirstVerse - 1;` (validated against the
correct 1830 case, which is unchanged).

## Finding 4 — verse inspector broken on front-matter editions (downstream of #3)

`useFaxVerses` derives the spread's verse ids from `leftPage.pageReference` (the
shifted ref), fetches boxes for those verses, then groups by the boxes'
`imagePage`. On a `pgoffset>0` edition the ref's verses map to a *different*
`imagePage` than the leaf's `pageNumInt`, so `versesByPage.get(pageNumInt)` is
empty → **no hotspots** (or hotspots attributed to the wrong page). Fixing
Finding 3 restores the inspector on 1879/1920/2013 with no inspector-side change.

## Recommendations

**Immediate (clear defect):** apply the Finding 3 one-line fix
(`blankPageCount = pgfirstVerse - 1`). This corrects references AND the inspector
on all front-matter editions; pgoffset=0 editions are provably unchanged.

**SSoT reconciliation (design decision) for Findings 1–2:** choose ONE canonical
page identity for all user-facing surfaces and convert only at the boundaries
that genuinely need the other:

- **Option A — image-file is canonical (recommended).** Page input, "Page X"
  label, slider aria, and denominator all use `pageSlugLeaf` / `pageNumInt` /
  `item.pages` — matching the URL and assets. `faxPageNum`/`faxPageSlug` become
  display-only annotations ("printed p. 58") if desired, never the primary number.
  Lowest risk: the URL is already image-file, roman front matter already routes
  by image-file slug, and `item.pages` already counts image files.
- **Option B — printed folio is canonical.** The URL route also carries the
  folio; routing converts folio→image-file to resolve assets, and the denominator
  becomes the folio count. Matches the physical book a reader holds, but adds a
  conversion layer at every route/asset boundary and complicates deep links.
- **Option C — keep both, but explicit.** Primary number = image-file everywhere
  (input + URL + denominator agree); show the folio as a secondary label. This is
  Option A plus a visible "printed p. N" hint.

Whichever is chosen, the denominator (Finding 2) must move to the same domain as
the numerator.

## Files

- `frontend/webapp/src/views/Facsimiles/Facsimiles.js:23` (`getRefFromIndex`), `:49` (`blankPageCount`)
- `frontend/webapp/src/views/Facsimiles/faxGeometry.js:37-68` (`buildLeafIndex`)
- `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:361` (URL), `:843` (slider aria), `:630/632` (label), `:854-873` (page-input + jump form)
