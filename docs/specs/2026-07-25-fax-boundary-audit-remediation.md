# Fax Boundary Audit and Deterministic Remediation

**Date:** 2026-07-25  
**Status:** Technical design validated by a read-only prototype on a real 1852 subset  
**Scope:** `1842`, `1849`, `1852`, `1854`, `1854l`, `1866`, `1871`, `1874`, `1877`  
**Non-goal:** No per-verse LLM vision and no fabricated geometry for pages without OCR.

## 1. Outcome

Build a repeatable, LLM-free pipeline that:

1. detects verse crops that lose canonical text, leak neighboring text, retain false page-break
   notches, or cut a glyph;
2. derives a proposed correction from canonical text, cached OCR, and the edition's own scan pixels;
3. automatically applies only high-confidence, locally bounded changes;
4. emits an evidence ledger, forward SQL, rollback SQL, and a post-load exact comparison;
5. sends ambiguous cases to a compact human review queue.

The pipeline must audit the whole corpus. The reported verses are regression fixtures, not special
cases in production code.

## 2. Why the current checks are insufficient

The current geometry audit measures ink on polygon edges. That catches many horizontal/vertical cuts
but cannot establish which word belongs to which verse. The current whitespace snapper searches a
pixel window for a gap, but it may choose:

- an inter-letter gap instead of an inter-word gap;
- the wrong occurrence of a common word such as `and`;
- a gap belonging to another verse on the same line;
- a false continuation row on the next page;
- a geometrically clean boundary around semantically wrong content.

The durable rule is:

> Canonical/OCR alignment determines *which token boundary* is correct. Pixels refine the position
> only within that token boundary's bounded whitespace interval.

## 3. Inputs and coordinate systems

### 3.1 Required sources

| Source | Purpose |
|---|---|
| `bom_xtras_fax_index` or candidate SQL | Current box and notch geometry |
| `lds_scriptures_verses` | Canonical verse token stream |
| `scripts/out/ocr-cache/{version}/{page}.json` | OCR text and line boxes |
| `fax/pages/{version}/{page}.{format}` | Pixel-level word-gap and glyph checks |
| `bom_xtras_fax` | Scan format and edition metadata |

No production repair may use another edition's pixel coordinates. Cluster editions may share
semantic decisions, but every proposed coordinate must be re-derived and verified against that
edition's own scan.

### 3.2 Coordinate conversion

Stored geometry uses a `pageScale`-wide coordinate system, normally 700:

```text
pixelScale = actualImageWidth / pageScale
pixelX     = storedX * pixelScale
pixelY     = storedY * pixelScale
```

Gemini line boxes are `[ymin,xmin,ymax,xmax]` in thousandths:

```text
linePixelX = x / 1000 * imgW
linePixelY = y / 1000 * imgH
lineNormX  = linePixelX / imgW * pageScale
lineNormY  = linePixelY / imgW * pageScale
```

Every stage works in actual image pixels and converts back to stored units only when emitting a
proposal. Rounding happens once, at emit time.

## 4. Canonical and OCR tokenization

Tokenization must preserve raw character offsets and normalized lexical values.

### 4.1 Required normalization

- lowercase;
- normalize ligatures and long-s forms;
- split punctuation, em dash, and en dash as boundaries;
- preserve apostrophes within words;
- keep raw start/end offsets;
- join end-of-line hyphenation only when canonical alignment supports the join;
- tolerate documented edition variants with a bounded fuzzy match.

Consequently:

```text
people.—Wherefore,
```

produces two lexical tokens, `people` and `wherefore`, even though it is one whitespace-delimited
string.

### 4.2 Match scoring

Use weighted local sequence alignment:

```text
exact token                    +3
edit distance 1, length >= 5   +1
singular/plural edition variant +1
mismatch                       -2
gap                            -1
rare/distinctive token bonus   +IDF
```

The matching window may span line and page boundaries. Common tokens such as `and`, `yea`, and
`behold` are never sufficient by themselves to establish a boundary.

## 5. Page and verse alignment

Each OCR page is aligned independently to the canonical Book of Mormon stream, retaining the
stateless relabeler's no-drift property.

For every OCR token, retain:

```ts
interface AlignedToken {
  version: string;
  page: number;
  lineIndex: number;
  raw: string;
  normalized: string;
  canonicalVerseId: number | null;
  canonicalTokenIndex: number | null;
  matchScore: number;
  rawCharStart: number;
  rawCharEnd: number;
}
```

The output is a page token map, not a box. It records where each verse begins and ends on each line.

Alignment gates:

- at least three ordered anchors for an automatic semantic assignment;
- no page-order inversion;
- no assignment outside the neighboring confirmed page range;
- one-token line fragments may inherit a boundary only from a multi-token alignment spanning the
  adjacent line;
- headings, running headers, folios, and chapter labels remain unassigned.

## 6. Deriving word gaps from pixels

Gemini supplies line boxes rather than word boxes. Word gaps must therefore be reconstructed from
the edition scan.

### 6.1 Image preprocessing

For each OCR line:

1. crop the line box with a small vertical margin;
2. estimate paper and ink levels from robust page quantiles;
3. apply adaptive thresholding;
4. remove isolated speckle components below the edition-calibrated area threshold;
5. compute connected components and a vertical ink projection.

### 6.2 Gap candidates

A candidate gap is a contiguous x interval whose vertical ink density is below the page threshold.
Record:

```ts
interface PixelGap {
  leftPx: number;
  rightPx: number;
  centerPx: number;
  widthPx: number;
  meanInk: number;
  leftComponentDistance: number;
  rightComponentDistance: number;
}
```

Do not simply choose the widest gap in a search radius. Map all lexical word boundaries on the line
to pixel gaps with monotone dynamic programming:

```text
cost =
  3.0 * normalized distance from lexical estimate
  + 4.0 * mean gap ink
  + 2.0 * narrow-gap penalty
  + 8.0 * component-intersection penalty
```

The mapping must preserve token order. This prevents a nearby wide gap belonging to another word
from winning.

### 6.3 Safe boundary

The proposed boundary is the center of the mapped whitespace run. Its safe interval excludes the
outer two pixels, or one third of the run for very narrow gaps.

A boundary is a hard failure if:

- it intersects a connected ink component;
- it lies outside the safe interval;
- it lies between components belonging to one OCR token rather than between two aligned tokens.

The third rule catches a cut between the `A` and `n` of `And`, even when that inter-letter column is
locally white.

## 7. Expected polygon construction

For each `(version, verse_id, page)` fragment, derive the expected first and last token represented
on that page.

### 7.1 Top-left notch

A top-left notch exists only when non-verse text precedes the verse's first token on the same OCR
line.

```text
TL boundary = mapped gap immediately before first verse token
TLW         = boundaryX - X
TLH         = first-line band height
```

If the verse is a page continuation and its first token starts at the line's left text margin,
`TLW=TLH=0`.

### 7.2 Bottom-right notch

A bottom-right notch exists only when another verse begins after this verse's final token on the
same OCR line.

```text
BR boundary = mapped gap immediately after final verse token
BRW         = X + W - boundaryX
BRH         = last-line band height
```

If the verse continues on the next page and no next-verse token follows on the current line,
`BRW=BRH=0`.

The next verse's first word is accepted only when it follows a matched suffix of the current verse.
The mere presence of a common word such as `and` is not evidence.

### 7.3 Outer band

`X/Y/W/H` is the union of the aligned verse line regions plus edition-calibrated whitespace margins.
It is not inferred from neighboring verse IDs alone.

## 8. Whole-crop content audit

Edge checks alone are not sufficient. Rasterize the stored polygon and extract all OCR tokens whose
glyph components intersect the included area.

Align the extracted crop token stream to the canonical verse and record:

```ts
interface CropContentMetrics {
  canonicalCoverage: number;
  cropPrecision: number;
  prefixTokensMissing: number;
  suffixTokensMissing: number;
  prefixTokensLeaked: number;
  suffixTokensLeaked: number;
  duplicateCanonicalTokens: number;
}
```

Hard failures:

- any missing first or last canonical token;
- any neighboring-verse token included before or after the canonical span;
- a continuation fragment that contributes no new canonical tokens;
- repeated canonical tail tokens caused by a stale extra page fragment;
- overlapping same-verse fragments that duplicate visible text.

This stage catches errors that look geometrically clean, including:

- a stray continuation word on the next page;
- a second box containing the beginning of the following verse;
- a crop that retains the previous line;
- a partly erased first word whose OCR centroid still lies inside the polygon.

## 9. Audit findings and confidence

Every finding is immutable evidence:

```ts
interface FaxBoundaryFinding {
  runId: string;
  version: string;
  verseId: number;
  page: number;
  code:
    | 'TOKEN_INTERIOR_BOUNDARY'
    | 'TL_NOT_IN_EXPECTED_WORD_GAP'
    | 'BR_NOT_IN_EXPECTED_WORD_GAP'
    | 'FALSE_TL_PAGE_CONTINUATION_NOTCH'
    | 'FALSE_BR_PAGE_CONTINUATION_NOTCH'
    | 'MISSING_SAME_LINE_NOTCH'
    | 'CONTENT_PREFIX_LOSS'
    | 'CONTENT_SUFFIX_LOSS'
    | 'CONTENT_PREFIX_LEAK'
    | 'CONTENT_SUFFIX_LEAK'
    | 'DUPLICATE_CONTINUATION_FRAGMENT'
    | 'GEOMETRY_BOUNDS'
    | 'LOW_ALIGNMENT_CONFIDENCE';
  severity: 'error' | 'warning';
  confidence: number;
  currentGeometry: Geometry;
  proposedGeometry: Geometry | null;
  canonicalAnchors: string[];
  ocrLines: string[];
  pixelMetrics: PixelMetrics | null;
  sourceDigests: SourceDigests;
}
```

### 9.1 Automatic repair tier

An automatic repair requires all applicable gates:

- semantic anchor score above threshold;
- unique ordered canonical boundary;
- mapped pixel gap;
- no protected glyph component in the proposed notch;
- proposed change remains within one line height and one mapped word gap;
- post-repair crop has zero boundary token loss/leak;
- no key, ordering, or geometry invariant regresses.

### 9.2 Review tier

Do not auto-repair:

- ambiguous OCR variants;
- headings or marginalia inside the box;
- fewer than three canonical anchors;
- no unique pixel gap;
- a proposal that changes page membership;
- a proposal that moves an outer box edge by more than one line height;
- missing OCR or missing scan pixels.

These rows get a generated before/after evidence strip for human review. No LLM is required.

## 10. Statistical audit layer

Statistics rank risk; they never override semantic evidence.

Compute per edition and per page:

- notch width / line width;
- notch residual from mapped whitespace center;
- distance to nearest ink component;
- edge ink density;
- canonical coverage and crop precision;
- fragments per verse;
- page span per verse;
- overlap/duplicate-token count;
- page-order inversions.

Use median and median absolute deviation rather than global standard deviation. Flag:

```text
abs(value - median) / (1.4826 * MAD) >= 5
```

Cross-edition agreement may raise priority when the same semantic boundary class disagrees across
plate mates, but coordinates are still measured independently.

## 11. Remediation ledger and SQL

Do not use a full-edition `DELETE + INSERT` for routine boundary repair. Emit optimistic, targeted
updates:

```sql
UPDATE bom_xtras_fax_index
SET TLW=?, TLH=?, BRW=?, BRH=?
WHERE version=? AND verse_id=? AND page=?
  AND TLW=? AND TLH=? AND BRW=? AND BRH=?;
```

The old-value predicate prevents silently overwriting a row changed after the audit.

Deleting a stale continuation fragment requires:

- high-confidence content evidence;
- a rollback insert in the same artifact;
- an expected affected-row count of exactly one.

Each run emits:

```text
audit.json
audit-summary.md
repair-forward.sql
repair-rollback.sql
review/index.html
review/*.png
source-manifest.json
```

## 12. Post-remediation verification

The verifier runs against the candidate SQL and again against the live DB:

1. exact key-set comparison;
2. exact row-value comparison;
3. geometry bounds and positive area;
4. no duplicate `(version,verse_id,page)` keys;
5. monotone page/verse ordering;
6. zero protected-component boundary intersections;
7. zero automatic-tier crop prefix/suffix loss or leakage;
8. unchanged rows remain byte-for-byte unchanged;
9. all regression fixtures pass;
10. API render check bypasses or invalidates immutable cached images.

The API/CDN cache key must include a geometry revision or be purged after a successful load.
Otherwise a repaired DB can continue serving an old crop.

## 13. Rollout

1. Implement and calibrate on `1852`.
2. Human-label a stratified 1852 set:
   - all known regressions;
   - 100 high-confidence findings;
   - 100 medium-confidence findings;
   - 100 unflagged controls;
   - all multipage verses in the sample.
3. Require:
   - 100% regression-fixture recall;
   - at least 99% precision for automatic repairs;
   - no false negative in the 100 unflagged controls;
   - zero geometry and content invariant failures after repair.
4. Apply targeted 1852 SQL and verify the live DB/API.
5. Run `1849` and `1842` independently.
6. Run each cluster member against its own scan. Shared semantic findings may seed the run, but
   scaled seed notches are prohibited.
7. Leave `1858`, `1899`, and `1902` outside this rollout until their OCR coverage is ready.

## 14. Proposed implementation

```text
backend/scripts/fax-boundary-audit.mts
backend/scripts/fax-boundary-remediate.mts
backend/scripts/fax-boundary-verify.mts
backend/test/fixtures/fax-boundary-regressions.json
docs/audits/fax-boundary/{run-id}/
```

CLI:

```bash
npx tsx scripts/fax-boundary-audit.mts \
  --version 1852 \
  --source live \
  --ocr-root /path/to/ocr-cache \
  --out ../docs/audits/fax-boundary/1852-run

npx tsx scripts/fax-boundary-remediate.mts \
  --audit ../docs/audits/fax-boundary/1852-run/audit.json \
  --tier automatic \
  --out ../docs/sql/fax-boundary-1852.sql

npx tsx scripts/fax-boundary-verify.mts \
  --version 1852 \
  --sql ../docs/sql/fax-boundary-1852.sql
```

Audit and verification are read-only. Applying SQL remains a separate explicit action.

## 15. Real-data validation spike

Prototype:

- `backend/scripts/fax-boundary-audit-prototype.mts`
- `docs/audits/fax-boundary-audit-1852-subset.json`

Run:

```bash
npx tsx scripts/fax-boundary-audit-prototype.mts \
  --version 1852 \
  --sample 36 \
  --seed 20260725 \
  --ocr-root /Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache \
  --out ../docs/audits/fax-boundary-audit-1852-subset.json
```

Observed:

| Measure | Result |
|---|---:|
| Geometry rows inspected | 57 |
| Distinct real scan pages | 54 |
| Distinct verses content-audited | 42 |
| Explicit boundary assertions | 6/6 passed |
| Explicit crop-content assertions | 5/5 passed |
| Random/control rows flagged | 25/50 |
| High-confidence random/control rows | 18/50 |
| Crop-content findings | 7/42 verses |

The assertions cover:

- punctuation/em-dash boundary retained correctly (`1 Nephi 9:4`);
- clipped first word detected (`Mosiah 15:9`);
- false page-end notch detected (`Alma 45:15`);
- corrected continuation geometry retained (`3 Nephi 12:2`);
- next-word glyph cut detected (`3 Nephi 15:1`);
- cross-line first-word cut detected (`Jacob 5:20`);
- stale duplicate continuation detected (`1 Nephi 18:14`);
- neighboring-verse continuation detected (`2 Nephi 4:26`);
- three visually reviewed clean controls retained.

The spike also demonstrated why both audit layers are mandatory: edge-only logic missed stale extra
fragments, while token-centroid content logic initially missed a partial `A` cut. Cross-line lexical
alignment plus component-aware gap validation closes those classes in the design.

The prototype is evidence for the architecture, not authorization to emit remediation SQL. It still
uses approximate token placement in several paths. Production automatic repair remains gated on the
connected-component token map and the labeled calibration set in §13.

## 16. Full OCR-backed execution

The prototype was then run over every cached OCR page and every live geometry row for the three
editions with independent OCR caches:

| Edition | Rows | Pages | Verses | Flagged rows | Crop-content findings |
|---|---:|---:|---:|---:|---:|
| 1842 | 5,015 | 394 | 4,735 | 3,359 | 737 |
| 1849 | 6,530 | 519 | 6,065 | 3,946 | 760 |
| 1852 | 6,528 | 519 | 6,052 | 4,185 | 743 |

The repair emitter includes only structurally provable false notches, gross token-boundary cuts,
the validated regression fixtures, and two stale continuation fragments confirmed by crop-content
alignment. It emits:

- 1,484 updates for 1842;
- 2,410 updates and 2 deletes for 1849;
- 1,863 updates and 2 deletes for 1852.

The generated SQL was checked against the live rows without writing: all 5,757 optimistic old-value
predicates currently match, all 4 delete targets currently match, and all proposed notch dimensions
remain within their bands. The six cluster editions are deliberately excluded from this SQL because
they do not have independent OCR/token evidence; their repairs require an edition-native scan pass.
