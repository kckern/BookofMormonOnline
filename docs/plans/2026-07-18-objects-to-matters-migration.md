# Objects → Matters migration

**Status:** code complete — **blocked on the label migration below before it looks right**
**Trigger:** `bom_objects` was renamed to `bom_matters` server-side and the `object`
type vocabulary was replaced with `matter` across `bom_index` and `bom_xrels`. The
app is currently broken — every object query hits a table that no longer exists.

## What changed in the database

| | before | now |
|---|---|---|
| entity table | `bom_objects` | `bom_matters` (303 rows) |
| `bom_index.type` | `object` | `matter` (2,381 rows) |
| `bom_xrels.src_type` | `object` | `matter` (2,391 rows) + new `theology` (1,014) |
| `bom_xrels.dst_type` | `object` | `matter` (614) + new `theology` (1,025) |

`bom_matters` column changes vs. the old `bom_objects`:

- **Added:** `kind` (object 225 / figure 52 / practice 9 / institution 7 /
  social-pattern 6 / natural-kind 2 / phenomenon 2), `status` (draft 275 / stub 28),
  `node_link` (only 5 populated)
- **`specificity` vocabulary replaced:** `specific`/`general` → `class` (163) /
  `instance` (132) / `theme` (8)
- **8 new `category` values:** `society-custom`, `governance-politics`,
  `law-justice`, `natural-world`, `warfare-military`, `agriculture-subsistence`,
  `economy`, `material-culture-tech`
- 28 rows (all `status='stub'`) have empty `era` and `provenance`

## Decisions

- **Route:** `/objects/*` → `/matters/*`, no redirect. The route was never public.
- **Scope:** unbreak the app *and* refresh the filter axes so `specificity` and the
  8 new categories actually filter. `kind` is exposed on the GraphQL type but does
  not get a filter axis in this pass; `status` is not surfaced.
- **Labels:** the 30 `object_*` / `spec_*` rows in `bom_label` get renamed to
  `matter_*` via a write migration in the private workspace repo. Frontend is wired
  to the new keys, so the UI shows English fallbacks until that migration runs.

## Work

### Backend

1. `backend/codegen/db.d.ts` — regenerate via `npm run codegen:db` (picks up
   `bom_matters` plus the new `bom_theology` tables)
2. `backend/schema/BomObjects.graphql` → `BomMatters.graphql`: `Query.object` →
   `Query.matter`, `type Object` → `type Matter`, add `kind`, `status`, `node_link`
3. `backend/src/data/loaders/objects.ts` → `matters.ts`: `bom_objects` →
   `bom_matters`; `i.type = 'object'` → `'matter'`; `src_type = 'object'` →
   `'matter'`; dst resolution `'object'` → `'matter'`
4. `backend/src/graphql/resolvers/objects.ts` → `matters.ts`
5. Wiring: `backend/src/data/loaders.ts`, `backend/src/graphql/resolvers.ts`
6. `backend/src/data/loaders/peopleplaces.ts:385` — `bom_objects` → `bom_matters`,
   dst_type `object` → `matter`
7. `backend/src/graphql/resolvers/homesampler.ts:270` — same
8. `backend/src/data/loaders/scriptureextras.ts:521,547` — same; the
   `Query.objects` field in `resolvers/scriptureextras.ts:210` becomes `matters`

### Frontend

9. `views/Objects/` → `views/Matters/` (`Matters.js`, `MattersFilter.js`,
   `mattersFilterData.js`, `Matters.css`, `svg/`)
10. `mattersFilterData.js`: specificity chips → `class`/`instance`/`theme`; add the
    8 missing category chips; `Matters.js` ★ badge test `specificity === "specific"`
    → `=== "instance"`
11. `models/Routes.js` — `/objects/:objectSlug` → `/matters/:matterSlug`
12. `views/_Common/PopUp.js` — popup `type: "object"` → `"matter"`, `underSlug`
13. `views/_Common/XrelSection.js` — `dst_type === "object"` → `"matter"`
14. `models/GraphQLQueries.js` — `object` → `matter`, `objectList` → `matterList`,
    and the two `objects { … }` sub-selections on the scripture-extras query
15. `views/Read/CategoryPanels/ObjectsPanel.js` → `MattersPanel.js` +
    `views/Read/PassageNotes.js` registry/tab key
16. `views/Home/tiles/RelationshipsTile.js:10` — `/objects/${slug}` → `/matters/`

### Data

17. Label rename migration (`object_*` → `matter_*`) drafted in the private
    workspace repo, plus new keys for the 8 categories and `class`/`instance`/`theme`

### Found during implementation

18. **Sidebar entry** — `/matters` added to `menuConfig` between Places and Map,
    with `svg/matters.svg` (SVGRepo `object-distribution-round-901`, recoloured
    white and flattened to the sidebar's `viewBox`/single-fill convention).
19. **Popup `type` was singular.** `appController.setPopUp` derives the URL as
    `type + "/" + id`, and the convention elsewhere is the *plural route slug*
    (`"people"` → `/people/…`, `"places"` → `/places/…`). The old `"object"` was
    singular, so object popups had always pushed the unrouted `/object/<slug>`.
    It never showed because `/objects` was not in the sidebar; once Matters was
    added, the sidebar highlight visibly fell through to Study. Popup type is now
    `"matters"`. Note this is distinct from `dst_type === "matter"` (a DB value,
    still singular) and from the `matter` GraphQL response key.
20. **`theology` leaked into the home sampler.** `sampleRelationship` picked hubs
    across all of `bom_xrels`, which now includes 1,014 `src_type='theology'`
    rows that `entityNames` cannot resolve → null relationship tile on those
    seeds. The hub and edge queries are now restricted to `SAMPLEABLE_TYPES`, and
    the hub's `HAVING COUNT(*) >= 2` counts only resolvable edges so the hub pick
    stays in sync with the edge query.

## Verification

- `npx tsc --noEmit` clean; backend 384 passed / 0 failed (the one file-level
  failure, `test/readingplan/mutations.test.ts`, reproduces on unmodified code)
- Frontend 509 passed / 77 suites
- Driven in a browser against a local backend: `/matters` renders all 303 cards,
  `/matters/liahona` opens the popup with xrels resolving to named people and
  places, sidebar highlight matches `/people` and `/places` behaviour, no console
  errors beyond the expected media-asset 404s
- Backend queried directly: `matter(slug:)`, the full `matterList`, and
  `passagenotes { matters }` all return correctly

## Known gaps (out of scope, flagged)

- **`theology` entity domain** — `bom_theology` / `bom_theology_geometry` exist and
  account for ~1,000 xrel rows in each direction, but there is no loader, resolver,
  schema type, or view. Those xrels currently render as a raw slug with no link.
  Needs its own spec.
- **The label migration has to run.** `label()` in `models/Utils.js` returns the
  *key itself* when a key is missing, and the key is truthy — so the
  `label(chip.key) || chip.label` fallback in `mattersFilterData.js` never fires.
  Until `sql/migrations/2026-07-18_matters_labels.sql` runs in the private
  workspace repo, the index renders raw keys (`title_matters`, `matter_cat_animal`,
  `spec_instance`). The era/provenance/usage axes already read correctly because
  those keys were never renamed.
- **131 dangling xrels.** 131 `bom_xrels` rows (101 distinct slugs) have
  `dst_type='matter'` pointing at slugs present in neither `bom_matters` nor
  `bom_theology` — e.g. `word-of-god` off `swords`. They render as a bare slug
  with no link. This predates the frontend work and looks like a content-generator
  gap in `content/matters/_sql/build.mjs`; it needs a data fix, not a code fix.
- **Media assets** — `https://media.bookofmormon.online/objects/<slug>` 404s for
  every slug (it 200s for `/people/<slug>`), so matter cards have always fallen
  back to the gradient-initials tile. Code moves to `/matters/<slug>`; populating
  that namespace on the media host is a separate content task.
