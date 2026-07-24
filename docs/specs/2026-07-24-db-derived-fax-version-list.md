# Derive the fax version allowlist from the database

**Status:** ready for implementation
**Area:** `backend/src/media/fax/`
**Written:** 2026-07-24

## Problem

`/fax/render` gates every request on a hardcoded array:

```ts
// backend/src/media/fax/constants.ts
export const VERSION_SLUGS = [
  '1829', '1830', '1837', '1840', '1841', '1879', '1920', '1981', '2013',
  'earliest', 'poetic', 'printer', 'rebom',
] as const;
```

Checked at three places in `route.ts` — line 36 (`/fax/render/*`), line 88
(`/fax/text/*`), line 124 (the boxes endpoint) — each returning
`400 {"error":"unknown version"}`.

Nine editions now have complete box geometry in `bom_xtras_fax_index`
(1881, 1883d, 1885, 1888d, 1898, 1907, 1918, 1921, 1923 — 63,829 rows). They are
unreachable because the array does not mention them:

```
GET /fax/render/1888d/crop/w800/ether-12.39.jpg
-> 400 {"error": "unknown version"}
```

The array is a second source of truth that has to be edited by hand every time
the data changes, and nothing fails loudly when it drifts.

## The rule

**A version is renderable if and only if it has rows in `bom_xtras_fax_index`.**

```sql
SELECT DISTINCT version FROM bom_xtras_fax_index;
```

This is not a new convention — it is what the current array already encodes.
Before the nine editions were loaded, that query returned exactly the 13 slugs
in `VERSION_SLUGS`, no more and no less. It now returns 22.

### Rejected alternatives

Both plausible-looking registry rules are wrong, and each fails silently by
dropping editions that work today. Verified against the live database:

| candidate rule | why it fails |
|---|---|
| `bom_xtras_fax.fax = 1` | `earliest` and `rebom` are renderable today with `fax = 0`. That column drives the *browsable list*, not renderability. |
| `bom_xtras_fax.indexRef IS NOT NULL` | `earliest`, `poetic` and `rebom` are renderable with an empty `indexRef`. |
| any query rooted in `bom_xtras_fax` | **`1829` has no row in that table at all**, yet it is in the allowlist today and has 7044 geometry rows. |

`bom_xtras_fax` is optional decoration; `bom_xtras_fax_index` is the geometry
itself. Only the latter is a reliable answer to "can this render?".

## Implementation

### 1. Replace the constant with a cached lookup

Delete `VERSION_SLUGS` from `constants.ts` and add a resolver — suggested home
`backend/src/media/fax/versions.ts`:

```ts
export async function isRenderableVersion(version: string): Promise<boolean>;
export async function renderableVersions(): Promise<ReadonlySet<string>>;
```

Backed by `SELECT DISTINCT version FROM bom_xtras_fax_index`.

**Cache it.** That is a full-index scan of ~150k rows on a table with a
non-unique index on `version`; it must not run per request. An in-process
`Set` with a TTL (10–15 min is ample — editions are added by hand, rarely) plus
in-flight coalescing is enough. The module already has `coalesce` in `cache.ts`
for exactly this shape of problem.

Validate the input before it reaches the query regardless of cache state —
`/^[a-z0-9]{1,20}$/` keeps arbitrary strings out of the lookup path. Verified
against the live database: all 22 current slugs satisfy it, zero violations.

### 2. Update the three call sites

```ts
// before
if (!(VERSION_SLUGS as readonly string[]).includes(version)) …
// after
if (!(await isRenderableVersion(version))) …
```

Behaviour on an unknown version is unchanged: `400 {"error":"unknown version"}`.

### 3. Keep the failure mode safe

If the lookup throws (DB down), fail closed with a 503 rather than treating the
set as empty and returning 400 for every version — a 400 tells the caller their
URL is wrong, which would be a lie, and it is cacheable.

### 4. `VersionSlug` type

`export type VersionSlug = (typeof VERSION_SLUGS)[number]` cannot survive, since
the set is now runtime data. It is declared in `constants.ts:6` and imported
nowhere — a clean delete, confirmed by grep across `backend/src` and
`backend/test`.

## Data changes (already prepared)

Two SQL files are staged in the private workspace repo, alongside the
re-registration output that produced them:

1. **`combined-load.sql`** — the 63,829 geometry rows for the nine editions.
   One transaction, scoped `DELETE` + `INSERT`, re-runnable. **Already applied**;
   all nine verified at their expected row counts.
2. **`fax-registry-update.sql`** — `bom_xtras_fax` metadata. Sets
   `indexRef = slug` for all nine. **Not yet applied.**

`indexRef` is a pointer to the version whose geometry an edition renders with,
not a boolean. It matters here beyond cosmetics: **1921 and 1923 currently point
at `1920`**, from when they had no index of their own. They do now, registered
against their own scans, so until that update runs those two render with
borrowed geometry. The frontend also derives its `isIndexed` badge from it
(`frontend/webapp/src/views/Facsimiles/Facsimiles.js:343`).

That file also holds an optional, commented-out `fax = 1` update. Applying it
makes the nine publicly browsable, and it should stay commented until rendering
has been confirmed against real scans.

## Tests

`backend/test/fax/route.test.ts` asserts unknown-version → 400 at lines 12 and
76. Those cases stay valid; the fixture will need a renderable-version stub
instead of the constant.

Worth adding:

- a version present in the DB but absent from the old hardcoded list (e.g.
  `1888d`) resolves rather than 400s — this is the regression that motivated the
  change;
- a genuinely absent version still 400s;
- the resolver is not queried per request (cache holds across calls);
- DB failure yields 503, not 400.

## Acceptance criteria

- [ ] `GET /fax/render/1888d/crop/w800/ether-12.39.jpg` renders instead of 400.
- [ ] All 13 previously-working versions still render, `1829` among them.
- [ ] `VERSION_SLUGS` no longer exists; no hardcoded version list remains in
      `backend/src/`.
- [ ] Loading a new edition's geometry makes it renderable with no code change
      and no deploy (within cache TTL).
- [ ] An unknown version still returns `400 {"error":"unknown version"}`.
- [ ] The version lookup does not issue a query per request.

## Open question for whoever picks this up

`pgoffset` in `bom_xtras_fax` disagrees with the offset the render path computes.
`imageScanMeta` uses `pgfirstVerse - MIN(page)`, which is `-8` for all nine
editions (matching their seed editions), while `pgoffset` reads 10 for
1881/1898/1907/1918, 12 for 1883d, and 14 for 1888d.

The render path never reads `pgoffset`, and re-registration correlated real ink
against the fetched scans cleanly at `-8` across all 623 pages per edition, so
the scans line up for this endpoint. But if the legacy viewer maps pages through
`pgoffset`, the two paths will disagree for those editions. Worth confirming
visually once rendering works — it is not a blocker for this change.
