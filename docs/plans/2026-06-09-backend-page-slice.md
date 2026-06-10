# Backend Page Slice Implementation Plan

> Executes inline. Spec: `docs/specs/2026-06-09-greenfield-backend.md`. The deepest
> tree in the API — the frontend `page` query selection:
> `page(slug) { title slug sections { title slug rows { weight type narration
> { description text { guid slug heading content chrono duration quotes{...}
> people{...} places{...} refs{...} notes{...} } } connection { isPage type text slug }
> capsulation { description reference slug } } } }`

## Legacy mechanics (src/resolvers/BomPage.ts, BomPeoplePlace.ts, lib.ts)

- **page root** (BomPage.ts:42): slug-tip filter through `bom_slug` (`pageSlug` assoc),
  order pages `weight`, sections `weight`, sectionText `link`.
- **Section.rows** (:405): `bom_sectionrow` by parent, `weight` order; `Row.type` gates
  which child renders: `N`→narration, `C`→connection, `O`→capsulation (:439-455).
- **Narration**: `description` translated; `text` = BomText rows with
  `parent = narration.guid` (assoc include — no explicit order; verify empirically).
- **TextBlock**: `heading`/`content` translated (`heading` for quotes without digits
  gets a `[parent heading] ` prefix, translated parent heading bracketed for ko —
  :518-553); `slug` = slug-path of `page` guid + `/` + `link`; `chrono`, `duration`
  columns; `quotes` = belongsToMany through `bom_quote`
  (`quote.parent = text.guid → quoted guid`); quote fields incl. `parent`,
  `parentSlug` (verify against baselines — no explicit resolver found).
- **people/places** (:730-746): parse narration description tokens
  (`{Name|slug}` people, `[Name|place-slug]` places) → `loadPeopleFromTextGuid` /
  `loadPlacesFromTextGuid` (BomPeoplePlace.ts:544+) — port these.
- **refs** (:574-608): `bom_lookup` verse_ids for the text guid → cross-schema query
  `` `scripture.guide`.scripture_references `` (`type="xref"`, `significant IN (0,1,-1)`)
  → `organizeRelatedScriptures` (lib.ts:286) — port both; same MySQL server, schema-
  qualified raw SQL through Kysely.
- **notes** (:767): English-only (`lang !== "en"` → `[]`); `loadNotesFromTextGuid`
  (BomPeoplePlace.ts:696) — port.
- **Conn/Caps**: `text`/`description`/`reference` translated; `slug` = slug path
  resolved by **guid** key (not link — extend SlugResolver with `pathsForGuids`);
  `isPage` has no resolver → raw column behavior (verify in db types).

## Build order (each step suite/AB-gated before the next)

1. **A — Page shell:** `PageRepository` batched queries: pages (slug filter), sections,
   rows, narrations, connections, capsulations + translations + slug paths.
   Gate: AB with selection trimmed to shell fields (no TextBlock), en+ko.
2. **B — TextBlock core:** narration texts, heading/content translation, quote join +
   quote-heading prefix rule, slug paths, chrono/duration.
   Gate: AB with `text { guid slug heading content chrono duration quotes {...} }`.
3. **C — people/places:** port the token parsing + loaders.
4. **D — refs + notes:** cross-schema xref port + organizeRelatedScriptures; notes loader.
5. **E — Full gates:**
   - `TARGET=next` suite: `page.single`/`page.batch` en+ko (4 cases green).
   - **AB sweep: the full frontend selection across ALL pages** (~49), en+ko —
     catches data-shape edges the 2-page baseline can't.
   - Fix discrepancies; document any legacy-artifact divergences (à la the
     duplicate-weight finding); commit.

## Risks

Hidden ordering artifacts (narration texts, quotes — same class as the page-weight
finding); quote-heading translation formatting; cross-schema permissions for the
reader user; token-parsing edge cases (malformed `{}`/`[]` in descriptions).
