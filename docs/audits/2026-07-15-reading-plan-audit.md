# Reading Plan Audit — Top to Bottom

**Date:** 2026-07-15
**Scope:** `frontend/webapp/src/views/Home/ReadingPlan.js` + `.css`, backend readingplan pipeline (`backend/`), DB tables, theater integration.
**Purpose:** Establish what works and what doesn't before expanding from the single hardcoded Come Follow Me plan to user-created plans (time-based, progress-based, custom pacing).

---

## Executive summary

The feature is a **read-only renderer for a single, manually-seeded, now-expired plan**. The live DB contains exactly one plan (`cfm2024`, ended **2024-12-21**) hardcoded in two components — so for ~19 months the home page has shown a dead plan, and a frontend math bug makes it display **0% / "Not Started" for every user regardless of actual progress**. There is **no write path anywhere** (no mutations, no admin UI, no seed scripts), no plan listing/discovery query, and no per-user plan state. The underlying primitives, however, are good and reusable: verse-range segmentation, log-derived progress, theater queue integration, per-guid translations.

---

## Architecture map (as-is)

```
Home.js:95 ──slug="cfm2024" (hardcoded)──▶ <ReadingPlan/>
Welcome/pages/showcase.js:43 ──same──▶ <ReadingPlan/>

ReadingPlan.js
 ├─ readingplan(token, slug) ──▶ community.ts:470 ─▶ messaging/readingplan.ts:143
 │    bom_readingplan (1 row) + bom_readingplan_seg (49 rows, ordered by start)
 │    progress = completed blocks in bom_log (credit ≥ PERCENT_TO_COUNT_AS_COMPLETE, default 40,
 │               timestamp > plan.startdate) ÷ blocks in non-future segments
 └─ readingplansegment(token, guid) ──▶ ported_community.ts:58 ─▶ loaders/ported_community.ts:95
      per-block completion_status via bom_log LEFT JOIN; sections via cached
      sectionGuids JSON (fallback: bom_lookup verse_id range join)

Theater: /theater/plan/:guid ─▶ Theater.js:226 ─▶ queue items [{plan: guid}]
         ─▶ loaders/queue.ts:252 getBlocksFromReadingPlan()
```

**DB:**
- `bom_readingplan` — guid, slug, title, **owner (varchar, always NULL — reserved, unused)**, startdate, duedate. 1 row.
- `bom_readingplan_seg` — guid, plan (FK=slug), period, ref, title, duedate, `start`/`end` (**verse_id range**), sectionGuids (cached JSON). 49 rows.
- Per-user progress: **derived entirely from `bom_log`** (no per-user plan rows).

---

## What works (keep / reuse)

1. **Verse-range segmentation** — segments are `start`/`end` verse_ids resolved to sections/blocks via `bom_lookup`, with a `sectionGuids` cache + on-the-fly fallback (`readingplan.ts:104-113`). A clean primitive for arbitrary user-defined segmentation.
2. **Log-derived progress** — no denormalized per-user plan state; completion is computed from `bom_log` credit. One source of truth for "did the user read this."
3. **Theater seam** — `{plan: segmentGuid}` queue items already work end-to-end (`queue.ts:252-278`).
4. **i18n infra** — segment title/ref/period translatable per-guid via `bom_translation`; all 8 UI labels exist in en/ko baselines.
5. **UI vocabulary** — segment strip with status coloring, per-section dot rows (green/yellow/blank), mini progress bars, tooltips. Dark mode fully covered (`darkmode.scss:130-273`).
6. **Unmount-cancellation guards** on both fetches (recent fix, correct).
7. **Lazy segment detail** — plan shell loads first; segment content fetched on demand per guid.

---

## What's broken

### P0 — product-level

| # | Finding | Where |
|---|---------|-------|
| 1 | **The only plan is dead.** `cfm2024` ended 2024-12-21; slug hardcoded in `Home.js:95` and `showcase.js:43`. Verified live: last segment duedate 2024-12-21. | DB + 2 call sites |
| 2 | **Everyone sees 0% / "Not Started."** `nonFutureSegments` appends `segments.find(isAfter(today))` — `undefined` once the plan is over — then `parseFloat(undefined?.progress)` = `NaN` poisons the reduce; `isNaN` guard collapses to 0. A user with 100% completion shows 0%. | `ReadingPlan.js:55-60,72` |
| 3 | **Footer/detail pane renders nothing.** `activeSegment = findIndex(duedate isAfter today)` = `-1` post-plan → `segments[-1]` → `undefined` → `ReadingPlanSegment` returns null. No Study/Theater buttons for 19 months. | `ReadingPlan.js:40-43,118` |
| 4 | **"Resume point" never resumes.** Study button targets first block with `status !== "complete"`, but the API emits `"completed"`/`"started"` — the filter matches everything, so it always links to the segment's first block. | `ReadingPlan.js:224` vs `:260,:280` |
| 5 | **No error/empty states.** Unknown slug or API failure → perpetual skeleton loader. | `ReadingPlan.js:96,213` |

### P1 — correctness / SSoT

| # | Finding | Where |
|---|---------|-------|
| 6 | **Frontend discards backend progress and recomputes it differently.** Backend returns item-weighted plan progress; frontend overwrites `planData.progress` with an *unweighted mean of segment percentages* — two formulas, mutated into state during render. | `ReadingPlan.js:58-75` vs `readingplan.ts:176-198` |
| 7 | `pastSegmentsAreComplete` uses strict `progress === 100` on a 2-decimal-rounded Float (99.99 ≠ 100). | `ReadingPlan.js:68` |
| 8 | Duplicated date logic: backend compares `YYYY-MM-DD` lexically (UTC-ish), frontend uses local-time `moment()` — the two can disagree around midnight/timezones. | `readingplan.ts:180` vs `ReadingPlan.js:40,52` |
| 9 | `slug` prop changes never refetch (`useEffect` deps `[]` + `if(planData) return`). Moot today (hardcoded), a landmine for multi-plan. | `ReadingPlan.js:28-48` |

### P2 — React/code hygiene

| # | Finding | Where |
|---|---------|-------|
| 10 | `Math.random()` in a render key remounts every section list on each render (kills reconciliation, refires img loads). | `ReadingPlan.js:227,239` |
| 11 | Render-time prop mutation: `section.progress = …`. | `ReadingPlan.js:263` |
| 12 | A `ReactTooltip` root rendered **per section item** inside the map (duplicate tooltip instances). | `ReadingPlan.js:266` |
| 13 | Dead code: `Spinner`, `NavLink`, `useRouteMatch` imports; `history` in `ReadingPlanSegmentSections`; unused `index` param; `url` field always null end-to-end. | `ReadingPlan.js:6,16,195` / schema |
| 14 | `data-html={true}` tooltips interpolate plan-sourced strings — **an XSS surface the moment plan titles become user-authored** (critical for this expansion). | `ReadingPlan.js:171` |
| 15 | a11y: segment items are clickable divs (no keyboard/role); button icons `<img>` without alt. | `ReadingPlan.js:169-176,234,237` |
| 16 | CSS file is ~wholesale duplicated (lines ~280-545 repeat ~1-360); hardcoded status colors scattered (`#6bd098/#fbc658/#fb8358/#6c757d`). | `ReadingPlan.css` |

---

## Expansion blockers (gaps between as-is and user-created plans)

1. **Zero write path.** No GraphQL mutations touch `bom_readingplan*`; no admin UI; no seed scripts in-repo. The one plan was inserted outside the codebase.
2. **No discovery.** No query lists plans; consumers must know a slug a priori. Slug is hardcoded in two components.
3. **No user↔plan relationship.** Plans are global; `owner` column exists but is unused. No enrollment, no per-user start date, no "my active plan(s)" concept.
4. **Progress window assumes calendar plans.** Completion counts `bom_log` entries with `timestamp > plan.startdate` — meaningless for self-paced plans (no dates) and wrong for re-reads (a user's 2024 reading credits a 2026 enrollment... or doesn't, depending on the plan row's date, not the user's).
5. **Pacing is calendar-only.** The whole status model (on-track/behind) keys off per-segment `duedate`. No progress-based ("N sections per sitting"), streak-based, or open-ended pacing.
6. **No lifecycle.** No draft/active/completed/archived states; no way to end, restart, or switch plans.
7. **No group linkage.** Study groups (a mature feature here) and plans are unaware of each other — an obvious future join point.
8. **Dev sandbox constraint.** Dev runs against the DB read-only by default (`sandboxMode`); plan authoring requires a deliberate write-path decision for the dev environment.

---

## Reusable assets inventory

| Asset | Location | Reuse for |
|-------|----------|-----------|
| Verse range → sections/blocks resolver | `readingplan.ts:104-113`, `queue.ts:252` | Any segmentation scheme (by chapter, by page count, by even division) |
| Completion scoring (credit threshold) | `readingplan.ts:56-67,122-135` | All progress math |
| Segment completion SQL (per-block status) | `loaders/ported_community.ts:134-158` | Segment detail for custom plans |
| Theater queue plan items | `Theater.js:226`, `queue.ts:252` | Works for any segment guid |
| Per-guid translations | `bom_translation` refkeys title/ref/period | Curated plans (user plans likely untranslated) |
| Segment strip / dots / progress UI | `ReadingPlan.js` + CSS + dark mode | Rendering any plan shape |

---

## Recommendation snapshot

Fix-in-place is not enough: items 1-5 stem from the same root (a single hardcoded calendar plan with no lifecycle). The component rewrite should ride along with the custom-plans design rather than patching the dead-plan math first. Design work is tracked separately (spec to follow in `docs/specs/`).

---

## Resolved

All findings in this audit are addressed by the custom reading-plans implementation on branch `feat/custom-reading-plans` (plan: `docs/plans/2026-07-15-custom-reading-plans.md`).

- **P0 items 1-5** (dead plan, 0% display, empty footer, broken resume, no error states): replaced by a full widget state machine (`index.js`), gallery (`Gallery.js`), and active-plan renderer (`ActivePlan.js`) that supports multiple user-created plans with live progress, error/complete/abandon states, and correct current-segment logic.
- **P1 items 6-9** (frontend progress recompute, strict equality, date mismatch, no refetch): backend is now the single source of truth for progress; frontend does not recompute. `slug` dependency is dynamic; plan is refetched on user change.
- **P2 items 10-16** (random keys, prop mutation, tooltip duplication, dead imports, XSS, a11y, CSS duplication): addressed in the rewritten components; CSS consolidated in `ReadingPlan.css`.
- **Expansion blockers 1-8**: write path added (`startReadingPlan`, `updateReadingPlan`, `endReadingPlan`); program catalog (`readingplanprograms`) and preview (`readingplanpreview`) queries implemented; history query (`readingplanhistory`) added; per-user plan rows tracked in `bom_readingplan` with `owner` column populated.
- **Dark mode**: gallery/wizard/error/complete surfaces covered in `darkmode.scss` (T16).
