# Deterministic Fax Geometry Audit

**Date:** 2026-07-26  
**Implementation:** `backend/scripts/fax-geometry-audit.mts`  
**Status:** Implemented and validated read-only against current production data.

## Safety boundary

The script is read-only. It does not execute or generate SQL and never calls Gemini, an LLM, or a
vision model. With `--pixels`, it performs classical grayscale/projection analysis against source
scans. With `--ocr-root`, it may read existing immutable Gemini page OCR cache files.

Missing scans and missing OCR are emitted as coverage findings. They are never interpreted as clean
geometry.

When paired `*-relabeled.sql` and `*-snapped.sql` files exist, the script also measures the actual
historical pre-snap-to-post-snap movement. By default it discovers those files under
`/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/families`; use `--lineage-root` to
override that location or `--no-lineage` to disable it.

## Modes

Whole-corpus DB, topology, statistics, and family audit:

```bash
cd backend
npx tsx scripts/fax-geometry-audit.mts \
  --out ../docs/audits/fax-geometry/current
```

Pixel and cached-OCR audit:

```bash
npx tsx scripts/fax-geometry-audit.mts \
  --versions 1849,1852,1882 \
  --pixels \
  --ocr-root /Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache \
  --out ../docs/audits/fax-geometry/pixel-ocr
```

Targeted regression calibration:

```bash
npx tsx scripts/fax-geometry-audit.mts \
  --versions 1849,1852,1882 \
  --pixels \
  --verse-ids 31307,33147,34793,34939,35143,35169,36348,36456 \
  --out /tmp/fax-geometry-regressions
```

Lineage-only audit (no scan downloads):

```bash
npx tsx scripts/fax-geometry-audit.mts \
  --versions 1852 \
  --lineage-root /path/to/families \
  --out /tmp/fax-geometry-1852-lineage
```

## Structural passes

1. Absolute numeric, bounds, area, notch, and polygon-connectivity invariants.
2. Exact and near-duplicate regions claimed by the same or different verses.
3. Inferred page/column reading order, interleaved fragments, continuation notches, and reciprocal
   adjacent-verse notch spacing.
4. Missing verse runs, internal unindexed pages, fragment counts, and image-page resolution.
5. Per-edition robust distributions using median and median absolute deviation.
6. Explicit plate-family topology comparison and page-specific robust affine transforms.
7. Mechanical clone/scaling fingerprints.

Plate relationships are configured in `backend/scripts/fax-plate-families.json`. Coordinates are
never copied between family members.

## Pixel and semantic passes

For every selected boundary, the audit records either the deterministic correction from current
geometry to its local pixel optimum or the actual change between paired pre/post generation
artifacts:

```text
signedDistancePx
absoluteDistancePx
signedDistanceStored
absoluteDistanceStored
distanceLineHeights
currentInk
candidateInk
```

Distances are stratified by source, edition, and boundary. The eight measured edges are `LEFT`,
`RIGHT`, `TOP`, `BOTTOM`, notch verticals `TL`/`BR`, and notch horizontals `TLH`/`BRH`.
Each version/boundary distribution records signed mean and median, signed standard deviation,
absolute mean and conventional standard deviation, absolute median, MAD, p95, p99, maximum, and
line-height-normalized mean and p99. Every row in `snap-measurements.csv` records its baseline
population, conventional z-score, robust MAD z-score, percentile rank, and final statistical
outlier decision. This makes it possible to filter the measured snap tail directly without
reconstructing the distribution from the report.

`PIXEL_SNAP_DISTANCE_OUTLIER`, `GREEDY_SEMANTIC_SNAP_DISTANCE`, and
`HISTORICAL_SNAP_DISTANCE_OUTLIER` require:

- at least 20 comparable measurements;
- correction distance at or above the edition/boundary p99 and at least 3 stored units;
- robust distance of at least 7 MAD-equivalent deviations;
- when MAD is zero, at least 3 conventional standard deviations instead;
- material ink improvement for pixel findings, or at least 0.35 local line heights of movement for
  semantic/lineage findings.

Cached OCR is aligned to canonical verse prefixes/suffixes. OCR line token boundaries are mapped
monotonically to scan whitespace runs. An automatic candidate requires both the canonical token gap
and the independent pixel optimum to agree. Statistical distance outliers are always review-only.

The DB alone still exposes only current-geometry-to-optimum correction distance. Historical
raw-to-snapped distance is available only where the paired lineage artifacts have been retained.

## Outputs

```text
audit.json
summary.md
findings.csv
source-manifest.json
snap-measurements.csv   # pixel and/or lineage mode
snap-distributions.csv  # pixel and/or lineage mode
```

Each finding includes evidence, confidence tier, row identity, optional proposed geometry, and
whether it passes the current automatic-candidate gates. Applying any remediation remains a separate
explicit operation.

## Validation

Pure invariant tests:

```bash
cd backend
npx vitest run test/fax/geometryAudit.test.ts
```

The tests cover impossible polygons, effective area, near-duplicate verse regions, page-continuation
classification, family notch disagreement, robust greedy-snap detection, and the MAD-zero
conventional-standard-deviation fallback.

The 1849 1 Nephi 9:4 em-dash regression was detected at the 99.66th percentile of the edition's
bottom-right correction distribution: 10.34 stored units / 0.47 line heights versus a measured p99
of 6.15. Its distance was 7.15 conventional standard deviations above the mean, and mapped
token-gap intervals correctly recorded that the boundary traversed one complete lexical token.

The paired 1852 generation artifacts contain 6,549 matched pre/post rows. The calibrated lineage
tail produces six review findings rather than treating every move at the snapper's search limit as
an anomaly. Five are notch-horizontal moves of 0.36–0.44 line heights; one is a bottom-right notch
move of 23 stored units / 0.92 line heights.

The whole-corpus structural run matched 57,401 pre/post lineage rows across 1842, 1849, 1852, 1854,
1854l, 1866, 1871, 1874, and 1877. All seven configured 1852 plate-family editions therefore have
evidence of their own version-level snap pass. The statistical tail contains 389 review-only
historical displacement findings across those editions.
