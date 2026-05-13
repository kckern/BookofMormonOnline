# Witnesses sources archive — spec

Date: 2026-05-13
Status: Awaiting sign-off
Owner: kc

## Problem

The `/history/witnesses` page renders entirely from a hardcoded JS literal in `frontend/webapp/src/views/History/Witnesses.js:8–151`. Sources for each witness either don't render at all, or live inline (`Josiah Stoal.sources[0]`). Meanwhile, `bom_xtras_history` already contains **470 rows tagged `archive='witnesses'`** with full source documents (transcript, teaser, citation, etc.) and a `principal` column identifying which witness each source pertains to. The frontend doesn't read any of this data.

The Sequelize model and GraphQL typedef pre-date the schema additions (`archive`, `principal`, `event_year`, etc.) and don't expose them, so the existing `history` resolver can't filter to witness rows even if a caller wanted to.

## Goal

Wire the existing `bom_xtras_history` witness rows into the `/history/witnesses/:witness` detail page. Keep the witness superstructure (list, groupings, birthdays, bios, canonical Three/Eight Witnesses statements) **hardcoded inline** — the database has no witness metadata, only source documents.

## Non-goals

- Migrating witness superstructure (names, birthdays, group categorization, official statements) to the backend.
- Building a `principals` GraphQL query / table / model.
- Rewriting the existing reception-history `History.js` UI; only its API call gains an explicit `archive: "reception"` filter.
- Editorial cleanup of `bom_xtras_history` principal-name inconsistencies (out of scope; documented below).
- Multi-language handling beyond what the existing `history` resolver already does via `includeTranslation`.

## Schema findings (verified 2026-05-13 via `scripts/describe-history.ts`)

Columns on `bom_xtras_history` not present in the current Sequelize model:

| Column | Type | Notes |
|---|---|---|
| `guid` | char(10) | Secondary identifier, separate from `slug` PK |
| `archive` | varchar(255), indexed (`idx_archive`) | Discriminator. Values today: `reception` (580 rows), `witnesses` (470) |
| `event_year` | int, indexed (`idx_event_year`) | Year the witness event happened (vs `year` = publication year) |
| `event_date` | varchar(255) | Date the witness event happened |
| `repository` | varchar(255) | Source repository |
| `archive_id` | varchar(128) | Per-archive identifier |
| `principal` | text | Human-readable name of the subject (e.g., "Martin Harris", "Joseph Smith, Jr."). NULL for ~9 witness rows. |
| `language` | char(8), default `en` | |
| `metadata` | json | Free-form per-row metadata |

Existing modeled columns to keep: `seq, id, slug, year, date, link, type, source, author, document, pages, citation, teaser, transcript, aspect`.

### Principal-value distribution (witnesses archive)

Notable counts: Martin Harris 87, David Whitmer 149, Oliver Cowdery 27, John Whitmer 37, Hyrum Smith 15, Joseph Smith Jr. 15, William B. Smith 10, Samuel H. Smith 11, Lucy Mack Smith 13, Emma Smith 8, Hiram Page 8, plus smaller per-person totals and **collective entries**: "Three Witnesses" (15), "Eight Witnesses" (9), "Four Witnesses" (1).

### Data-quality / naming reconciliation

Inline witness slugs in `Witnesses.js` don't 1:1 match DB `principal` strings:

| Inline slug | Inline name | DB principal(s) to match |
|---|---|---|
| `martin-harris` | Martin Harris | `Martin Harris`, `Three Witnesses` |
| `oliver-cowdery` | Oliver Cowdery | `Oliver Cowdery`, `Three Witnesses` |
| `david-whitmer` | David Whitmer | `David Whitmer`, `Three Witnesses` |
| `john-whitmer` | John Whitmer | `John Whitmer`, `Eight Witnesses` |
| `jacob-whitmer` | Jacob Whitmer | `Jacob Whitmer`, `Eight Witnesses` |
| `christian-whitmer` | Christian Whitmer | `Christian Whitmer`, `Christian Whitmer and Peter Whitmer, Jr.`, `Eight Witnesses` |
| `peter-whitmer-jr` | Peter Whitmer Jr. | `Peter Whitmer Jr.`, `Peter Whitmer, Jr.`, `Christian Whitmer and Peter Whitmer, Jr.`, `Eight Witnesses` |
| `hiram-page` | Hiram Page | `Hiram Page`, `Eight Witnesses` |
| `joseph-smith-sr` | Joseph Smith Sr. | `Joseph Smith Sr.`, `Eight Witnesses` |
| `samuel-smith` | Samuel Smith | `Samuel H. Smith`, `Eight Witnesses` |
| `hyrum-smith` | Hyrum Smith | `Hyrum Smith`, `Eight Witnesses` |
| `william-smith` | William Smith | `William Smith`, `William B. Smith` |
| `mary-whitmer` | Mary Whitmer | `Mary Whitmer` |
| `lucy-mack-smith` | Lucy Mack Smith | `Lucy Mack Smith` |
| `katherine-smith` | Katherine Smith | `Katherine` |
| `josiah-stoal` | Josiah Stoal | `Josiah Stowell` *(spelling differs; DB wins)* |
| `emma-smith` | Emma Smith | `Emma Smith` |
| `william-hussey-azel-vandruver` | William T. Hussey and Azel Vandruver | *(no DB matches yet)* |
| `willard-chase` | Willard Chase | `Willard Chase` |

The inline data adds a `principalNames: [String]` field per witness, listing the exact `principal` strings to filter against. This is the contract between the inline superstructure and the DB.

## Design

### Backend

#### 1. Sequelize model (`src/database/models/bom_xtras_history.ts`)

Add the missing columns. Indexes `idx_archive` and `idx_event_year` already exist on the table; declare them in the model `indexes` array for documentation parity, but the model isn't used to run migrations so this is informational.

```ts
guid:        { type: DataTypes.CHAR(10), allowNull: true },
archive:     { type: DataTypes.STRING(255), allowNull: true },
event_year:  { type: DataTypes.INTEGER, allowNull: true },
event_date:  { type: DataTypes.STRING(255), allowNull: true },
repository:  { type: DataTypes.STRING(255), allowNull: true },
archive_id:  { type: DataTypes.STRING(128), allowNull: true },
principal:   { type: DataTypes.TEXT, allowNull: true },
language:    { type: DataTypes.CHAR(8), allowNull: true, defaultValue: 'en' },
metadata:    { type: DataTypes.JSON, allowNull: true },
```

#### 2. GraphQL type (`src/typeDefs/BomNotes.ts`)

Extend `HistoricalDocument` with the fields the frontend will consume:

```graphql
type HistoricalDocument {
  seq: Int
  id: Int
  slug: String
  year: Int
  date: String
  link: String
  type: String
  source: String
  author: String
  document: String
  pages: Int
  citation: String
  teaser: String
  transcript: String
  aspect: Float
  # added:
  archive: String
  principal: String
  event_year: Int
  event_date: String
}
```

Other new columns (`guid`, `repository`, `archive_id`, `language`, `metadata`) are intentionally omitted — YAGNI for this feature.

#### 3. GraphQL query (`src/typeDefs/BomNotes.ts`)

Extend the existing `history` query with two optional filters:

```graphql
history(
  slug: [String]
  archive: String
  principal: [String]    # list, so collective rows ("Three Witnesses") can be included
): [HistoricalDocument]
```

#### 4. Resolver (`src/resolvers/BomNotes.ts:93`)

Extend the `where` clause:

```ts
history: async (root, args, context, info) => {
  const lang = context.lang ?? null;
  const where: any = {};
  if (args.slug)      where.slug      = args.slug;
  if (args.archive)   where.archive   = args.archive;
  if (args.principal) where.principal = { [Op.in]: args.principal };
  const conditions: any = {
    order: ['seq'],
    include: [includeTranslation({ [Op.or]: ['source','author','document','citation','teaser','transcript'] }, lang)].filter(x => !!x)
  };
  if (Object.keys(where).length) conditions.where = where;
  return Models.BomXtrasHistory.findAll(conditions);
}
```

Callers with no args behave unchanged (return everything).

#### 5. Backwards-compatible callers

- `History.js` will start passing `archive: "reception"` to scope the reception-history page. Until that lands, the page mixes both archives — but witnesses rows have no `thumbs/<id>` faxes, so they'll render with broken thumbnails. Update both backend and `History.js` in the same change.

### Frontend

#### 1. `Witnesses.js` inline data — add `principalNames`

Each inline witness entry gains a `principalNames: [String]` field per the reconciliation table above. Example:

```js
{
  slug: "martin-harris",
  name: "Martin Harris",
  birthday: "1783-05-18",
  bio: "",
  principalNames: ["Martin Harris", "Three Witnesses"]
}
```

Remove the inline `sources: [...]` array from Josiah Stoal — that data now comes from the DB.

#### 2. `SingleWitness` component — fetch & render sources

On mount, if `witness.principalNames?.length`:

```js
BoMOnlineAPI({
  history: { archive: "witnesses", principal: witness.principalNames }
}).then(r => setSources(r.history || []));
```

Render below the existing bio div:

- Section heading: "Sources"
- A `Masonry` grid (same `breakpointColumnsObj` as `History.js:51–56`)
- Each card rendered identically to `History.js:110–138`:
  - Header: `doc.source` (publication) + `displayDate(doc.date)`
  - Thumb at `${assetUrl}/history/thumbs/${String(doc.id).padStart(4,'0')}` with overlaid teaser
  - Document title (`doc.document`)
  - Citation
- Card `onClick`:
  ```js
  appController.functions.setPopUp({
    type: "history",
    ids: [doc.slug],
    popUpData: doc,
    underSlug: `history/witnesses/${witness.slug}`,
    vhtop: 10,
  })
  ```
- This reuses `PopUp.js:114`'s existing `type === "history"` handler unchanged.

Sort: by `event_year` desc fallback to `year` desc, then `seq`. Verify in implementation.

#### 3. Deep-link `:source` param

`Witnesses.js:185` already destructures `source` from `useParams()` but ignores it. Wire it: on mount of the detail view, if `source` is set, also call `setPopUp({ type: "history", ids: [source] })`. Mirrors `History.js:69–77`'s pattern.

#### 4. `appController` plumbing

`SingleWitness` doesn't currently receive `appController` as a prop. It's passed to `Witnesses` from the parent router; thread it through to `SingleWitness`. Trivial change at `Witnesses.js:189`.

#### 5. `History.js` — explicit archive filter

`History.js:59` becomes:

```js
BoMOnlineAPI({
  history: { archive: "reception" },
  markdown: "history"
}).then(...)
```

#### 6. `GraphQLQueries.js` — extend the `history` query builder

The current `history` builder at `frontend/webapp/src/models/GraphQLQueries.js:553–578` only handles a single `slug` argument via the shared `q(type, key, vals)` helper, which is hardcoded to a single key. The helper is too rigid for multi-arg queries; existing precedent for conditional args is `homefeed` (line 1688–) which manually builds the args string with optional fragments.

**Decision:** rewrite `queries.history` to inline its own arg-building logic — accept the existing `true | string | [string]` shapes (legacy callers) **and** an object shape `{ slug?, archive?, principal? }`. The `slug`-only case still goes through `q(...)`; object input builds the args manually.

Sketch:

```js
history: (input) => {
  // legacy: input is true | string | [string] → treat as slug filter (or none)
  // new:    input is { slug?, archive?, principal? }
  const isObject = input && typeof input === 'object' && !Array.isArray(input);
  const slug      = isObject ? input.slug      : (input === true ? null : input);
  const archive   = isObject ? input.archive   : null;
  const principal = isObject ? input.principal : null;

  const argFragments = [];
  if (slug != null && slug !== false) {
    const v = Array.isArray(slug) && slug.length === 1 ? slug[0] : slug;
    argFragments.push(`slug: ${JSON.stringify(v)}`);
  }
  if (archive)   argFragments.push(`archive: ${JSON.stringify(archive)}`);
  if (principal) argFragments.push(`principal: ${JSON.stringify(Array.isArray(principal) ? principal : [principal])}`);
  const args = argFragments.length ? `(${argFragments.join(', ')})` : '';

  const wantsTranscript = !!slug; // mirrors existing behavior: only fetch transcript when a slug filter is set

  return {
    type: "history",
    key: "slug",
    val: slug,
    query: `history ${args} {
      seq id slug year date link type source author document
      citation teaser aspect pages
      archive principal event_year event_date
      ${wantsTranscript ? 'transcript' : ''}
    }`,
  };
},
```

Notes:
- The `val` field is still keyed on `slug` for cache normalization (`normalizeVal` in `Cache.js`) — keeps `BoMOnlineAPI`'s caching layer compatible with the legacy slug-based responses.
- The new GraphQL fields (`archive`, `principal`, `event_year`, `event_date`) are added to the selection set unconditionally — they're cheap and the witnesses UI needs them.
- `transcript` continues to only be requested when a specific slug is being fetched (existing behavior — list views skip the large blob).

**Call sites to update:**
- `History.js:59` → pass `{ archive: "reception" }`
- `Witnesses.js` SingleWitness mount → pass `{ archive: "witnesses", principal: witness.principalNames }`
- `PopUp.js:655` → unchanged (still passes a single slug string)

Removes the spec's earlier "BoMOnlineAPI TBD" risk.

## Data flow

```
URL: /history/witnesses/hiram-page
  → Routes.js matches → <Witnesses /> mounts
  → useParams() → { witness: "hiram-page", source: undefined }
  → Witnesses looks up "hiram-page" in inline `data`
  → renders <SingleWitness witness={hiramObj} appController={appController} />
  → SingleWitness header from hiramObj (name, portrait, bio)
  → SingleWitness fires GraphQL: history(archive:"witnesses", principal:["Hiram Page","Eight Witnesses"])
  → 17 source rows return (8 Hiram-tagged + 9 Eight-Witnesses-tagged)
  → Masonry grid renders 17 cards
  → User clicks card → setPopUp({type:"history", ids:[slug]})
  → PopUp.js:114 handles it → BoMOnlineAPI({ history: slug }) refetches full document
  → Renders existing popup card
```

## Risks & open questions

1. **Principal-name drift.** The reconciliation table is a snapshot. If new sources land with different principal spellings, individual witness pages silently miss them. Mitigation: a `docs/reference/` note pointing maintainers at `principalNames` as the source of truth.
2. **William Smith / William B. Smith.** Both DB strings refer to the same person; collapsing them under `william-smith` is correct here.
3. **Josiah Stoal vs Josiah Stowell.** Inline slug stays `josiah-stoal` (already in URLs); only the `principalNames` field lists `["Josiah Stowell"]` to match the DB. Display name in the UI continues to use whatever's in the inline `name` field.
4. **`History.js` regression risk.** Adding `archive: "reception"` filter cuts ~470 witness rows from that page's results. Manual verification: visit `/history` after deploy and confirm the document grid still renders the expected reception-history items.

## Acceptance criteria

- [ ] `bom_xtras_history` model declares all current table columns.
- [ ] GraphQL `history` query accepts optional `archive: String` and `principal: [String]` args; existing no-arg callers unaffected.
- [ ] `HistoricalDocument` type exposes `archive`, `principal`, `event_year`, `event_date`.
- [ ] Visiting `/history/witnesses/hiram-page` renders Hiram's portrait + bio + a grid of source cards drawn from `bom_xtras_history` (≥1 card visible).
- [ ] Clicking any source card opens the existing history PopUp showing the full document.
- [ ] Visiting `/history/witnesses/hiram-page/<source-slug>` auto-opens the popup for that source on page load.
- [ ] The `/history/witnesses` index page is visually unchanged.
- [ ] The `/history` reception-history page is visually unchanged.
- [ ] No witness with `principalNames` set returns zero sources unless the DB genuinely has none (manual spot-check: Martin Harris, Oliver Cowdery, David Whitmer, Hiram Page).

## Out-of-band actions (you, not Claude)

- None for this feature — all witness source rows are already seeded in `bom_xtras_history`.
