# Fax hotspots don't render on offset≠0 editions — boxes keyed by folio, looked up by scan page

**Date:** 2026-07-25
**Status:** Root cause confirmed (live). No fix applied. Separate from — and independent of — the
sparse/dense drift fixed in `docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md`.
**Scope:**
- `backend/src/media/fax/route.ts:160-165` — `/fax/boxes` tags `imagePage: b.page + meta.offset`
- `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:445, 723` — `versesByPage.get(page.pageNumInt)`
- `frontend/webapp/src/views/Facsimiles/faxVerseData.js:35-44` — `mergeBoxes` keys by `imagePage`

## Symptom

On any fax edition with a non-zero printed-folio offset, the desktop spread renders **zero verse
hotspots**, even though the correct page reference resolves in the header. Confirmed on:

| Edition | offset | `/fax/…` checked | hotspots |
|---|---|---|---|
| 1837 | −4  | `/fax/1837/50`  | 0 (refs correct: "1 Nephi 17:5-17") |
| rebom | −26 | (offset≠0)      | blocked |
| poetic | −47 | (offset≠0)     | blocked |

Editions with **offset 0** render hotspots correctly (e.g. `/fax/1871/24` → 35, `/fax/1842/100`
→ 63), which is why this hid behind the sparse/dense drift bug until that was fixed.

## Root cause: two different page numbers on the two sides of the box join

The verse-overlay join matches boxes to the rendered leaf by page number, but the two sides use
**different** page-numbering schemes when `offset ≠ 0`:

1. **Box side** (`route.ts:162`): `imagePage = b.page + meta.offset`. For 1837 (offset −4), the
   boxes for page-50 verses (`b.page` = 49/50) are tagged `imagePage = {45, 46}`.
2. **Leaf side** (`FacsimilePageViewer.js:723`): `versesByPage.get(page.pageNumInt)` where
   `pageNumInt` is the scan image-file number (the route slug) — `{49, 50}` for `/fax/1837/50`.

So `versesByPage` is keyed `{45, 46}` while the lookup asks for `{49, 50}` → empty → zero hotspots.
When `offset = 0` the two schemes coincide and it works.

### Evidence (live, 1837)

```
GET /fax/boxes/1837/ids/31542-…-31552   →   pageScale 700, boxCount 12,
                                            distinct imagePage tags: [45, 46]
```

`faxIndex(1837).offset = -4`; page 50 (index 49) first verse = 31542; header ref = "1 Nephi 17:5".
The boxes exist and return, but their `imagePage` (45/46) can't meet the viewer's `.get(50)`/`.get(49)`.

## Why this is independent of the sparse/dense drift fix

The drift fix (`…-index-drift.md`) only changed how `pageIndex` / `getRefFromIndex` resolve a page's
verse **range**. This bug is downstream of that: the range resolves correctly (refs are right), the
boxes fetch correctly, but the **key** used to group boxes (`imagePage`) doesn't match the **key**
used to look them up (`pageNumInt`). None of `route.ts`, `mergeBoxes`, or the `versesByPage.get`
call was touched by the drift fix.

## Fix direction (not yet applied)

Make both sides of the join agree on one page number. Options:

1. **Stop offsetting the box key.** If `pageNumInt` (scan image-file number, the route slug) is the
   canonical page — as `faxGeometry.js:46-52` asserts it is — then `/fax/boxes` should tag boxes by
   the raw scan page (`b.page`), not `b.page + offset`. Verify what `b.page` actually holds (scan
   file number vs printed folio) before flipping; `meta.offset` may be needed for the scan *fetch*
   (`render.ts` uses `p + offset` to read the image file) but not for the DOM-overlay key.
2. Alternatively, have the viewer look up `versesByPage.get(pageNumInt - offset)` — but pushing the
   offset into the consumer reintroduces the per-edition foot-guns the SSoT audit warns about;
   option 1 (one canonical key) is cleaner.

Validate against offset 0 (1871 — must stay working), offset −4 (1837), and the large offsets
rebom (−26) / poetic (−47).

## Verse straddle note

A verse spanning a page break legitimately appears under two `imagePage` keys (`mergeBoxes` supports
this). The fix must preserve that — only the offset applied to the key is wrong, not the
one-verse-two-pages grouping.
