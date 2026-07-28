# Fax geometry post-apply QA plan

## Purpose

Validate an applied fax-geometry remediation through the deployed render path, not merely by
re-querying coordinates. The QA is deterministic and repeatable: a fixed seed produces the same
stratified random sample until the underlying corpus changes.

The render service is the backend at `http://10.0.0.10:5006`. Port `8200` serves the frontend and
does not proxy `/fax/render`; an HTML 404 from that port is an endpoint configuration failure, not
a missing fax box.

## Gate 1: post-apply database verification

Before requesting images:

1. Every manifest `UPDATE` row must exactly match its intended post-change geometry.
2. Every manifest `DELETE` UID must be absent.
3. Every retained duplicate peer must still exist.
4. Any mismatch stops QA immediately and writes `apply-verification-failures.json`.

This does not clear pre-existing audit warnings. Notch-related residual findings—especially orphan,
half, continuation, and nonreciprocal notches—must be re-audited against the post-apply database
and individually cleared, remediated, or retained as explicit release blockers. A random render
sample is supplementary evidence, not permission to ignore the exhaustive residual queue.

## Gate 2: stratified random sampling

Select five to ten distinct verses in every version touched by the manifest. Selection is
deterministic for a supplied seed and fills these strata in priority order:

1. manually reviewed repair;
2. automatic semantic/pixel repair;
3. family-propagated topology repair;
4. duplicate cleanup;
5. verse spanning physical pages;
6. verse spanning columns on one page;
7. consecutive verses at a column transition;
8. consecutive verses at a page transition;
9. active top-left notch;
10. active bottom-right notch;
11. other multi-fragment verse;
12. plain rectangular control.

After one candidate from each available stratum, seeded random candidates fill the requested sample
size. A candidate can carry several risk tags, but each sampled verse is unique.

## Gate 3: endpoint and image invariants

For every selected verse request:

`GET /fax/render/{version}/crop/w800/{canonical-selector}.jpg`

For the first cross-page or cross-column sample in each version, also request:

`GET /fax/render/{version}/page/w800/{canonical-selector}.jpg`

Machine checks:

- HTTP 200;
- `Content-Type: image/jpeg`;
- successful Sharp decode;
- nontrivial byte count and dimensions;
- output width no greater than the requested width;
- crop is neither nearly blank nor mostly dark;
- dark-pixel occupancy on each outer edge is recorded.
- local Tesseract OCR is aligned to the canonical verse;
- the canonical leading and trailing token runs occur at the rendered crop boundaries;
- a missing leading run combined with a top-left notch is classified as a greedy start notch;
- a missing trailing run combined with a bottom-right notch is classified as a premature end notch.

Edge-ink is a review warning rather than an automatic failure because legitimate tight crops can
touch ascenders, descenders, rules, or print noise.

Canonical boundary mismatch is a hard failure when the crop contains a reliable interior canonical
run. This catches valid JPEGs that omit words or entire continuation fragments, including:

- `1866/1-nephi-14.2` — leading “And” and following words excluded by the top-left notch;
- `1874/1-nephi-14.7` — bottom-right notch terminates the first fragment while the verse continues.

Known failures are permanent regression fixtures and are included in every run in addition to the
seeded random sample.

## Gate 4: human review

The generated `index.html` is the acceptance surface. For every card verify:

1. first and last words are complete;
2. no preceding/following verse word or line leaks into the crop;
3. notch boundaries occupy whitespace and do not cut through glyphs;
4. multi-column and multi-page fragments appear once and in reading order;
5. the page render highlights the same fragments as the crop.

Review machine warnings first, then all repaired cases, then controls.

## Acceptance criteria

- 100% of manifest rows pass the post-apply DB gate.
- Every impacted version has at least five rendered samples.
- 100% render success and decodability.
- Zero nearly blank, mostly dark, undersized, or over-width images.
- Zero human-observed clipped words, leaked neighboring text, misplaced notches, missing fragments,
  duplicate fragments, or incorrect fragment order.
- Zero unexplained residual structural notch findings in the post-apply audit.

Any visual failure becomes a version/verse regression case and must be added to the permanent
reviewed-fixture set before remediation is regenerated.

## Command

```bash
cd backend
npx tsx scripts/fax-geometry-render-qa.mts \
  --base http://10.0.0.10:5006 \
  --per-version 5 \
  --seed 20260726 \
  --out ../docs/audits/fax-geometry/2026-07-26-postapply-render-qa
```

Use `--plan-only` to verify the applied manifest and inspect the selected sample without issuing
render requests.

Use `--reuse-images` only while calibrating QA logic against an unchanged database. A post-change
acceptance run must omit it so every image is freshly rendered from current geometry.
