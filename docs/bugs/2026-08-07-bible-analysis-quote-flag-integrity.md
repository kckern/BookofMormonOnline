# Bug: Bible Cross-Reference Quote-Flag Integrity

**Date:** 2026-08-07  
**Related audit:** [docs/audits/2026-08-07-bible-analysis-ux-rebuke.md](../audits/2026-08-07-bible-analysis-ux-rebuke.md)

---

## Symptom

The design review noted that the Bible cross-reference Reader header claims a high "N quotes" count for
certain book pairs, yet the sacrament-prayer parallels — the most famous direct-quotation parallels in
the Book of Mormon — render with no QUOTE badge and no highlight. Moroni 4 and Moroni 5 are the sacrament
prayers; their closest Bible parallels are 1 Corinthians 11:24–25 (Paul's institution narrative) and
Matthew 26:26–28 / Luke 22:19–20 (the Last Supper accounts). A human reviewer would classify these as
direct quotations.

---

## Method

A throwaway Node script (run from `/tmp`, not committed) required `data.js` via CommonJS and
`scripture-guide`'s `generateReference` to resolve verse ids. All probes ran against the current
`feat/bible-analysis-ux-fixes` working tree.

**Verse-id ranges resolved:**

| Reference | Vid range |
|---|---|
| Moroni (whole book) | 37544–37706 |
| Moroni 4:1–3 | 37555–37557 |
| Moroni 5:1–2 | 37558–37559 |
| Matthew 26:26–28 | 24081–24083 |
| Luke 22:19–20 | 25884–25885 |
| 1 Corinthians 11:24–25 | 28625–28626 |

---

## Findings

### 1. Moroni 4–5 rows that exist in the index

Four rows touch Moroni 4 or Moroni 5:

| bomVid | bibleVid | isQuote | BoM ref | Bible ref |
|---|---|---|---|---|
| 37557 | 28625 | **0** | Moroni 4:3 | 1 Corinthians 11:24 |
| 37559 | 28626 | **0** | Moroni 5:2 | 1 Corinthians 11:25 |
| 37557 | 34 | 0 | Moroni 4:3 | Genesis 2:3 |
| 37559 | 34 | 0 | Moroni 5:2 | Genesis 2:3 |

The 1 Corinthians 11:24–25 pairings (the direct institution-of-the-sacrament parallels) are present in
the index but flagged `isQuote=0`.

### 2. Sacrament parallels via Matthew and Luke are absent

No rows in the index link Moroni 4 or Moroni 5 to Matthew 26:26–28 or Luke 22:19–20. Those five
Bible verse ids (24081, 24082, 24083, 25884, 25885) are paired only with 3 Nephi verses:

| bomVid | bibleVid | isQuote | BoM ref | Bible ref |
|---|---|---|---|---|
| 36527 | 24081 | 0 | 3 Nephi 18:3 | Matthew 26:26 |
| 36602 | 24081 | 0 | 3 Nephi 20:3 | Matthew 26:26 |
| 37705 | 24083 | 0 | Moroni 10:33 | Matthew 26:28 |
| 36535 | 25884 | 0 | 3 Nephi 18:11 | Luke 22:19 |
| 36535 | 25885 | 0 | 3 Nephi 18:11 | Luke 22:20 |

All five are also flagged `isQuote=0`.

### 3. The "48 quotes" header is internally consistent — and points at the right pair

The Moroni × 1 Corinthians pair is what shows "56 total · 48 quotes" in the Reader header.
That count is correct: the index does contain 56 rows pairing Moroni with 1 Corinthians, and 48 of
them have `isQuote=1`. These are the spiritual-gifts parallels (1 Cor 12–13) where the flag is
mostly set correctly. The header is *not* computing a different quantity from the badges — both
`quoteTotal` and the QUOTE badge are derived from the same `isQuote` boolean (Reader.jsx line 40 and
line 178 respectively). The header count and the badge count are architecturally consistent.

The discrepancy seen in the review is therefore:

- **Header says "56 total · 48 quotes"** for Moroni × 1 Corinthians — correct for the 1 Cor 12–13
  block, which is legitimately quote-heavy.
- **The two sacrament rows (Moroni 4:3 ↔ 1 Cor 11:24 and Moroni 5:2 ↔ 1 Cor 11:25) appear in that
  same pair scope** but carry `isQuote=0`, so they render as phrase rows with no badge.

### 4. Full Moroni quote summary

| Scope | Total rows | isQuote=1 | isQuote=0 |
|---|---|---|---|
| Moroni (all) | 162 | 56 | 106 |
| Moroni × 1 Corinthians | 56 | 48 | 8 |
| Moroni 4–5 (all pairs) | 4 | **0** | 4 |

---

## Root Cause

**Failure mode (a) only — data flag wrong in `data.js`.**

The `isQuote` flag for Moroni 4:3 ↔ 1 Cor 11:24 and Moroni 5:2 ↔ 1 Cor 11:25 is `0` when it should
be `1`. These two verses record the Nephite sacrament prayers, which verbatim quote (or are directly
quoted by) Paul's institution narrative. A human reviewer and any standard quote-detection pipeline
would classify them as direct quotations.

Failure mode (b) (highlight-string mismatch masking a correct flag) does **not** apply here. The QUOTE
badge in Reader.jsx is driven purely by `isQuote` (line 40: `pairs.filter(p => p.isQuote).length`;
line 178: `{isQuote && <span className="xref-quote-badge">QUOTE</span>}`). The Task 12 highlighter
hardening affected only the highlight spans inside the cell, not badge display. Even with a perfect
highlighter, these rows would render as phrases because the flag is `0`.

The header/badge reconciliation confirms no code bug: both consume the same `isQuote` source. The
mismatch is purely upstream in the data file.

---

## Recommended Fix

**Owner:** whoever controls the data-generation pipeline for `data.js` (the cross-reference index).

**Action:** Regenerate `data.js` with corrected `isQuote` flags. At minimum, the following two rows
need the flag flipped from `0` to `1`:

```
[37557, 28625, 1],   // Moroni 4:3 <-> 1 Corinthians 11:24
[37559, 28626, 1],   // Moroni 5:2 <-> 1 Corinthians 11:25
```

Additionally, the 3 Nephi 18 ↔ Matthew/Luke sacrament rows (five pairs listed above) and the
Moroni 10:33 ↔ Matthew 26:28 row all have `isQuote=0` and should be reviewed — they may also warrant
`isQuote=1` depending on the quoting criterion used.

**File:** `frontend/webapp/src/views/Analysis/Bible/data.js`  
**No changes to Reader.jsx, aggregate.js, or highlighter.jsx are needed** — the rendering pipeline
correctly follows the flag.
