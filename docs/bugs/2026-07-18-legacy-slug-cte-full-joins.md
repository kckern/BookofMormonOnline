# Legacy slug-path recursive CTE drives ~1M full joins/day

**Status:** fixed on `dev`, not yet deployed — deploy deliberately deferred
**Symptom:** one query accounts for 98.5% of all MySQL full joins and the bulk of
internal temp-table churn in the deployed backend

## Symptom

Sampled from `performance_schema.events_statements_summary_by_digest` over 415 s
of database uptime:

| calls | full_joins | tmp_tables | query |
|---|---|---|---|
| 2,580 | **5,168** | **12,920** | `SELECT GROUP_CONCAT(slug …) FROM (WITH RECURSIVE temp (num, guid, slug, parent) …)` |
| 39 | 78 | 195 | same digest, different call site |
| 5 | 2 | 5 | `bom_people` select |
| 2 | 2 | 2 | `bom_xtras_commentary` join |

One digest is 5,168 of 5,248 total full joins — **98.5%**. Two full joins and five
temp tables per call, ~2,580 calls per 415 s.

Extrapolated: **~1.05 M full joins/day**, ~2.76 M temp tables/day. An earlier
measurement in a prior session recorded ~208 k/day, so this grew ~5×.

## Root cause

`_deprecated/src/resolvers/_common.ts:12` — `getSlug()`. It resolves an entity's
full slug path by walking `bom_slug` parent links with a recursive CTE, and runs
**once per entity**:

```sql
SELECT GROUP_CONCAT(slug SEPARATOR '/') as slug
FROM (with recursive temp (num, guid, slug, parent) as (
  select 0 as num, guid, slug, parent from bom_slug where ${key} = :val
  union all
  select @i := @i + 1 as num, p.guid, p.slug, p.parent
  from bom_slug p inner join temp on p.guid = temp.parent, (SELECT @i := 0) r
) select num, slug from temp group by slug order by num DESC) parts
```

Two things are worth being precise about, because the obvious diagnosis is wrong:

**It is not a missing index.** `bom_slug` holds **531 rows**, and `link` is already
indexed (`idx_bom_slug_link`, alongside `idx_bom_slug_slug` and a composite). There
is no table scan to optimise away.

**The "full join" counter is partly an artifact.** A recursive CTE joins against
`temp`, a derived table that cannot carry an index, so MySQL books a full join on
every iteration by construction. That number would stay high even if the query
were cheap.

The real cost is **churn**: five internal temp tables per call, at ~6 calls/sec.
Each one draws from MySQL 8's global TempTable pool. A 531-row lookup table is
being re-walked in the database roughly 186,000 times a day.

## Fix

Already written and merged on `dev`: `backend/src/data/slugResolver.ts`. Its own
header states the intent — *"Legacy ran one recursive SQL query PER entity; this
loads each parent generation in one batched query (content tree depth is ~3)."*

`SlugResolver.paths()` replaces the CTE with breadth-first batched lookups:

- anchor row via `WHERE link IN (…)` / `WHERE guid IN (…)` — both indexed
  (`guid` is the primary key)
- each ancestor generation in one further batched query, capped at `MAX_DEPTH = 10`
- path assembled in application code

No CTE, no derived table, no internal temp tables. It sits behind a DataLoader in
a per-request context (`buildContext`), so repeated lookups within a request
collapse into a single batch.

Trade-off worth noting: the batched version issues ~3–4 round trips (one per
generation) where the CTE issued one. That is still far cheaper than five temp
tables per entity, and it batches across every entity in the request rather than
running per-entity.

## Why it is still happening

The deployed backend image predates this work and runs the `_deprecated/` code
path. The fix ships when the green-field backend ships. **KC deferred that
migration on 2026-07-18** — this is recorded, not overlooked.

Operational mitigations for the interim (bounding MySQL's temp-table pool, swap,
connection caps) are infra-shaped and live in the private workspace repo, together
with the outage post-mortem that surfaced this.

## Possible further work, after deploy

Even under `SlugResolver`, 531 rows of effectively static reference data are
fetched from the database on every cold request. Holding `bom_slug` in process
memory would remove the query class entirely.

**Measure before doing this.** The batched resolver may well reduce the cost to
irrelevance, and a process-level cache introduces an invalidation problem that
the current per-request DataLoader does not have.

## Regression test

None added. A meaningful test here asserts query *shape* — that resolving N slug
paths issues O(depth) statements rather than O(N) — which needs statement-count
instrumentation the suite does not currently have. Worth building alongside the
deploy, since query-count regressions are exactly what reintroduced this class of
problem.

## How this was found

Incidentally, while verifying the Objects→Matters migration
(`docs/plans/2026-07-18-objects-to-matters-migration.md`) against a live database.
`performance_schema` read access became available this session, which earlier
sessions did not have — that is what made attributing the load to a single digest
possible.
