# Backend Contents Slice Implementation Plan

> Executes inline (single session). Spec: `docs/specs/2026-06-09-greenfield-backend.md`.

**Goal:** `Query.division` end-to-end in the green-field backend — the contents API
(12 divisions → pages → sections, en+ko) — gated by the regression suite AND a live
side-by-side legacy(:5005) vs new(:5006) comparison.

**Scope:** the `contents` and `divisionShell` matrix selections: `division(slug)` with
`title slug description pages { title slug counts sections { title slug } }`.
Out of scope: `progress` (auth slice), full `Page`/`page` query (content slice proper).

## Legacy mechanics being replicated (from src/resolvers/BomPage.ts:15-40, 340-398)

1. **Arg handling:** `slug` array → last path segment each (`getSlugTip`). No slug → all divisions.
2. **Division filter:** join through `bom_slug` (`divSlug` association) on the slug.
3. **Ordering:** divisions by `weight`; pages by `weight`; sections by **first text link**
   (the legacy ORDER BY `sectionText.link` side-effect; same ordering the legacy
   `Page.counts` SQL uses: `GROUP BY section ORDER BY min(link)`).
4. **Fields:** `Division.title` = titlepage's translated `title`; `Division.slug` =
   recursive `bom_slug` path of titlepage guid; `Division.description` translated;
   `Page.title`/`Section.title` translated; `Page.slug`/`Section.slug` = recursive
   slug paths; `Page.counts` = per-section text counts in min-link order.
5. **Translation refkeys:** `description` (division guid), `title` (page guids,
   section guids — incl. titlepage).

## New implementation

- `data/slugResolver.ts` — batch slug-path resolution: load `bom_slug` rows for guids
  (`link in (...)`), walk `parent` chains in memory (2-3 batched queries total instead
  of legacy's one recursive CTE **per entity**). Output identical to the legacy
  `GROUP_CONCAT` walk; missing rows → `'error/loading/slug'` like legacy's catch.
- `data/contentsRepository.ts` — four batched queries: divisions(+titlepage guid via
  `division.page`), pages (`parent in` division guids, weight order), sections
  (`parent in` page guids), one aggregate over `bom_text`
  (`page in (...) GROUP BY page, section ORDER BY min(link)`) that yields BOTH section
  ordering AND `counts`. Translator overlays; SlugResolver paths; assembles
  response-shaped `Division` domain objects.
- `services/contents.ts` + `Query.division` resolver wiring.
- Domain types in `domain/contents.ts`.

## Verification (definition of done)

1. `npm test` (backend vitest) + `npx tsc --noEmit` green.
2. Suite: `TARGET=next ... -t "contents."` and `-t "divisionShell."` — 6 cases green
   (en+ko × single/batch/shell) against prod-captured baselines.
3. **Side-by-side:** new script `backend/scripts/ab-compare.mjs` POSTs an identical
   query to legacy (:5005) and new (:5006) for both `/en` and `/ko` and diffs the JSON
   bodies — run with the full contents selection and the divisionShell selection;
   all four comparisons must be byte-identical.
