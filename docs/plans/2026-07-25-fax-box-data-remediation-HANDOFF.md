# Fax box-data remediation — HANDOFF

> ## ⚠️ 2026-07-25 CORRECTION — READ THIS FIRST (cross-session reconciliation)
>
> This HANDOFF was written against the **old** cluster data. It has since been **replaced in prod**
> by a separate session's per-edition remediation load (the private BoMOnlineWorkspace fax-OCR
> pipeline). Reconciled facts, verified against `bom_prd` and the raw scans on 2026-07-25:
>
> 1. **Prod is NO LONGER the shared 6740-row dataset.** It now holds per-edition data with
>    *differing* counts: `1852/1854/1854l/1866/1871=6740, 1874=6703, 1877=6739, 1849=6840`. Prod's
>    `1871/31349` row (`p24 X86 Y102 W515 H20`) matches `scripts/out/families/1871-remediated.sql`
>    byte-for-byte. **The prod agent is looking at the new data, not stale data.**
> 2. **The new load fixed GEOMETRY QUALITY only** (edge-snap to whitespace, notch cuts, page
>    coherence). It did **NOT** fix the `verse_id`↔content labels. **The nonlinear drift documented in
>    §2.2 is STILL PRESENT.** Ground truth (I read the scans directly):
>    `media/fax/pages/1871/024.png` shows old-CHAP.III v35 = **1 Ne 13:10** ("many waters… divided the
>    Gentiles"), but the box there is labeled **31349 (1 Ne 11:18)**. The real 1 Ne 11:18 is on **page
>    20**. So §2's anchor table is confirmed correct; the box-page numbering is now 1..453 (Moroni
>    10:34 = the last verse = box page 453; scans 454–563 are witness/appendix/blank — the 453-vs-563
>    gap in §2.4 is expected tail, not a numbering bug).
> 3. **Why the QA missed it:** `fax-geometry-audit.mjs` measures whether an edge cuts ink, not whether
>    the label matches the text. A box perfectly framing 1 Ne 13:10 while labeled 31349 passes every
>    ink/notch/coherence check. Only the render-crop harness (§6) tests label↔content — keep using it
>    as the gate.
> 4. **§4 OCR-relabel is still the right path, and it is now DONE (computationally, no re-OCR).** The
>    OCR aligner had ALREADY run on this family (via Gemini, not tesseract — §5 Q3 is moot, no install
>    needed). **Root cause of the mislabel, verified:** NOT Gemini — its per-line OCR is correct. The
>    labeling step (`fax-ocr-index.mjs` Phase B) used a *stateful cursor*: a 35-verse peephole window
>    `[cursor, cursor+35]` that advanced by "last verse anchored on this page." A page that anchored a
>    little short/long left the cursor mis-placed and every later page inherited the error — lagging
>    ~51 in 1 Nephi, flipping to lead in Alma (nonlinear = accumulated drift, exactly §2.2). It hit
>    8/8 on 1842 (clean, continuous prose) but drifted on the numbered old-versification cluster.
>    **Fix (shipped in BoMOnlineWorkspace `scripts/fax-relabel-global.mjs`):** a STATELESS matcher that
>    locates each page independently in the full BoM word stream (offset-vote → windowed LCS), so drift
>    is impossible by construction. Verified on the scans: 1852 page 24 now labels 31400 (1 Ne 13:10),
>    Alma anchors corrected; 0 page-order inversions. Corrected SQL: `scripts/out/families/
>    1852-relabeled.sql`, `1849-relabeled.sql`, and per-member cluster files from re-registering the
>    corrected 1852 seed.
> 6. **Coverage caveat (by design, not a bug):** ~148 pages/edition returned EMPTY from the original
>    throttled Gemini run and were cached empty (an empty cache still counts as "cached," so they were
>    never retried). Those pages get NO boxes — we do not fabricate geometry or span gaps. So the
>    corrected data is ~63% (1852) / ~74% (1849) coverage: sparse-but-correct, replacing dense-but-
>    wrong. Recover the rest by deleting the empty-`lines` cache files and re-OCRing when Gemini
>    credits return, then re-relabel.
> 5. **§5 open questions resolved:** Q1 (donor) — none exists, confirmed. Q2 (what built wrong labels)
>    — the manual pipeline keyed off *printed* old-versification verse numbers that don't map to modern
>    verse_ids. Q3 (tesseract) — moot, OCR already done via Gemini.
>
> Active work on the aligner de-bias + re-run is happening in the BoMOnlineWorkspace session. This doc
> below is preserved as originally written for context.

---

**Date:** 2026-07-25
**Status:** Index-drift bug FIXED & verified (branch `fix/fax-verse-highlight-index-drift`). A deeper,
independent **box-data** problem is fully characterized but NOT fixed — it's blocked on one decision
(where the correct verse→page truth comes from). This doc is the pick-up point.
**Authorization on record:** KC approved prod writes limited to `bom_xtras_fax*` tables.

Read alongside:
- `docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md` (the fixed frontend bug)
- `docs/bugs/2026-07-25-fax-box-verseid-mismapping-euro-editions.md` (this data bug's root cause)
- `docs/bugs/2026-07-25-fax-boxes-offset-keying-mismatch.md` (a third, separate bug — offset≠0 DOM key)
- `docs/plans/2026-07-25-fax-box-data-remediation.md` (earlier plan; superseded on approach by this doc)

---

## 1. What is DONE (shippable)

The original report ("fax verse highlights not rendering") had a real frontend bug — the faxIndex
loader emits a sparse array consumed positionally, drifting verse ranges. **Fixed** in 3 commits
(`fb11d1c5`, `f7070463`, `7e01d1c2`) + docs. Verified live: `/fax/1871/24` → 35 hotspots with the
correct reference; `/fax/1842/100` → 63. This is correct and self-contained for the **offset-0,
good-box-data editions** (1842 and the other contiguous editions).

**Caveat that motivated everything below:** the hotspot count only proves the frontend join is
self-consistent. The render-crop exit criterion (KC's) proved *ground truth*, and exposed that some
editions' underlying box **data** points at the wrong physical page.

## 2. The box-data problem (settled facts — do not re-derive)

**Affected:** the 7-edition "European plate cluster" **1852, 1854, 1854l, 1866, 1871, 1874, 1877**
(share ONE box dataset: 6740 rows, 289 distinct pages, max page 453). Separately broken: **1849**
(6840 rows, 401 pages — its own wrong map). **rebom / poetic**: `/fax/render` returns 502 on every
crop — a distinct render failure, offset≠0 (−26, −47); diagnose independently.

**Root cause:** the box **geometry is correct** but the **`verse_id` labels are wrong**, nonlinearly.
Established facts:

1. **Geometry is right, coords are per-scan-page.** On 1871 physical page 24 there are 35 boxes with
   monotonic Y that tile the real printed page; each frames a real verse region. **Experiment
   (decisive):** setting verse 31349's `page` 24→20 (its true scan) and rendering produced a header
   fragment, not the verse — because the coords are authored against the *stored* page. **⇒ any
   page-offset / `pgfirstVerse` change is ruled out**; it lands correct coords on the wrong scan.
   (`imageScanMeta.offset = pgfirstVerse − MIN(page)` is a single constant per edition — structurally
   incapable of a nonlinear fix.)

2. **The labels are wrong, and nonlinearly.** The box at (page 24, top) frames "…many waters…" =
   1 Ne 13:10 (verse ~31400) but is labeled `31349` (1 Ne 11:18): label lags content by ~51. In Alma,
   verse `35177` (Alma 52:20) is labeled onto a box framing Alma 43 (~34620): label *leads* content
   by ~557. Opposite signs ⇒ no constant offset, no linear scale.

3. **Data is internally clean.** `verse_id` and `page` are both strictly monotonic in insertion
   (`uid`) order for good *and* broken editions; the full canonical set is present (6604 distinct ids,
   31103–37706). So a reading-order re-sequence is a no-op — the labels are the right *sequence*, just
   desynchronized from *content*. (Confirmed: `fax-resequence.mjs` reproduces neither the problem nor
   the good editions cleanly.)

4. **Box page numbering ≠ physical scans.** Cluster box pages max at 453 / 289 distinct, but the
   editions have 563 physical scan pages (good editions' box pages ≈ their physical page counts). The
   box numbering is a compressed scheme that indexes no real scan set.

**Measured box→scan anchors (1871), for whoever fits the map:**

| verse | box `page` | true scan | label vs content |
|---|---|---|---|
| 1 Nephi 11:18 (31349) | 24 | 20 | label lags ~51 |
| Alma 42:11 (34826) | 309 | 322 | — |
| Alma 47:~32 (35017) | 320 | 340 | — |
| Alma 52:20 (35177) | 326 | ~350 | label leads ~557 |

## 3. What was RULED OUT (don't repeat)

- **Constant page offset / edition `pgfirstVerse` change** — proven impossible (coords per-scan; §2.1).
- **Reading-order verse_id re-sequence** — no-op; data already monotonic (§2.3).
- **Copy labels from a plate-mate** — no identical-plate donor exists. The cluster is a
  *verse-numbered old-versification* family (page reads "35. …" under "CHAP. III"). Every
  correctly-rendering edition uses different plates: 1841/1842/1830 = continuous prose, no verse
  numbers; 1920 = modern chapters. 1849 is the only other numbered-old edition and is itself broken
  (renders 1 Ne 13:10 right, 1 Ne 11:18 wrong). Checked via `/fax/render/{ed}/page/w800/1-nephi-13.10.jpg`.

## 4. Recommended path (unblocked, self-contained)

**OCR-relabel.** The boxes are geometrically correct and in reading order; only their `verse_id` is
wrong. So:
1. OCR each of the ~289 unique cluster plate pages once (needs `tesseract`, not currently installed).
2. Match each OCR'd line/verse to canonical text (`bom_text` has `verse_id`↔text) to get the true
   verse sequence per physical page.
3. Assign to the boxes on that page in Y-order; write **`verse_id` only** (never geometry), keyed by
   `uid`, per edition (the 7 share the layout, so one OCR pass drives all 7; 1849 needs its own).
4. Validate with the render-crop harness against the 1920 control (§6) before and after, per edition.

## 5. OPEN QUESTIONS (need answers before writing data)

1. **Is there a non-obvious correct donor / mapping I couldn't see?** KC indicated "a correct
   plate-mate in the DB" and "you have all the seeds," but every numbered-old-versification edition I
   found (1849, 1852–1877) is broken, and the correct editions use different plates. **Is there a
   specific slug** (verse-numbered old versification, correctly labeled) to translate from — or an
   external/table mapping produced by the original manual-boxing pipeline? If yes, that beats OCR.
2. **What built the current (wrong) cluster labels?** KC said the geometry was built manually and "the
   version mapping is probably wrong." If the label-assignment step (script/spreadsheet) is known, its
   input is likely the seed for the correct relabel and avoids OCR entirely. **Where does that pipeline
   live** (BoMOnlineWorkspace private repo? a notebook? a mapping table)?
3. **OCR approval:** OK to install `tesseract` on the dev host and run it against the media scans?
4. **rebom / poetic 502s** — separate render failure; in scope for this effort or tracked separately?
5. **Write cadence:** one edition at a time with harness validation + rollback between each — confirm
   that's the desired safety posture for the prod writes.

## 6. Tooling already built (in-repo, reusable)

- **Backup (done):** `backend/scripts/fax-box-backup.mjs`. Ran: **67,835 rows** for all 10 affected
  editions saved to `docs/audits/data-backups/fax-box-backup-2026-07-25.ndjson` (gitignored; real
  data — never commit). Restore is a deliberate manual step.
- **Ground-truth harness:** `backend/scripts/fax-groundtruth-check.mjs` — renders a verses×editions
  grid + `index.html` vs a control (default 1920). This is the acceptance gate.
  `node scripts/fax-groundtruth-check.mjs --editions 1852,1871,1877 --control 1920 --verses 1-nephi-11.18,alma-52.20,moroni-10.4 --out /tmp/fax-gt`
- **Re-sequencer (diagnostic):** `backend/scripts/fax-resequence.mjs` — proved the labels are already
  monotonic; keep for future structural checks.
- **DB access:** `backend/scripts/sql-cli.mjs` (raw SQL, reader for SELECT; writes hit prod for real —
  see memory `sandbox_mode_writes`, raw SQL bypasses the sandbox). Env from
  `set -a; . $XDG_RUNTIME_DIR/bom-dev.env; set +a`.
- **Raw scans (ground truth):** `https://media.bookofmormon.online/fax/pages/{version}/{NNN}.{format}`
  (1871 is `png`; format is in `bom_xtras_fax.format`). Render endpoint is backend `:5006` only —
  `:8200` does NOT proxy `/fax/render`.

## 7. Environment / gotchas

- Backend `bom-greenfield` (`:5006`) runs `tsx` **without** `--watch` — restart it to load resolver
  changes (`systemctl --user restart bom-greenfield`; KC-authorized). The **render always recomputes
  from the DB** (no backend read cache; S3 write-back is CDN-only), so DB edits reflect immediately on
  `:5006` — good for guess-and-check.
- The index-drift branch is unmerged; decide merge/PR separately (it's independently correct).
