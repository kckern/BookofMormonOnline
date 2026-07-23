# Fax render: stray bounding boxes (duplicate-region box data)

**Date:** 2026-07-23
**Trigger:** `/fax/render/1981/crop/w800/alma-10.24.jpg` shows a stray block of text below the correct verse. Compared against the 2013 edition (correct).

## Symptom

`crop` render of **Alma 10:24 (1981)** stacks two fragments:

1. The correct verse 24 ("And now it came to pass that the people were more angry with Amulek…whom we have selected.")
2. A **stray block** = the tail of verse 25 ("…perverse generation, why hath Satan got such great hold upon your hearts?…according to their truth?")

The 2013 render of the same verse is clean (single fragment).

## Root cause — data, not code

The render pipeline (`backend/src/media/fax/render.ts`) faithfully draws whatever boxes `bom_xtras_fax_index` hands it. The defect is in that table.

For 1981, Alma 10:24 (`verse_id 33882`) and Alma 10:25 (`verse_id 33883`) each carry a box at the **top of page 243, column 1** that is essentially the same rectangle:

| verse | ref | page | X | Y | W | H |
|---|---|---|---|---|---|---|
| 33882 | Alma 10:24 | 243 | 76 | 68 | 265 | 120 |
| 33883 | Alma 10:25 | 243 | 77 | 68 | 265 | 120 |

That region physically holds verse 25's continuation. Verse 25 renders correctly *with* it; verse 24 is already complete in its page-242 col-2 box (`356,605 265x89`). So **verse 24's page-243 box is the stray** — a duplicate of verse 25's continuation box, off by 1px in X (76 vs 77), which is why an exact-match dedupe missed it.

The exact-match `X,Y,W,H` was `76` vs `77` — near-identical, not identical.

## Is it detectable automatically? Mostly yes.

This bug class — **two verses claiming the same physical rectangle** — is fully detectable by a geometric self-join, no rendering needed:

```sql
SELECT a.version, a.verse_id v1, b.verse_id v2, a.page, a.X, a.Y, a.W, a.H
FROM bom_xtras_fax_index a
JOIN bom_xtras_fax_index b
  ON a.version=b.version AND a.page=b.page AND a.verse_id<b.verse_id
 AND ABS(a.X-b.X)<=5 AND ABS(a.Y-b.Y)<=5 AND ABS(a.W-b.W)<=5 AND ABS(a.H-b.H)<=5
ORDER BY a.version, a.verse_id;
```

Corpus-wide this flags **26 pairs**. 25 are adjacent `(v, v+1)` — the continuation-box duplication signature. All flagged pairs (2026-07-23):

- **1829** (7): Mosiah 17:3/4, Alma 11:9/10, Alma 45:2/3, Ether 1:8/9, 1:13/14, 1:17/18, 1:30/31
- **printer** (7): same set as 1829 (Mosiah 17:3/4, Alma 11:9/10, Alma 45:2/3, Ether 1:8/9, 1:13/14, 1:17/18, 1:30/31)
- **1981** (3): 2 Nephi 26:32/33, **Alma 10:24/25**, **3 Nephi 6:28/29**
- **poetic** (3): 2 Nephi 2:27/28, Alma 55:34/35, 4 Nephi 1:29/30
- **rebom** (2): 1 Nephi 16:9/10, 16:10/11
- **earliest** (2): 2 Nephi 3:3/4, 2 Nephi 6:17/18
- **1840** (1): 1 Nephi 3:10/11
- **2013** (1): **Mosiah 29:7 ↔ 29:13 — NON-adjacent (gap 6)**, a different anomaly (likely a mistyped verse_id, not a continuation duplicate). Worth a separate look.

Confirmed by render: 1981 Alma 10:24 and 3 Nephi 6:28 both show the stray next-verse block.

### Which of the pair is the stray? Heuristic + spot-check.

The shared rectangle is a **page/column-top continuation box** and belongs to the verse that *flows into* it — in every 1981 case examined, the **later verse** (v2). The **earlier verse** (v1) holds the stray copy and is already complete without it. This is a strong heuristic but only ~26 cases exist corpus-wide, so each can be confirmed by a one-off render before deletion.

## What geometry can NOT catch

A box with simply *wrong* coordinates that doesn't happen to overlap a neighbor won't be flagged. Catching that general class requires **content validation**: render each verse's box(es) → OCR → fuzzy-match against the canonical verse text from `scripture-guide`, flag low-similarity boxes. That is automatable (a batch OCR sweep) but heavier than the geometric check, and would also catch page-offset errors and misalignments. Recommended as a follow-up sweep, not required to fix the duplicates above.

## Proposed fix (NOT yet applied — needs authorization; production data)

Delete the stray row from the earlier verse in each confirmed pair. For the two rendered-confirmed 1981 cases:

```sql
DELETE FROM bom_xtras_fax_index
 WHERE version='1981' AND verse_id='33882' AND page=243 AND X=76 AND Y=68 AND W=265 AND H=120; -- Alma 10:24 stray
DELETE FROM bom_xtras_fax_index
 WHERE version='1981' AND verse_id='36211' AND page=429 AND X=77 AND Y=65 AND W=265 AND H=109; -- 3 Nephi 6:28 stray
```

The remaining 24 pairs should each be render-confirmed (which verse owns the shared box) before deleting. The 2013 non-adjacent case (Mosiah 29:7↔29:13) needs separate diagnosis.

**No data was mutated during this audit** — dev connects read-mostly and box-index rows are production data.
