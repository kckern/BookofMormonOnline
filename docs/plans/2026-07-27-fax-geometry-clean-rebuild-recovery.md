# Fax Geometry Clean-Rebuild Recovery Plan

**Date:** 2026-07-27  
**Status:** Execution plan; no production write is authorized by this document  
**Primary objective:** Reconstruct trustworthy facsimile verse geometry from
source-line ownership, validate it exhaustively in a local shadow database, and
produce one guarded production replacement only after all acceptance gates pass.

## 1. Why this plan exists

The current remediation process has mixed several distinct problems:

- verse labels attached to the wrong text;
- missing page or verse coverage;
- incorrect first- or last-line ownership;
- word-boundary notches applied to the wrong physical line;
- whitespace snapping that crossed a word boundary;
- family geometry copied or affine-transformed onto the wrong line;
- page/column continuation fragments with nonsensical exterior notches;
- valid source defects incorrectly treated as geometry defects;
- old SQL artifacts mistaken for the current shadow state;
- warnings and unresolved QA failures treated as completion.

The concrete `1854/1.nephi.11.34` failure demonstrates the central design
error. The cached Gemini OCR for the 1852 seed identifies the correct first and
last printed lines. The 1852 seed geometry follows those lines. The 1854 family
registration placed the same notch pattern one physical line too high.
Whitespace snapping then optimized boundaries around the wrong line. A local
pixel minimum cannot repair incorrect semantic line ownership.

The recovery must therefore reconstruct **line and token ownership first** and
derive geometry second. Geometry may never be the source of truth for its own
semantic correctness.

## 2. Non-negotiable safety rules

Every executor must follow these rules.

1. Do not write to production while performing reconstruction or QA.
2. Do not overwrite `backend/.shadow/fax-shadow.sqlite`. It is a forensic
   artifact containing useful work mixed with unverified work.
3. Do not use `.shadow/fax-shadow.sqlite`. It is a separate, later production
   mirror and has previously been confused with the real working shadow.
4. Do not generate production SQL from historical `docs/sql/*.sql` or
   `BoMOnlineWorkspace/scripts/out/families/*.sql` files.
5. Do not use a page-wide affine transform as proof of line ownership. It may
   provide an initial search position only.
6. Do not let a whitespace optimizer choose among arbitrary gaps. A notch may
   move only within the immediate lexical gap belonging to the validated verse
   boundary.
7. Do not create geometry for a missing, blank, corrupt, or unusable source
   scan. Record the unavailable item and leave it unchanged or absent.
8. Do not call Gemini, another LLM, or a vision model during the computational
   rebuild. Existing Gemini OCR cache files are immutable evidence and may be
   read.
9. Do not treat `warning`, `conditional`, `unavailable`, or `failure` as
   `pass`.
10. Do not claim completion while any changed row has an unresolved semantic,
    structural, pixel, family, render, or deployment verification failure.
11. Do not use `mysql --force`. Production import must stop at the first error.
12. Do not hand-edit the final SQL. Regenerate it from the accepted baseline and
    candidate databases.

## 3. Sources of truth

Use these sources in this order.

### 3.1 Canonical text

Table:

```text
lds_scriptures_verses
```

This establishes canonical verse IDs, selectors, and expected verse text. It
does not establish historical spelling or printed line wrapping.

### 3.2 Immutable cached Gemini line OCR

Default cache:

```text
/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache
```

Each page record contains:

```json
{
  "imgW": 959,
  "imgH": 1630,
  "lines": [
    {
      "text": "exact printed line",
      "box_2d": [377, 27, 397, 922]
    }
  ]
}
```

The cache is authoritative for:

- printed line order;
- printed line text;
- seed-page line bounding boxes;
- determining which printed line contains each canonical verse boundary.

It is not automatically authoritative for:

- exact target-edition pixel coordinates;
- exact character widths within a line;
- pages where OCR is missing or clearly damaged.

### 3.3 Source scans

Preferred local cache:

```text
backend/.shadow/media/<version>/<page>.<format>
```

If a scan is absent locally, the local shadow tooling may fetch it once and
cache it. Record its byte hash in the run manifest. All geometry must be
measured against each edition's own scan.

### 3.4 Fresh production snapshot

Create a new immutable snapshot at the beginning of the recovery. This is the
only production baseline for the run.

### 3.5 Candidate shadow

Create exactly one candidate as a copy of the immutable snapshot. Apply only
accepted, reproducible proposals to this copy.

### 3.6 Forensic-only artifacts

These may explain prior changes but must not become the rebuild source:

- `backend/.shadow/fax-shadow.sqlite`
- `.shadow/fax-shadow.sqlite`
- `backend/.shadow/*-apply.json`
- `docs/sql/fax-*.sql`
- `/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/families/*.sql`
- prior audit proposal reports

## 4. Required run directory and naming

Use one fixed run ID. Do not reuse a previous directory.

Unless a command block says otherwise, run commands from the repository root:

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
export FAX_RECOVERY_RUN=2026-07-27-r1
mkdir -p "backend/.shadow/recovery/$FAX_RECOVERY_RUN"
mkdir -p "docs/audits/fax-geometry/recovery/$FAX_RECOVERY_RUN"
```

All generated files for this run must live under one of those two directories.
Every report must record:

- run ID;
- script Git commit or dirty-tree hash;
- command line;
- input file hashes;
- source database hash;
- output database hash;
- start and finish timestamps.

The worktree is currently dirty. Before execution, save:

```bash
git status --short \
  > "docs/audits/fax-geometry/recovery/$FAX_RECOVERY_RUN/git-status.txt"
git diff \
  > "docs/audits/fax-geometry/recovery/$FAX_RECOVERY_RUN/tracked.diff"
```

Untracked recovery scripts must be listed separately in the run manifest.

## 5. Phase 0 — freeze and inventory

### 5.1 Freeze

Before running any remediation:

- stop generating new broad family SQL;
- stop applying old proposal reports;
- stop manual shadow edits;
- stop production imports;
- record any currently running local fax servers and which database each
  serves.

### 5.2 Inventory required inputs

Create:

```text
docs/audits/fax-geometry/recovery/<run>/input-inventory.json
```

It must contain:

- every configured edition;
- plate-family membership and reference edition;
- scan format and page range;
- scan availability count;
- Gemini cache availability count;
- current production geometry row and distinct-verse counts;
- source scan hashes for every page used;
- OCR cache hashes for every page used.

Family configuration begins at:

```text
backend/scripts/fax-plate-families.json
```

Current configured families include:

| Family | Reference | Members |
|---|---|---|
| european-1852-plates | 1852 | 1852, 1854, 1854l, 1866, 1871, 1874, 1877 |
| 1829-printer-derivative | 1829 | 1829, printer |
| 1879-reregistered-derivatives | 1879 | 1879, 1881, 1883d, 1885, 1888d, 1898, 1907, 1918 |
| 1920-reregistered-derivatives | 1920 | 1920, 1921, 1923 |

Do not assume this list is exhaustive. Editions not in a family are processed
as standalone references.

### 5.3 Classify every edition

Assign one state:

- `DIRECT_OCR_REFERENCE`: has usable cached Gemini line OCR.
- `DERIVATIVE_WITH_REFERENCE`: same printing/line breaks as a direct reference.
- `STANDALONE_WITH_OCR`: usable own OCR but no configured family.
- `NO_USABLE_OCR`: cannot be rebuilt automatically.
- `SOURCE_UNAVAILABLE`: scan corpus is missing or unusable.

No edition may silently fall through the classification.

### 5.4 Phase 0 acceptance gate

Proceed only if:

- one run directory exists;
- every edition has exactly one classification;
- every family has one declared reference;
- all input hashes are recorded;
- no production writer is running.

## 6. Phase 1 — create a clean baseline and candidate

### 6.1 Extract a fresh production snapshot

Use the read-only DB CLI:

```bash
/opt/homebrew/bin/node \
  backend/node_modules/tsx/dist/cli.mjs \
  backend/scripts/fax-shadow-sync.mts \
  --db-cli /Users/kckern/Documents/GitHub/BoMOnlineWorkspace/cli/db.mjs \
  --out "backend/.shadow/recovery/$FAX_RECOVERY_RUN/prod-baseline.sqlite" \
  --manifest "backend/.shadow/recovery/$FAX_RECOVERY_RUN/prod-baseline-manifest.json"
```

Run this command from the repository root.

### 6.2 Make the candidate

```bash
cp \
  "backend/.shadow/recovery/$FAX_RECOVERY_RUN/prod-baseline.sqlite" \
  "backend/.shadow/recovery/$FAX_RECOVERY_RUN/candidate.sqlite"
```

Make a second untouched copy:

```bash
cp \
  "backend/.shadow/recovery/$FAX_RECOVERY_RUN/prod-baseline.sqlite" \
  "backend/.shadow/recovery/$FAX_RECOVERY_RUN/prod-baseline-sealed.sqlite"
```

The sealed copy must never be opened writable.

### 6.3 Record hashes and counts

Record SHA-256 hashes and these queries:

```sql
SELECT COUNT(*) FROM bom_xtras_fax_index;
SELECT COUNT(DISTINCT version) FROM bom_xtras_fax_index;
SELECT version, COUNT(*) rows, COUNT(DISTINCT verse_id) verses
FROM bom_xtras_fax_index
GROUP BY version
ORDER BY version;
```

### 6.4 Phase 1 acceptance gate

Proceed only if:

- baseline and sealed hashes are identical;
- candidate hash initially matches baseline;
- all row counts match the extraction manifest;
- `PRAGMA integrity_check` returns `ok` for all three SQLite files.

## 7. Phase 2 — build the semantic line-ownership manifest

This phase must not read existing verse geometry except for reporting
differences. It reconstructs ownership from text and cached line OCR.

### 7.1 Required new artifact

Create:

```text
line-ownership.ndjson
```

Each record represents one verse fragment on one printed page:

```json
{
  "referenceVersion": "1852",
  "verseId": 31365,
  "selector": "1-nephi-11.34",
  "page": 21,
  "column": 0,
  "startLineOrdinal": 16,
  "startTokenOrdinal": 7,
  "endLineOrdinal": 19,
  "endTokenOrdinal": 7,
  "startLineText": "slain for the sins of the world. And after he was slain I saw",
  "endLineText": "twelve called by the angel of the Lord. And the multitude",
  "previousToken": "world",
  "firstOwnedToken": "and",
  "lastOwnedToken": "lord",
  "followingToken": "and",
  "anchorCount": 5,
  "alignmentScore": 1.0,
  "status": "ACCEPTED"
}
```

### 7.2 Required implementation

Add a single-purpose script:

```text
backend/scripts/fax-build-line-ownership-manifest.mts
```

It must:

1. read canonical verses from the fresh baseline;
2. read immutable cached Gemini page lines;
3. remove only verified headers, page numbers, and chapter headings;
4. tokenize historical OCR and canonical text with punctuation-insensitive,
   case-insensitive comparison while retaining original token text;
5. align the complete page word stream monotonically to canonical text;
6. identify the exact first and last owned token for every verse fragment;
7. retain the Gemini line ordinal containing each boundary;
8. record shared-line neighbor tokens;
9. emit ambiguity rather than interpolating through weak anchors;
10. never emit geometry.

### 7.3 Alignment rules

An ownership record is automatically accepted only if:

- at least three distinctive anchors locate the page;
- at least one anchor exists inside or immediately adjacent to the verse;
- start and end mappings are monotonic;
- the first and last owned canonical tokens occur in the selected OCR lines;
- a shared-line boundary identifies both the owned token and neighboring token;
- the best alignment is materially better than the second-best alignment;
- historical spelling differences do not alter token order.

Otherwise emit one of:

- `OCR_PAGE_MISSING`
- `OCR_PAGE_EMPTY`
- `PAGE_ALIGNMENT_AMBIGUOUS`
- `START_TOKEN_AMBIGUOUS`
- `END_TOKEN_AMBIGUOUS`
- `HISTORICAL_TEXT_VARIANT`
- `SOURCE_TEXT_DAMAGED`

These statuses are unresolved and must not generate geometry.

### 7.4 Reciprocal boundary invariant

If adjacent verses share one printed line:

- verse A's `followingToken` must equal verse B's `firstOwnedToken`;
- verse A's end boundary and verse B's start boundary must refer to the same
  line ordinal and lexical gap;
- the two records may not disagree about which token owns that gap.

### 7.5 Reference regression: 1852/1 Nephi 11:34

The manifest must reproduce this evidence from:

```text
/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache/1852/021.json
```

| Ownership | Gemini line text | `box_2d` |
|---|---|---|
| Previous verse only | `And I, Nephi, saw that he was lifted up upon the cross, and` | `[357,24,377,922]` |
| First shared target line | `slain for the sins of the world. And after he was slain I saw` | `[377,27,397,922]` |
| Target middle | `the multitudes of the earth, that they were gathered together` | `[396,27,417,922]` |
| Target middle | `to fight against the apostles of the Lamb ; for thus were the` | `[416,28,437,924]` |
| Final shared target line | `twelve called by the angel of the Lord. And the multitude` | `[436,28,456,924]` |

The target must start at the second line in this table, immediately before the
second line's `And`, and end at the final line immediately after `Lord`.

### 7.6 Phase 2 acceptance gate

Proceed only if:

- every accepted fragment has explicit start/end line and token ordinals;
- reciprocal adjacent boundaries agree;
- page and verse order have zero inversions;
- every unresolved fragment is listed separately;
- the 1852/1 Nephi 11:34 regression matches the table above.

## 8. Phase 3 — register reference lines to derivative scans

This phase applies only to `DERIVATIVE_WITH_REFERENCE` editions.

### 8.1 Design principle

Register **ordered printed lines**, not verse rectangles.

The existing `fax-shadow-page-register.mts` may be used for experiments, but
its page-affine result is not sufficient evidence. Add or refactor a dedicated
line registration script:

```text
backend/scripts/fax-register-family-lines.mts
```

### 8.2 Detect target line bands

For every derivative page and column:

1. convert the scan to grayscale;
2. estimate paper and ink levels robustly;
3. remove borders, running headers, page numbers, and gutters;
4. compute horizontal ink projection;
5. identify connected row bands containing body text;
6. merge diacritics and ascenders/descenders into their parent line;
7. split accidentally merged adjacent lines using the projection valley;
8. record each line's top, bottom, left, right, baseline estimate, and binary
   row signature.

Tesseract may be used locally as secondary evidence for word boxes and text.
It must not be the sole line detector.

### 8.3 Monotonic line-sequence registration

Map each Gemini reference line ordinal to one target line band using dynamic
programming.

The score should include:

- monotonic order;
- predicted vertical position from a robust page transform;
- line-height similarity;
- inter-line spacing similarity;
- left and right extent similarity;
- binary row-signature correlation;
- optional deterministic OCR token overlap.

The robust page transform supplies a search center only. The final map must
select an observed target line band.

Required constraints:

- no target line may map to two reference lines;
- line order may not invert;
- a skipped or inserted line must be explicitly reported;
- column assignment may not change within a fragment;
- best-path score must exceed the second-best path by a configured margin;
- any local jump of approximately one line must be reported even when the
  page-wide affine residual is small.

### 8.4 Required output

Create:

```text
family-line-registration.ndjson
```

Each line mapping must include:

```json
{
  "family": "european-1852-plates",
  "referenceVersion": "1852",
  "targetVersion": "1854",
  "referencePage": 21,
  "targetPage": 21,
  "column": 0,
  "referenceLineOrdinal": 16,
  "targetLineOrdinal": 16,
  "referenceBox": {"top": 614, "bottom": 647},
  "targetBand": {"top": 1482, "bottom": 1533},
  "score": 0.97,
  "runnerUpScore": 0.61,
  "status": "ACCEPTED"
}
```

Numbers above are illustrative except where measured by the run. Never copy
them into geometry without re-measuring the source scan.

### 8.5 Regression: 1854/1 Nephi 11:34

The current bad row is:

```text
version=1854 verse_id=31365 page=21
X=69 Y=461 W=565 H=87 TLW=298 TLH=20 BRW=178 BRH=20
```

At scan width 2136, `Y=461` maps to approximately source pixel 1407, which is
the preceding physical line. The line containing the target's opening
`And after` is approximately one body line lower, around source pixel 1482.

The line-registration report must:

- map the 1852 first shared target line to the 1854 line containing
  `...world. And after...`;
- map the final shared line to the line containing
  `...Lord. And the multitude`;
- reject any path that maps either boundary to the neighboring physical line.

### 8.6 Phase 3 acceptance gate

Proceed for a target page only if:

- all body lines needed by accepted ownership records have accepted mappings;
- no mapping inversion exists;
- no required line is skipped;
- registration confidence and runner-up margin pass;
- known line-shift regression cases select the correct physical line.

Unaccepted pages remain unchanged and enter the manual/unavailable queue.

## 9. Phase 4 — derive geometry from accepted line and token ownership

### 9.1 Required implementation

Add:

```text
backend/scripts/fax-derive-geometry-from-lines.mts
```

Inputs:

- immutable baseline;
- semantic line-ownership manifest;
- target line-registration manifest;
- target scans;
- optional deterministic OCR word boxes.

Output:

```text
geometry-proposals.json
```

### 9.2 Outer rectangle rules

For each fragment:

- `X` and `X+W` are the target column's measured whitespace boundaries;
- `Y` is the whitespace midpoint immediately above the first owned line;
- `Y+H` is the whitespace midpoint immediately below the last owned line;
- all coordinates are converted with:

```text
stored = round(sourcePixels * pageScale / actualScanWidth)
```

Use actual scan width, not stale metadata, for the conversion.

Outer edges must not intersect connected glyph components belonging to an
owned line.

### 9.3 Top-left notch rules

A top-left notch exists only when:

- the verse starts mid-line;
- the text before the verse belongs to a preceding canonical verse;
- the preceding and first owned token are both identified.

Its vertical edge must be the midpoint of the immediate whitespace run between
the preceding token and first owned token.

Its height must cover exactly the first owned line's vertical band, bounded by
the whitespace above and below that line.

The search may not move to:

- another word gap;
- the widest gap on the line;
- a punctuation gap outside the adjacent token pair;
- the first word of the next verse.

### 9.4 Bottom-right notch rules

A bottom-right notch exists only when:

- the verse ends mid-line;
- following text belongs to the next canonical verse;
- the last owned and following token are both identified.

Its vertical edge must be the midpoint of the immediate whitespace run between
the last owned token and following token.

Its height must cover exactly the final owned line's vertical band.

### 9.5 Page and column continuation rules

For a verse spanning multiple fragments:

- only the first fragment may have a top-left notch;
- only the last fragment may have a bottom-right notch;
- a fragment ending because the column or page ended must have no synthetic
  bottom-right notch;
- a continuation fragment starting at a column or page beginning must have no
  synthetic top-left notch;
- an interior fragment may not erase words at a page/column boundary.

### 9.6 Full-line rules

If a verse starts at the first token of a line:

```text
TLW=0, TLH=0
```

If a verse ends at the final token of a line:

```text
BRW=0, BRH=0
```

Half-notches are forbidden:

```text
(TLW=0) != (TLH=0)
(BRW=0) != (BRH=0)
```

### 9.7 Proposal evidence

Every changed proposal must include:

- baseline row;
- proposed row;
- reference OCR lines;
- target line bands;
- first/last owned tokens;
- preceding/following tokens;
- exact lexical whitespace runs;
- connected-component intersection counts before and after;
- movement in pixels, stored units, and line heights;
- family peers and line-span counts;
- acceptance status and reasons.

### 9.8 Automatic-repair gate

Accept automatically only if all are true:

- ownership record is accepted;
- target line registration is accepted;
- exact boundary tokens are located;
- selected gap is the immediate lexical gap;
- independent pixel whitespace agrees with that gap;
- no owned glyph component intersects a fill rectangle;
- no neighbor-owned glyph remains outside the fill rectangle;
- outer rectangle includes all owned line bands;
- movement is within a robust family/page distribution or has direct exact
  token evidence;
- resulting geometry passes all structural invariants.

Otherwise mark `REVIEW_REQUIRED`; do not mutate the candidate.

## 10. Phase 5 — apply accepted proposals to the candidate only

### 10.1 Preserve a proposal ledger

Every candidate mutation must be reproducible and recorded in
`fax_shadow_changes`. The ledger must contain:

- source report path and hash;
- run ID;
- baseline JSON;
- proposed JSON;
- acceptance class;
- evidence summary.

### 10.2 Apply once

Use `fax-shadow-apply.mts` only after confirming it consumes the new proposal
schema without dropping evidence. If necessary, update it first.

Never apply:

- unresolved records;
- unavailable-source records;
- proposals derived from an old shadow state;
- proposals with stale baseline values.

### 10.3 Candidate integrity checks

After applying:

```sql
PRAGMA integrity_check;
SELECT COUNT(*) FROM bom_xtras_fax_index;
SELECT COUNT(*) FROM fax_shadow_changes;
```

Also verify every ledger `before_json` exactly matched the candidate row at
application time.

## 11. Phase 6 — exhaustive computational QA

QA is cumulative. A later pass does not replace an earlier pass.

### 11.1 Structural audit

Run against the candidate:

```bash
cd backend
npx tsx scripts/fax-geometry-audit.mts \
  --shadow ".shadow/recovery/$FAX_RECOVERY_RUN/candidate.sqlite" \
  --pixels \
  --ocr-root /Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache \
  --out "../docs/audits/fax-geometry/recovery/$FAX_RECOVERY_RUN/structural"
```

Required zero-error invariants:

- positive width and height;
- finite, nonnegative coordinates;
- box remains within the scan;
- notch dimensions do not exceed the box;
- no half-notch;
- connected effective polygon;
- no duplicate conflicting ownership;
- monotonic verse/page order;
- contiguous multi-fragment ordering;
- valid page/column continuation topology;
- reciprocal adjacent notches;
- no impossible notch at a pure page/column break.

### 11.2 Semantic line-identity audit

Add a dedicated report:

```text
semantic-line-identity.json
```

For every candidate fragment, verify:

- first physical line equals the ownership manifest's first line;
- final physical line equals the ownership manifest's final line;
- line-span count matches the ownership manifest;
- derivative and reference have the same source-line ordinals;
- shared-line first and final token ordinals agree.

This audit must run for unchanged rows too. The purpose is to detect bad
baseline geometry, not merely regressions introduced during this run.

### 11.3 Pixel ownership audit

For every notch:

- identify connected glyph components on the boundary line;
- assign them to OCR/deterministic tokens;
- assert the fill rectangle intersects zero owned-token components;
- assert text outside the fill contains no neighbor-owned token component.

For outer top and bottom:

- assert all owned lines remain inside;
- assert the preceding/following line remains outside unless it is a valid
  shared line handled by a notch.

### 11.4 Exhaustive render/content QA

Start the local candidate API and leave it running:

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
/opt/homebrew/bin/node backend/node_modules/tsx/dist/cli.mjs \
  backend/scripts/fax-shadow-server.mts \
  --shadow "backend/.shadow/recovery/$FAX_RECOVERY_RUN/candidate.sqlite" \
  --media-cache backend/.shadow/media \
  --host 127.0.0.1 \
  --port 8361
```

Verify:

```bash
curl -f \
  http://127.0.0.1:8361/fax/render/1854/crop/w800/1.nephi.11.34.jpg \
  -o /tmp/fax-recovery-smoke.jpg
file /tmp/fax-recovery-smoke.jpg
```

Enhance `fax-shadow-candidate-qa.mts` with an `--all-diff` mode if it does not
already support baseline-to-candidate exhaustive selection. It must compare:

```text
prod-baseline-sealed.sqlite -> candidate.sqlite
```

For every changed or added verse:

- request the exact crop endpoint;
- verify HTTP status and image type;
- run multiple local Tesseract PSM modes;
- align rendered OCR to canonical text;
- verify the first and last distinctive canonical tokens;
- detect previous-verse and next-verse token leakage;
- report interior canonical gaps;
- report top/bottom/left/right cut-ink metrics.

No changed row may be omitted because it was absent from a prior audit report.

### 11.5 Family consistency audit

For each family and verse:

- fragment count must agree unless a documented page-layout exception exists;
- source line-span count must agree;
- start-mid-line and end-mid-line classes must agree;
- start/end source-line ordinals must agree;
- derivative line registration must be monotonic;
- geometry may differ in coordinates but not semantic ownership.

Family affine residuals remain diagnostic only. A low affine residual does not
prove correct line identity.

### 11.6 Coverage audit

Compare baseline and candidate:

- rows added;
- rows deleted;
- verses gained;
- verses lost;
- pages gained/lost;
- internal missing runs;
- missing source/OCR reasons.

Any deletion requires one explicit reason:

- duplicate bad row;
- wrong page/verse label;
- source unavailable and geometry proven fabricated;
- replaced by corrected fragment set.

No unexplained coverage loss is acceptable.

### 11.7 Required regression suite

The following cases must be permanent named tests:

| Case | Required assertion |
|---|---|
| `1852/1.nephi.9.4` | Ends at the em dash/verse boundary; does not include `Wherefore` from the next verse |
| `1852/1.nephi.9.6` | Correct first and final token ownership |
| `1852/1.nephi.10.11` | Correct first and final token ownership |
| `1854/1.nephi.11.34` | Starts with `And after`; excludes verse 33; includes through `Lord`; excludes verse 35 |
| `1852/3.nephi.12.2` | No unnecessary page/column-break notch |
| `1852/mosiah.15.9` | Includes the leading `Having` |
| `1852/alma.45.15` | No bottom-right notch caused only by end of page |
| `1852/3.nephi.15.1` | Top-left notch does not cut the leading `A` |
| `1866/1.nephi.14.2` | Includes the leading `And` |
| `1874/1.nephi.14.7` | First fragment has no bottom-right notch merely because the verse continues |
| `1849/alma.51.23` | Excludes the previous paragraph's final word |
| `1849/alma.52.12` | Notch lies in the exact adjacent-token whitespace |
| `1882/alma.40.19` | Top and bottom edges do not cut text lines |
| `1879` page 262 | Expected verses have renderable geometry |
| `1852` page 177 | All available verses have geometry; unavailable OCR/source gaps are explicit |

Each test must assert content, not just coordinate equality.

### 11.8 Phase 6 acceptance gate

The candidate is not green until:

- structural errors: `0`;
- semantic line-identity failures: `0`;
- owned-token/notch intersections: `0`;
- previous/next verse leaks for changed rows: `0`;
- missing opening/closing canonical boundary tokens for changed rows: `0`;
- unexplained coverage changes: `0`;
- regression failures: `0`;
- source-unavailable items are explicitly bracketed and excluded;
- every warning has a written disposition.

`42 failures`, `1 failure`, or `warnings only` is not green.

## 12. Phase 7 — manual review for unresolved cases only

The manual app is for ambiguity, not for replacing computational QA.

Use the standalone `fax-lab` workspace. It must show:

- full source-page context;
- rendered crop;
- canonical verse text;
- exact historical OCR line text;
- previous and following canonical verse text;
- current and proposed geometry;
- line ordinals;
- token and whitespace boundaries;
- reason automatic acceptance failed.

Allowed reviewer outcomes:

- `ACCEPT_PROPOSAL`
- `KEEP_BASELINE`
- `ADJUST_GEOMETRY`
- `SOURCE_UNUSABLE`
- `OCR_UNUSABLE`
- `TEXT_VARIANT`
- `NEEDS_ESCALATION`

Every manual adjustment must be re-run through all Phase 6 checks.

If the source scan is missing, blank, corrupt, or unreadable, select
`SOURCE_UNUSABLE`. Do not repeatedly tune geometry for an unusable source.

## 13. Phase 8 — independent visual sampling

After computational green:

1. render all manually adjusted items;
2. render all multi-page and multi-column verses changed;
3. render all changed page/column-break items;
4. render all changed nonzero-notch items;
5. select 5–10 deterministic random changed verses per affected version;
6. produce labeled contact sheets with version, selector, page, geometry, and
   QA status.

The sample seed must be fixed and recorded. A reviewer must explicitly mark
each sheet accepted or rejected.

Visual sampling is a final sanity check. It cannot waive computational
failures.

## 14. Phase 9 — generate one guarded deployment package

### 14.1 Required exporter

Add:

```text
backend/scripts/fax-shadow-export-sql.mts
```

Inputs:

- sealed production baseline;
- accepted candidate;
- run manifest;
- final QA summary.

Outputs:

```text
fax-index-recovery-<run>.sql
fax-index-recovery-<run>.rollback.sql
fax-index-recovery-<run>.manifest.json
```

### 14.2 Export rules

The forward SQL must:

- contain only the exact baseline-to-candidate diff;
- include updates, inserts, and deletes explicitly;
- guard every update/delete with exact old values;
- verify expected baseline row counts before mutation;
- verify affected version/verse uniqueness;
- execute in one transaction;
- `SIGNAL` and roll back on any mismatch;
- verify final affected counts before commit;
- contain no historical proposal or intermediate SQL.

The manifest must include:

- baseline/candidate SHA-256 hashes;
- changed/added/deleted row counts;
- affected versions and verses;
- QA report hashes;
- unresolved/unavailable counts;
- SQL and rollback hashes.

### 14.3 Local MySQL rehearsal

Before production:

1. load the fresh production snapshot into an isolated local MySQL database;
2. apply the generated forward SQL without `--force`;
3. extract `bom_xtras_fax_index`;
4. compare it exactly to `candidate.sqlite`;
5. apply rollback;
6. compare it exactly to the sealed baseline;
7. apply forward SQL a second time and confirm the guard rejects stale old
   values or reports an explicitly supported idempotent state.

### 14.4 Deployment acceptance gate

Do not present the SQL for production until:

- all Phase 6 gates are green;
- manual queue is empty except bracketed unavailable sources;
- visual sample is accepted;
- local MySQL forward comparison is exact;
- local rollback comparison is exact;
- package hashes are recorded.

## 15. Phase 10 — production deployment and confirmation

Production deployment requires explicit user authorization at that time.

After import:

1. query production through `cli/db.mjs`;
2. extract the affected rows;
3. compare them exactly with the candidate;
4. verify row counts and hashes;
5. exercise every permanent regression endpoint;
6. run 5–10 deterministic random renders per affected version;
7. save the post-deployment QA report.

If any comparison differs:

- stop;
- do not layer another patch on top;
- determine whether rollback is required;
- preserve the failed state and logs.

## 16. Status vocabulary

Use only these top-level states:

- `NOT_STARTED`
- `RUNNING`
- `BLOCKED_INPUT`
- `FAILED`
- `COMPUTATIONALLY_GREEN`
- `MANUALLY_ACCEPTED`
- `DEPLOYMENT_READY`
- `DEPLOYED_VERIFIED`

`GOAL_COMPLETE` is allowed only when the state is `DEPLOYED_VERIFIED` and no
required work remains.

Record-level states:

- `ACCEPTED_AUTOMATIC`
- `ACCEPTED_MANUAL`
- `KEEP_BASELINE`
- `REVIEW_REQUIRED`
- `REGISTRATION_AMBIGUOUS`
- `OCR_UNUSABLE`
- `SOURCE_UNUSABLE`
- `TEXT_VARIANT`
- `FAILED_QA`

## 17. Minimal executor checklist

An executor should complete these in order and stop at the first failed gate.

- [ ] Freeze production writes and old proposal application.
- [ ] Create one new run directory.
- [ ] Save dirty-tree inventory.
- [ ] Hash scans, OCR caches, family config, and scripts.
- [ ] Extract fresh production baseline.
- [ ] Seal baseline and copy candidate.
- [ ] Build semantic line-ownership manifest from canonical text and Gemini
      cache.
- [ ] Verify reciprocal shared-line boundaries.
- [ ] Register reference line ordinals to each derivative's measured line
      bands.
- [ ] Reject ambiguous page registrations.
- [ ] Derive geometry only from accepted line and token ownership.
- [ ] Apply accepted proposals to candidate only.
- [ ] Run structural audit.
- [ ] Run semantic line-identity audit on all rows.
- [ ] Run pixel ownership audit on all boundaries.
- [ ] Run exhaustive render/content QA on all changed rows.
- [ ] Run family consistency and coverage audits.
- [ ] Run all named regressions.
- [ ] Resolve or bracket every non-pass record.
- [ ] Run manual review only for unresolved usable sources.
- [ ] Re-run all audits after manual changes.
- [ ] Produce and approve deterministic visual samples.
- [ ] Generate SQL only from sealed baseline versus accepted candidate.
- [ ] Rehearse forward and rollback in isolated MySQL.
- [ ] Obtain explicit deployment authorization.
- [ ] Apply without `--force`.
- [ ] Compare production exactly to candidate.
- [ ] Run post-deployment regression and random render QA.
- [ ] Mark `DEPLOYED_VERIFIED` only if every required check passes.

## 18. First execution slice

Before attempting the whole corpus, validate the architecture on one page:

```text
family: european-1852-plates
reference: 1852 page 21
target: 1854 page 21
verses: 1 Nephi 11:33–35
primary regression: 1854/1.nephi.11.34
```

The slice passes only if:

- the ownership manifest selects the Gemini lines shown in Section 7.5;
- derivative registration selects the corresponding 1854 physical lines;
- the rendered verse begins with `And after`;
- it includes `twelve called by the angel of the Lord`;
- it contains no verse-33 text;
- it contains no verse-35 text;
- no owned glyph is cut by an outer edge or notch;
- the same procedure, without hard-coded coordinates, succeeds for verses 33
  and 35.

Only after this slice passes should the executor run the complete
`european-1852-plates` family. Only after that family is green should the
executor move to other families and standalone editions.

## 19. Definition of done

The recovery is done only when:

1. line/token ownership is explicit and reproducible;
2. every derivative geometry is derived from its own scan;
3. every changed crop preserves all owned text and excludes neighbor text;
4. every unavailable source is explicitly bracketed;
5. every changed row passes structural, semantic, pixel, family, render, and
   regression QA;
6. the deployment package is exactly the sealed-baseline-to-candidate diff;
7. local forward and rollback rehearsals are exact;
8. production is extracted after deployment and exactly matches the accepted
   candidate;
9. post-deployment endpoint QA passes.

Anything less is progress, not completion.
