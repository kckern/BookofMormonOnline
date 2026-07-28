# Fax Geometry Remediation Data-Integrity Incident

**Date:** 2026-07-27 Pacific / 2026-07-28 UTC  
**Status:** Active incident; production state is not certified  
**Severity:** High user-facing data-integrity risk, limited to facsimile highlight geometry  
**Affected table:** `bom_xtras_fax_index`  
**Unaffected data:** canonical scripture text, source scan files, and non-facsimile application data

## Executive summary

The facsimile remediation effort began with a legitimate labeling-drift and
coverage problem. It then expanded into computational boundary repair,
whitespace snapping, family propagation, source-word ownership repair, and
manual tuning.

The immediate incident was caused by treating several overlapping,
intermediate SQL artifacts as if they collectively represented the final tuned
state. They did not.

The correct tuned shadow database already existed at:

`backend/.shadow/fax-shadow.sqlite`

It was missed because the investigation looked instead at the repository-root
`.shadow` directory. A new SQLite database was then synced from production into
the wrong location, creating a production mirror rather than recovering the
tuned candidate. Based on that mistaken state, a 26 MB “single SQL” file was
created by concatenating five historical/intermediate remediation layers:

1. seed and derivative boundary repairs;
2. the broad non-seed pixel/whitespace sweep;
3. the 600-row geometry remediation manifest;
4. source-word ownership remediation; and
5. a source-word ownership follow-up.

That file was applied to production through Adminer. It was not a deduplicated
delta from the tuned shadow. Later sections could overwrite earlier sections,
and the largest included layer contained 83,294 pixel/whitespace targets whose
correctness had not been established at verse level.

A subsequent visual audit of `1854/1.nephi.11.34` demonstrated a concrete
failure. Its stored top-left and bottom-right notches erase verse text. That
row came from the broad pixel/whitespace repair and was already present in the
verified pre-final-import production baseline. Therefore:

- the final consolidated import is a real deployment-control incident;
- the demonstrated bad row predates that final import and proves that the
  earlier broad sweep was also unsafe;
- the problem cannot be resolved by merely undoing the final Adminer import;
  there are two recovery horizons: the final consolidated import and the
  earlier broad pixel/whitespace changes.

Production must be treated as unverified until a rollback/reconciliation and a
new independent render QA pass are complete.

## Original objective and approach

### Initial problem

The original work addressed:

- nonlinear verse-label drift in early editions;
- missing page/verse coverage caused by OCR gaps;
- boxes that included adjacent verse text;
- boxes that omitted leading or trailing words;
- notches crossing words or appearing at page/column boundaries;
- derivative editions that inherited geometry from a common printing family
  without correct version-level registration and whitespace snapping.

The July 25 relabel work correctly identified a stateful cursor bug in the
labeling pipeline. The replacement relabeler used page-independent matching
against the full Book of Mormon text stream. This was a sound separation of the
labeling problem from the geometry problem.

### Expansion into geometry remediation

After relabeling, the effort introduced several computational geometry layers:

- OCR/pixel boundary audits for seed editions;
- family-topology propagation to derivative editions;
- pixel-based whitespace snapping for non-seed editions;
- structural and statistical audits;
- source-word ownership reconstruction;
- local SQLite shadow databases and render APIs;
- targeted manual/vision fixes for selected failures.

The intended safety model was:

1. make changes in a local shadow;
2. render and audit the candidate locally;
3. retain unresolved or scan-degraded cases as failures;
4. export one guarded SQL delta only after QA was green.

The handoff explicitly recorded that this goal had **not** been reached. For
the 1879l exhaustive render/content QA, the recorded state was:

- 111 candidates;
- 9 pass;
- 31 warning;
- 71 failure.

The handoff also explicitly advised: “Stop broad sweep-based edits and target
the residual failing families directly.”

## Mistakes made

### 1. The real shadow database was missed

The tuned database existed at:

`backend/.shadow/fax-shadow.sqlite`

The repository-root `.shadow` directory contained media but no SQLite file.
The absence of a file there was incorrectly interpreted as absence of the
shadow database generally.

The sync script was then run from the repository root and wrote:

`.shadow/fax-shadow.sqlite`

That new file was a fresh mirror of production, not the tuned candidate. Its
internal `fax_index_baseline` was necessarily identical to its current table,
which produced the misleading result “0 geometries different.”

This was a path/source-of-truth error, not evidence that tuning had disappeared
or that no work existed.

### 2. The handoff and its explicit non-green status were not honored

The existing handoff identified the correct shadow path, listed unresolved QA
failures, and warned against further broad sweeps. That evidence should have
stopped any production export.

Instead, old SQL artifacts were treated as deployable components without first
proving that they represented the accepted final shadow state.

### 3. Historical/intermediate SQL was concatenated instead of resolving one final state

The generated file:

`docs/sql/fax-all-remediation-2026-07-28.sql`

contains five independent remediation programs with separate transaction and
guard behavior. It is not one canonical row-level delta.

This introduces several hazards:

- the same UID or verse/page can be targeted by multiple layers;
- later layers can supersede earlier geometry;
- an all-or-none guard in one section can no-op while other sections commit;
- a successful HTTP response from Adminer does not prove every section
  committed;
- the resulting state cannot be inferred by summing statement counts.

The correct export should have compared one immutable baseline database with
one accepted candidate database and emitted at most one final operation per
UID, plus explicit structural inserts/deletes.

### 4. A broad heuristic proposal was treated as verified data

The non-seed pixel/whitespace artifact targets 83,294 UIDs. Its acceptance was
based primarily on local scan pixels and whitespace boundaries. It lacked a
hard semantic guarantee that the selected whitespace belonged to the target
verse rather than:

- the prior line;
- the next line;
- a neighboring column;
- an interior line of the same box;
- a page/header boundary; or
- whitespace reached only after crossing an entire word.

The distinction between “the database matches the generated proposal” and “the
proposal is visually and semantically correct” was lost.

### 5. QA became circular

Several post-apply checks compared production rows to the SQL manifest’s
proposed values. Those checks are useful for deployment verification, but they
do not validate correctness.

For example, a row can exactly match the proposed `TLW/TLH/BRW/BRH` while its
notches are attached to the wrong physical lines, causing the crop to retain
neighboring-verse text and omit target-verse text. Exact proposal agreement was
reported too readily as success.

Independent QA must instead test rendered content against:

- canonical first and last tokens;
- connected source-scan ink components;
- neighboring verse ownership;
- family-relative geometry;
- page/column topology; and
- known regression examples.

### 6. No immutable pre-deployment snapshot was made at export time

The production table was queried and hashed, but the export workflow did not
first create an immutable, timestamped table dump paired with the exact SQL
being deployed.

Fortunately, the real shadow’s `fax_index_baseline` is an exact copy of the
verified production state with hash:

`ecd324f9bd4d12c6da18dabc3493cd515d94ac86b9672aa7a18fa4603f4a17b6`

That provides a recovery point for the final consolidated import. It does not
provide a recovery point from before the earlier broad pixel sweep, because
the demonstrated bad 1854 row is already present in that baseline.

### 7. Operational execution was not controlled tightly enough

Before Adminer was used, execution was attempted through the EC2 MySQL
container. The first attempts failed because of file placement and credentials.
A later CLI attempt began and was interrupted. Although the client was no
longer running afterward, completed earlier transactions could theoretically
have committed before interruption.

The final Adminer import returned HTTP 200 and changed the production hash, but
the section-level result output was not preserved as an incident artifact.

Using `mysql --force` was also inappropriate for a multi-section data
remediation because it permits execution to continue after errors. Production
repair imports must stop on the first error and preserve complete output.

## Concrete discovered defect

### `fax/1854/1.nephi.11.34`

Production row:

| Field | Value |
|---|---:|
| UID | 552090 |
| Verse ID | 31365 |
| Page | 21 |
| Page width | 2136 |
| Page scale | 700 |
| X / Y | 69 / 461 |
| W / H | 565 / 87 |
| TLW / TLH | 298 / 20 |
| BRW / BRH | 178 / 20 |

The non-seed repair changed:

- `H: 77 -> 87`
- `TLW: 305 -> 298`

At the source scan’s actual width, `Y=461` maps to approximately source pixel
1407. That is the physical line containing “And I, Nephi...” from verse 33,
one body line above verse 34's correct first shared line:
“slain for the sins of the world. And after he was slain I saw”. The top-left
notch is therefore being applied to the wrong physical line and leaves the
suffix of verse 33 visible. The bottom-right notch is likewise attached to the
wrong line ordinal rather than verse 34's final shared line containing
“...the Lord. And the multitude”.

The cached Gemini line OCR for the 1852 reference page identifies those
boundary lines explicitly, and the 1852 reference geometry follows them. The
1854 defect is primarily a family line-registration/vertical-origin error, not
proof that the top-left notch width alone is wrong. Exact replacement
coordinates must be re-derived from the correct 1854 line bands and adjacent
word gaps.

The row exactly matches both:

- the current production value; and
- the real shadow’s July 26 baseline.

It has no entry in `fax_shadow_changes`. This proves that the bad adjustment
was introduced before the shadow-tuning phase and survived all later QA.

Source statement:

`docs/sql/fax-nonseeds-whitespace-repair-2026-07-26.sql:15763`

## Impact

### User-visible impact

Affected facsimile highlights may:

- omit the first word or phrase of a verse;
- omit the last word or phrase;
- include the last word or line of the previous verse;
- include the first word or line of the next verse;
- show large blank notches across valid text;
- cut through glyphs;
- carry meaningless notches at page or column boundaries;
- display no highlight if structural rows were deleted or ownership was moved
  incorrectly.

This damages the core promise of the facsimile feature: that hovering or
opening a verse highlights the corresponding printed source text.

### Data impact

The incident is scoped to `bom_xtras_fax_index`. No canonical scripture text
or scan image was changed.

The table currently contains 255,770 rows.

The consolidated artifact’s target union, mapped to current UIDs, is:

| Layer | Target/risk count |
|---|---:|
| Boundary and derivative rows | 16,914 |
| Non-seed pixel/whitespace UIDs | 83,294 |
| Geometry-manifest UIDs | 600 |
| Source-ownership current UIDs | 77 |
| Deduplicated union | 97,185 |
| Union as percentage of table | 38.00% |

This 97,185-row figure is a **risk envelope**, not a claim that all those rows
are wrong or that all changed during the final import. Many statements were
already applied, were no-ops, overlapped another layer, or were superseded.

Important overlaps include:

- boundary/pixel: 3,352 UIDs;
- pixel/geometry manifest: 210 UIDs;
- boundary/geometry manifest: 124 UIDs;
- ownership/geometry manifest: 54 UIDs;
- ownership/pixel: 17 UIDs.

Those overlaps are exactly why concatenation could not produce a trustworthy
final state.

### Verified production state after the Adminer import

Before the final import:

- row count: 255,770;
- SHA-256: `ecd324f9bd4d12c6da18dabc3493cd515d94ac86b9672aa7a18fa4603f4a17b6`.

After the final import:

- row count: 255,770;
- SHA-256: `d44e106df17d317f72bbfa159a831dc7b74cdbed316cc5bb6e97fed3af473d64`.

Post-state agreement with intermediate artifacts was:

| Artifact | Exact proposed | Still old | Other/superseded | Missing/deleted |
|---|---:|---:|---:|---:|
| Combined boundary, 16,914 updates | 13,782 | 0 | 3,132 | not represented here |
| Pixel/whitespace, 83,293 parsed pixel updates | 83,067 | 11 | 215 | — |
| Geometry, 582 updates | 526 | 0 | 54 | 2 |
| Geometry, 18 deletes | — | — | — | all 18 absent |

Again, “exact proposed” is not a correctness result.

## The intended shadow state was not deployed

The real tuned shadow contains:

| Metric | Count |
|---|---:|
| Baseline rows | 255,770 |
| Candidate rows | 255,120 |
| Recorded `fax_shadow_changes` | 41,102 |
| Same-UID rows changed from baseline | 41,088 |
| Candidate-only rows | 54 |
| Baseline-only rows | 704 |

Compared directly with current production:

| Difference | Count |
|---|---:|
| Same UID, different geometry/ownership | 41,101 |
| Shadow-only UIDs | 54 |
| Production-only UIDs | 704 |
| Exact same UIDs | 213,965 |

Therefore the claim that the consolidated SQL “reflected the work done in the
shadow” was false. It deployed old/intermediate artifacts while leaving the
actual tuned candidate substantially different from production.

The tuned shadow itself must not be deployed wholesale either: its handoff
states that exhaustive QA was still non-green.

## Blast radius assessment

### Confirmed

- At least one user-visible geometry is demonstrably wrong:
  `1854/1.nephi.11.34`.
- The broad pixel/whitespace layer can place notch fills across valid verse
  text.
- The final production state differs from the verified pre-final-import state.
- The actual shadow candidate was not the source of the exported SQL.
- Up to 97,185 current UIDs were in scope across the concatenated layers.

### Suspected

The highest-risk cohort is the 83,294-UID pixel/whitespace sweep, especially
rows with:

- nonzero `TLW/TLH` or `BRW/BRH`;
- large snap displacement;
- displacement beyond robust edition/family norms;
- notch dimensions near a full line height;
- multi-page or multi-column verses;
- top/bottom edges near page boundaries;
- family members whose relative notch topology disagrees;
- first/last canonical tokens absent from deterministic OCR;
- source ink intersecting the proposed fill rectangle.

### Not established

It is not established that all 97,185 target rows are damaged. It is also not
established that reverting every pixel adjustment would improve every row.
Some repairs are likely valid.

The correct conclusion is that the broad cohort is untrusted and must be
independently classified.

## Discovered problem statement

The core algorithmic problem is not simply “whitespace snapping failed.” It is:

> Local pixel whitespace is insufficient to determine semantic verse
> ownership. A geometrically empty run can be the wrong boundary if reaching it
> crosses a word, skips punctuation such as an em dash, enters another line,
> or belongs to a neighboring page/column/verse.

The system lacked a hard ownership invariant connecting:

1. canonical first/last verse tokens;
2. deterministic OCR word boxes;
3. source-scan connected components;
4. the proposed exterior notch rectangles; and
5. family-relative geometry.

It also lacked deployment-level invariants:

- exactly one final desired operation per UID;
- immutable baseline/candidate identities;
- no unresolved QA failures;
- a bounded canary;
- a complete rollback artifact;
- and post-apply render checks against known regressions.

## Recommended remediation

### Phase 0: Freeze and preserve

Before any further fax writes:

1. Freeze production writes to `bom_xtras_fax_index`.
2. Dump the current production table, including UIDs and auto-increment state.
3. Preserve copies of:
   - current production;
   - `backend/.shadow/fax-shadow.sqlite`;
   - its `fax_index_baseline`;
   - the repository-root post-import shadow;
   - every SQL artifact and Adminer/server log.
4. Record hashes and row counts for each artifact.
5. Do not regenerate or overwrite either shadow file.

### Phase 1: Undo the final consolidated import

The real shadow’s `fax_index_baseline` is an exact copy of the verified
pre-final-import production state:

- 255,770 rows;
- hash `ecd324f9...f4a17b6`.

Generate a guarded recovery SQL by diffing current production against that
baseline. Do not concatenate existing rollback files.

The recovery must:

- update rows whose UID exists in both states;
- reinsert rows missing from production with their original UID;
- remove rows introduced after the baseline only when their complete current
  value matches the expected incident value;
- preserve unrelated concurrent changes;
- stop on the first mismatch;
- verify the exact final row count and hash before commit.

This returns production to the state immediately before the final consolidated
import. It does **not** remove earlier unsafe pixel-sweep changes.

Preferred alternative: if MySQL point-in-time recovery/binlogs are available,
restore this table to the last verified pre-import timestamp in an isolated
database, compare it to `fax_index_baseline`, and promote only after the hashes
match.

### Phase 2: Reconstruct the pre-pixel state

To address defects such as `1854/1.nephi.11.34`, reconstruct the state before
the broad non-seed sweep using, in priority order:

1. a database backup or MySQL binlog from before the pixel SQL was applied;
2. an older full table dump;
3. the old-value predicates embedded in
   `fax-nonseeds-whitespace-repair-2026-07-26.sql`.

Do not blanket-reverse the 83,294 rows without simulation. Later valid edits
may overlap them. Build the inverse in reverse application order and classify
every UID as:

- safely reversible;
- superseded by a later accepted change;
- structurally changed;
- ambiguous and requiring review.

### Phase 3: Establish one immutable baseline and one candidate

Create immutable files such as:

- `fax-prod-preincident.sqlite`
- `fax-candidate-v1.sqlite`

Every candidate mutation must be recorded with:

- source report;
- algorithm version;
- before and after rows;
- reason code;
- confidence/gates;
- QA outcome;
- reviewer, if manually accepted.

Never use the process working directory to determine which shadow is
authoritative. Require an explicit `--shadow` path and print its hash before
every operation.

### Phase 4: Replace whitespace-only acceptance with ownership gates

For each proposed boundary:

1. **Canonical token coverage**
   - deterministic OCR must recover the verse’s first and last distinctive
     tokens within the retained region;
   - the fill region must not contain those tokens.
2. **Ink-intersection test**
   - threshold the source scan;
   - reject any notch intersecting connected ink components beyond a small
     noise tolerance;
   - reject a boundary that bisects a component or word box.
3. **Snap-distance distribution**
   - record old edge, candidate edge, and displacement;
   - compute robust per-edition/per-family median and MAD;
   - reject or review large robust z-score outliers;
   - use absolute caps tied to line height and median character width.
4. **Line topology**
   - a top-left notch may affect only the first boundary line;
   - a bottom-right notch may affect only the final boundary line;
   - reject notches spanning page/column boundaries or multiple text lines.
5. **Family consistency**
   - compare normalized shape and notch topology across editions made from the
     same plates;
   - require version-specific registration and snapping;
   - never copy final geometry blindly across a family.
6. **Counterfactual comparison**
   - render old and proposed crops;
   - score canonical token gain/loss;
   - accept only when the proposal improves ownership without losing target
     text.

### Phase 5: QA gates before SQL generation

No SQL may be generated while any accepted cohort has unresolved failures.

Required gates:

- zero impossible geometry;
- zero negative or out-of-page dimensions;
- zero notch/ink intersections above tolerance;
- zero page/column-break notches without explicit justification;
- zero missing canonical opening/closing tokens on OCR-reliable scans;
- zero known-regression failures;
- family-relative outliers reviewed or excluded;
- all missing/degraded scans explicitly bracketed as unavailable;
- stratified random render review for every impacted version;
- 100% review of changed rows with nonzero notches until the heuristic is
  proven reliable.

Warnings are not green. “Generic review warning” cannot be treated as pass.

### Phase 6: Generate one resolved SQL delta

The exporter must read:

- one immutable baseline DB;
- one accepted candidate DB.

It must emit:

- one final update per changed UID;
- explicit guarded deletes;
- explicit inserts with deterministic UIDs;
- a rollback file generated from the same diff;
- expected operation counts by version;
- baseline and candidate hashes;
- preflight checks;
- post-state checks;
- an all-or-none commit.

Intermediate SQL files must never be concatenated.

### Phase 7: Canary deployment

Deploy in small stages:

1. one known-bad verse;
2. one page;
3. one edition;
4. one printing family;
5. only then the remaining accepted cohort.

After each stage:

- query production;
- render from production;
- run deterministic content QA;
- manually inspect high-risk/notched cases;
- verify row counts and hashes;
- stop immediately on any regression.

Never use `mysql --force`. Preserve complete command/Adminer output.

## Immediate decision recommendation

The safest next action is:

1. preserve the current table and both shadow databases;
2. generate and simulate a guarded restore to the real shadow baseline hash
   `ecd324f9...f4a17b6`;
3. validate that restore in a clone, including representative render crops;
4. restore production to that pre-final-import state;
5. separately investigate and remediate the earlier 83,294-row pixel cohort.

Do not deploy the real tuned shadow wholesale. It contains substantial work,
but its own handoff records unresolved QA failures.

## Accountability statement

The key failure was not that a heuristic produced an imperfect candidate.
Heuristics are expected to produce failures.

The failure was promoting unverified intermediate artifacts to production
after the authoritative shadow was missed, despite explicit evidence that QA
was not green. The remediation process must therefore address both the
geometry algorithm and the deployment/source-of-truth controls that allowed a
non-green candidate to be represented as complete.
