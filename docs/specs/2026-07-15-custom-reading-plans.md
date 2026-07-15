# Custom Reading Plans — Design Spec

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan
**Predecessor:** `docs/audits/2026-07-15-reading-plan-audit.md` (read it first — this spec assumes its findings)

## Problem

The reading-plan feature renders exactly one manually-seeded plan (`cfm2024`), which ended 2024-12-21. There is no write path, no discovery, no user↔plan relationship, and the frontend has a family of dead-plan rendering bugs. Users cannot create plans at all, let alone at their own pace.

## Goal

Users create **personal reading plans** from three independent axes — scope × pacing × segmentation — or start one from a curated **program catalog**. The dead-plan bug class becomes structurally impossible.

## Decisions (settled during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Plan visibility | **Personal only.** Creator is the only follower. Group/shared plans are future work. |
| D2 | Concurrency | **One active plan per user.** Starting a new one requires finishing/abandoning the current. History remains viewable. |
| D3 | Prior reading credit | **Creator chooses at creation**: "start fresh" (only log entries after plan start count) vs "count past reading" (all-time). |
| D4 | Curated offerings | **Programs (templates), not schedules.** Curated rows carry relative pacing only — no dates — so they cannot expire. Users instantiate them as personal plans. The calendar-locked CFM model is retired. |
| D5 | Architecture | **C — config + materialized segments.** Plan rows store the recipe (JSON config); creation materializes real segment rows; segments are regenerable from config. Existing read pipeline/theater seam untouched. |
| D6 | Programs storage | **Dedicated `bom_readingplan_program` table** — not owner=NULL sentinel rows (avoids implicit overloading). |
| D7 | Builder UI | **Step wizard** (What → How fast → Confirm), one question per step. |
| D8 | Scope picker | **Tabbed checklist + basket**: tabs for site guide (12 divisions → pages) and canonical books (→ chapters); multi-select with size badges; to-scale selection strip. |
| D9 | Atomic unit | **Section is the atom of plan composition; block is the atom of progress measurement.** Segments are contiguous runs of whole sections, always. |
| D10 | Seeding | The program catalog seed is **a versioned, idempotent script in the repo**, part of the implementation plan — never manual DB insertion. |

## Data model

### `bom_readingplan` (extended — holds ONLY user plans; `owner` always set)

| Column | Status | Notes |
|---|---|---|
| `guid`, `slug`, `title` | existing | slug generated per plan (existing query API keys on it) |
| `owner` | existing, now used | username, NOT NULL for all new rows |
| `startdate` | existing | user's personal start; credit-window floor when `credit=fresh` |
| `duedate` | existing | NULL for self-paced |
| `status` | **new** | `active` / `completed` / `abandoned` |
| `config` | **new**, native `JSON` type | the recipe (below) |

One `active` plan per owner, enforced in the mutation (and defensively re-checked in SQL).

New/altered columns and the new table use `utf8mb4` / `utf8mb4_0900_ai_ci` per project convention.

**Why JSON for config:** write-once, read only by generator code, never filtered/joined/partially updated by SQL, polymorphic by type, contains a variable-length list. Everything the DB engine reasons about (`owner`, `status`, dates) stays relational. Escape hatch if that ever changes: MySQL indexed generated columns over JSON paths.

### `bom_readingplan_seg` (structure unchanged)

`guid, plan, period, ref, title, duedate, start, end, sectionGuids` — self-paced segments have NULL duedates and periods like "Part 3". Rows are **regenerable from config**; safe because progress lives in `bom_log`. `sectionGuids` is always exact (whole sections only, per D9).

### `bom_readingplan_program` (new)

| Column | Notes |
|---|---|
| `guid`, `slug` | identity; slug used by gallery + `startReadingPlan` |
| `title`, `description` | display copy; translatable via `bom_translation` keyed by guid |
| `config` | JSON recipe, same vocabulary as personal plans; **relative pacing only, no absolute dates** |
| `sort`, `active` | gallery ordering; soft-retire without deleting |

### Config JSON vocabulary

```json
{
  "scope":        {"type": "sections", "guids": ["..."]},
                  // or {"type":"pages","slugs":[...]}
                  // or {"type":"range","start":<verseId>,"end":<verseId>}
  "pacing":       {"type": "cadence", "unit": "day", "count": 30},
                  // or {"type":"calendar","due":"YYYY-MM-DD"} (user plans only, never programs)
                  // or {"type":"selfpaced"}
  "segmentation": {"type": "even", "parts": 30},
                  // or {"type":"section"} or {"type":"page"}
  "credit":       "fresh"   // or "alltime"
}
```

Whatever vocabulary scope arrives in, the generator resolves it to an ordered list of section guids (D9). Canonical ranges snap to whole sections; the preview shows the true post-snap boundaries.

## GraphQL API

### Queries

```graphql
# EXTENDED: slug optional; omitted → caller's active plan
readingplan(token: String, slug: String): ReadingPlan

# NEW: program catalog (active rows, sorted)
readingplanprograms(token: String): [ReadingPlanProgram]
  # → { slug, title, description, scopeLabel, durationLabel }

# NEW: past plans
myreadingplanhistory(token: String): [ReadingPlanSummary]
  # → { slug, title, status, startdate, enddate, progress }

# NEW: dry-run the generator for the wizard preview — generate, don't persist.
# Guarantees preview and real plan can never disagree; source of clamp warnings.
previewReadingPlan(token: String, config: String!): PlanPreview
  # → { parts, segments: [{ref, blocks, duedate}], warnings: [{code, detail}] }
```

### Mutations (first write path this feature has had)

```graphql
startReadingPlan(token: String!, input: StartPlanInput!): ReadingPlan
# input: { programSlug: String, title: String, config: String, startdate: String }
# From a program (programSlug + overrides: startdate, credit) or raw config.
# Validate → enforce one-active (error ACTIVE_PLAN_EXISTS) → materialize segments → return plan.

updateReadingPlan(token: String!, input: UpdatePlanInput!): ReadingPlan
# Re-pace: pacing/segmentation only. Scope is immutable (new scope = new plan).
# Re-runs generator, replaces segment rows.

endReadingPlan(token: String!, action: PlanEndAction!): ReadingPlan
# COMPLETE | ABANDON — sets status, stamps end date.
```

### Type changes on `ReadingPlan`

- `status: String`
- `config: String` (JSON passthrough for the editor)
- `current: Int` — active-segment index **computed server-side**: date-based for calendar/cadence, first-incomplete for self-paced. Kills the frontend's duplicated date math (audit P0 #2/#3 root).
- `plan.progress` from the server is **authoritative**; the frontend recomputation (audit P1 #6) is deleted.

Auth: existing token→user resolution; mutations require a real user. Anonymous users see the gallery but must sign in to start a plan.

## Segment generator

Deterministic: `generate(config, contentDB) → segment rows`. Same inputs ⇒ same output; regeneration is safe anytime.

```
scope ──▶ ordered section list ──▶ slice ──▶ pacing metadata ──▶ rows
```

1. **Resolve scope → ordered whole sections.** Pages/divisions: slugs → sections (existing content queries). Canonical range: verse ids → overlapping sections, snapped to whole sections. Reuses the resolution family behind the theater queue and CFM cache fallback.
2. **Slice.** `even N`: N contiguous chunks of whole sections, **weighted by block count** (sections vary widely — Alma ≠ Omni). `section`/`page`: one segment per natural unit. **Clamp rule:** if parts > section count, plan becomes section-count parts; surfaced as `PARTS_CLAMPED` warning in preview, stated plainly in the wizard.
3. **Pacing metadata.** Cadence: `duedate[i] = startdate + i × unit`, period "Day 3"/"Week 2". Calendar: dates spread evenly start → due. Self-paced: NULL dates, period "Part 3". `ref` labels generated from each chunk's verse range via the existing scripture-reference utilities (exact util pinned during planning).
4. **Regeneration.** Re-pacing replaces rows → segment guids change. Progress unaffected (bom_log). Bookmarked `/theater/plan/<old-guid>` links die — accepted (transient launch links).

## Progress semantics

- Completion source stays `bom_log` (`type='block'`, credit ≥ threshold) — unchanged, one source of truth.
- **Credit window:** `fresh` → `timestamp > plan.startdate`; `alltime` → no floor. One parameter in the existing queries.
- **Status badge:** calendar/cadence keep on-track/catching-up/behind semantics (thresholds as today, but computed against server `current`). Self-paced shows plain % complete — no "behind" concept exists for it.
- Auto-complete: plan flips to `completed` when progress hits 100 (checked on read; no cron).

## Frontend

### Home widget states (replaces hardcoded `<ReadingPlan slug="cfm2024">` in `Home.js:95`, `showcase.js:43`)

1. **No active plan** → program gallery: seeded program cards, a dynamic "Study a guide division" row (rendered from the contents structure, not seeded), and "Build your own" → wizard. Welcome-page showcase reuses this state.
2. **Active plan** → today's/current segment via existing UI vocabulary (segment strip, dots, mini progress) on the new contract (server `current` + `progress`; resume-point uses `"completed"` matching — fixes audit P0 #4).
3. **Just completed** → celebration, final stats, "start another" → gallery.
4. **Error** → error card with retry. No perpetual skeleton (fixes audit P0 #5).

### Creation wizard (D7) — modal/panel, 3 steps

- **Step 1 — What** (D8): tabbed checklist (Our Guide | Books) with expand-to-partial (pages under divisions, chapters under books), size badges (sections · blocks), basket with to-scale selection strip. Data: divisions/pages from the existing contents query; canonical books/chapters from static canon + scripture-ref utils; sizes client-side + confirmed by preview.
- **Step 2 — How fast**: pacing radio (daily × N / weekly × N / finish-by-date / self-paced) + segmentation (even N / by section / by page) + credit toggle.
- **Step 3 — Confirm**: `previewReadingPlan` result — parts, per-segment refs, end date, clamp warnings. Start button → `startReadingPlan`.

### Component rewrite scope

`ReadingPlan.js` is rewritten (not patched): the audit's P0s are all resolved by the new contract, and its P2 hygiene list (CSS wholesale duplication, per-item tooltip roots, dead imports, render-time mutations, `Math.random()` keys, a11y on segment strip) rides along. Dark-mode coverage extended to the new surfaces (gallery, wizard).

## Seed catalog (editorial placeholder — owner rewrites at will)

1. *Book of Mormon in a Year* — whole book, weekly × 52, even
2. *90-Day Challenge* — whole book, daily × 90, even
3. *One Page at a Time* — whole book, self-paced, by page
4. *Mosiah in 30 Days* — Mosiah, daily × 30, even
5. *Messianic Ministry Deep Dive* — that division, self-paced, by section

## Error handling

- Mutations return structured errors: `ACTIVE_PLAN_EXISTS`, `INVALID_CONFIG`, `EMPTY_SCOPE`, `NOT_AUTHENTICATED`.
- Preview returns **warnings** (non-fatal): `PARTS_CLAMPED { max }`.
- Wizard blocks Start only on hard errors; clamps adjust the plan and say so.
- Widget fetch failures → retryable error state.

## Rollout

1. **Migration + seed (in-repo, idempotent):** create `bom_readingplan_program`; alter `bom_readingplan` (add `status`, `config`); seed catalog. (D10)
2. **Backend:** generator + mutations + queries. Generator unit tests: determinism, block-count weighting, whole-section snapping, clamping, all three pacings, both credit windows. Integration tests: one-active enforcement, program instantiation, preview/start agreement.
3. **Frontend:** widget states, gallery, wizard, rewritten plan renderer + tests.
4. **Cleanup (requires owner approval — prod data):** delete orphaned `cfm2024` rows after launch. Nothing references them once the widget switches; user reading history in `bom_log` is untouched either way.

Dev note: plan mutations are ordinary user writes, same class as the group-membership mutations that already function on the dev backend — no new sandbox carve-out.

## Out of scope (explicit v1 exclusions)

- Group/shared plans and leaderboards (obvious v2 join point via enrollments)
- Notifications/reminders
- Streak mechanics beyond plain % for self-paced
- Free-text scripture-range input in the picker (parser exists; v1.5 candidate)
- Calendar-aligned curated schedules (true CFM-2026 weekly sync) — retired by D4
- Editing scope mid-plan (abandon + recreate instead)

## Acceptance criteria

1. A signed-in user with no plan sees the program gallery on Home; starting *Mosiah in 30 Days* yields an active plan with 30 dated daily segments (or clamped honestly if config were smaller).
2. A custom self-paced plan over one guide division shows "Part N" segments, no dates, no on-track/behind badge, and `current` = first incomplete segment.
3. The credit toggle demonstrably changes initial progress for a user with prior reading history.
4. Starting a second plan while one is active is refused with `ACTIVE_PLAN_EXISTS`; after abandoning, it succeeds; the abandoned plan appears in history.
5. Re-pacing an active plan regenerates segments without losing progress.
6. Theater launches from any segment via the existing `{plan: guid}` queue seam.
7. Wizard preview and created plan always agree (same generator).
8. No code path can ever render a "dead" plan: programs carry no dates, and expired user plans (calendar type past due) show completed-or-behind states, never blank footers or NaN progress.
