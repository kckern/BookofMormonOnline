# ATV body-apparatus parse scan — 2026-07-28

Full-corpus scan of **every** textual-variant apparatus instance — both the
`<div class='source'>` header blocks and the inline prose-body `[…]` units — to
confirm each parses, catching whitespace/OCR corruption that would foul up the
parser. Complements the header-only `corpusRegression.test.js` (which parses
only the first `.source` block per row).

## Method

For all 4,528 `bom_xtras_commentary` rows carrying an apparatus block: scan every
top-level bracket group in the full text; treat any bracket containing `|` as an
*intended* variation unit; flag "near-misses" — pipe-brackets that fail the
apparatus grammar (`isApparatus`: ≥2 `|`-parts, every part ending in valid sigla
`0 1 A–T`). Separately, run `parseApparatus` over the full text and flag any
parser throw or any correction code with no gloss.

Scan harness: a throwaway `_bodyscan.test.js` gated on `ATV_CORPUS` (not
committed; the corpus is copyrighted). Reproduce by dumping the corpus per the
`corpusRegression.test.js` header and pointing `ATV_CORPUS` at it.

## Results

```
entries=4528  pipeBrackets=8358  parsedUnits=8345
throws=0      unglossedCodes=0   nearMiss=13
```

Clean across the board except the 13 near-misses. Of those, **9 are legitimate
prose/table notation** — inline letter-level ambiguity written as `[x|y]`, which
correctly renders as text, not a unit:

| Entry | Notation | Meaning |
| --- | --- | --- |
| 1023516101 | `b[a\|o]re` | ambiguous scribal a/o in "bare/bore" |
| 1052416104 | `Zeno[k\|h]` (table) | Zenock/Zenoch spelling |
| 1401716401 | `Pa[r\|s]horon`, `Pahor[a\|u]n`, `[P\|p]` (table) | Parhoron/Pahoran letters |
| 1167516202 | `ch[o\|u]se` | ambiguous o/u in "chose/choose" |

These are correct as-is (no witnesses → not variation units). No action.

## Malformed units (4 instances, 3 entries)

### 1514716501 — 3 Nephi 1:29 — FIXED (logically forced)
`[<em>were</em> &gt;+ <em>was</em> &gt; NULL &gt; <em>was</em> |<em>was</em> ABCDEFGHIJKLMNOPQRST]`
First reading (a Printer's-Manuscript correction chain) lost its trailing
siglum, so the whole bracket renders as raw text. The entry's own parenthetical
names the witness: *"3 Nephi 1:29 (initial were in 𝒫 later corrected to was)"* —
𝒫 = Printer's Manuscript = siglum **1**. Both `.source` header units of this
entry read `[were >+ was 1|was A-T]`, and reading two carries no `0`, so 𝒪 is not
extant here. **Fix: insert `1`.** Confidence: HIGH. Applied in
`sql/2026-07-28-atv-body-parse-repairs.sql` (private workspace repo).

### 1010716101 — 1 Nephi 4:33 — DEFERRED (editorial)
`[<em>in</em> 01ABCDEFGHIJKLMNOPQRST|<em>into</em> ]`
Not a siglum error. The prose states *all* witnesses (0, 1, A–T) read "in";
"into" is Skousen's **conjectural emendation with no witness**. The `in` side is
already complete; "into" cannot take a siglum without fabricating attestation.
The schema has no representation for a witness-less critical-text emendation.
Needs an editorial decision: render as prose, or add an explicit emendation
convention. No mechanical fix proposed.

### 1328116401 — Alma 27:3 area ("sealed up") — DEFERRED (needs printed volume)
`[up 2345| 16A78BCDEFGHIJKLMNOPQRST]` and `[ 2345|up 16A78BCDEFGHIJKLMNOPQRST]`
OCR digit corruption: `2345` / `16A78` contain digits 2–8, never valid sigla.
Best-effort reads `16A78BCD…` as `1ABCD…` (drop stray 6/7/8), matching the clean
sibling `[up 0| 1ABCDEFGHIJKLMNOPQRST]` — but `2345` leaves no valid siglum, and
the two occurrences place "up" on opposite sides, so no single mapping
reconstructs both. The entry's prose cites "volume 1 of the critical text";
correct sigla require it. Best-effort statements are recorded (commented, NOT
applied) in the SQL file.

## Code verdict

No code change. The parser is behaving correctly — it rejects malformed input and
degrades to text rather than throwing. Every issue found is **data** (dropped
siglum, conjectural emendation, OCR corruption), not parser logic.
