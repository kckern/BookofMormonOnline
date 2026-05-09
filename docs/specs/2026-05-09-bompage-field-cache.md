# BomPage field-level GraphQL cache

**Status:** Single, intact, well-described commit; not yet integrated. Strong revival candidate — the BomPage resolver is one of the heaviest in the backend per the handler inventory and is unmodernized.
**Source:** `origin/ptune` branch, single commit `cc82af6 "Add field-level caching for BomPage GraphQL resolver"` (2025-08-18). Author has a clear commit message describing intent.
**Branch deletion plan:** Branch will be removed; this spec is the record. The commit can be cherry-picked when the work is revived (it's small enough to apply cleanly).

## Concept

Add a **server-side, MD5-keyed cache table** for full BomPage GraphQL query results. Cache the entire page subtree (page → sections → sectionText → rows → connection / capsulation / narration → text) by `(slug, lang)`. On cache hit, skip the deeply-nested Sequelize join and return the cached JSON; on miss, execute the join and write back to the cache.

The cached objects get a `__fromCache: true` marker so child resolvers can pass through cached values instead of re-fetching.

## Why it matters

- `BomPage.page(slug)` is the heaviest read query in the backend. The full join chain (page → sections → rows → connection → capsulation → narration → timeline → text + translations at every level) generates dozens of SQL statements per request.
- Pages don't change frequently — they're effectively static content per language. Strong fit for a long-TTL cache.
- The existing approach has no caching layer; every page view hits the full join chain.
- The commit author (kckern) chose a per-resolver SQL-table cache instead of Redis, presumably to keep the dev environment dependency-free. (The repo also has Redis available now via the messenger work — worth re-evaluating.)

## What was built (in the abandoned commit)

### New model: `src/database/models/bom_cache.ts` (61 lines)
Schema:
| Column | Type | Notes |
|---|---|---|
| `key` | VARCHAR(255), PK | `page.<slug>` |
| `hash` | VARCHAR(32) | MD5 of `JSON.stringify({slug:[slug], lang})` — invalidation key |
| `timestamp` | INT | Insertion time (no TTL logic in the spike — the design lacks expiration) |
| `content` | JSON | The serialized resolver result |

Indexed on PRIMARY (`key`), `hash`, and `timestamp`.

Registered in `src/config/database.ts` as `Models.BomCache` and in the `Models` typing.

### Resolver change: `src/resolvers/BomPage.ts`
Inside `page` resolver, before the existing query path:

1. Compute `slugStr` (handles array or string args).
2. Compute `hash = md5(JSON.stringify({slug:[slugStr], lang}))`.
3. Compute `cacheKey = "page." + slugStr`.
4. `Models.BomCache.findOne({where:{key:cacheKey, hash}})` — if hit, mark all cached objects with `__fromCache: true` recursively and return.
5. On miss, fall through to the existing find with **all eager-load includes** (the spike intentionally over-fetches so one query populates everything that any subsequent resolver might need).

Logging via `console.log` with emoji prefixes (`🎯 Cache HIT`, `⚡ Cache MISS`) — useful for diagnostics, would want gating behind a debug flag for prod.

The change also flips `logging` from a no-op to `false` in the Sequelize config, presumably to avoid log noise during cache investigation.

## Why it didn't ship

- Branch sat for 9 months. No public reason; possibly waiting for a broader caching strategy decision.
- The spike has design gaps that need decisions:
  - **No invalidation.** When BomPage data changes (admin edit), the cache is never busted. Either a write-through layer in mutations, an admin "flush cache" endpoint, or a TTL.
  - **No TTL.** The `timestamp` column exists but is never read. Adding `WHERE timestamp > NOW() - INTERVAL N HOUR` to the lookup is one-line.
  - **`console.log` everywhere.** Needs to be a structured-logger call (the project added structured logging in commit `37080ec`).
  - **Bigger over-fetching.** Switching `includeModel(info, ...)` to `includeModel(true, ...)` ignores GraphQL's selection set and always fetches every nested table. That's deliberate (so the cache covers any subsequent re-query), but it makes the *cache miss* slower. Trade-off worth re-examining.

## How to pick this up later

The commit applies cleanly to current dev — verified the file-level intent. To productionize:

1. **Cherry-pick the commit:** `git cherry-pick cc82af6` after re-pushing the branch (or apply the saved diff if branch is gone). The migration to add `bom_cache` table needs to be created — the commit defined the model but not a migration script.
2. **Add invalidation.** Pick one:
   - **Mutation hook.** Every BomPage-modifying mutation deletes its `bom_cache` row. Cleanest semantics; requires touching every mutation that affects the page subtree.
   - **TTL.** Add 1-hour TTL via the existing `timestamp` column. Simple, but stale-content window.
   - **Both.** Belt-and-suspenders; recommended.
3. **Reconsider Redis.** The messenger system already brought Redis into the stack. A Redis-backed cache is faster than MySQL JSON BLOBs and supports native TTL/eviction. The MySQL `bom_cache` table is fine for a v1 but Redis is the long-term home.
4. **Replace `console.log` with the project's logger.** See `src/library/utils/logger.ts` (or wherever the structured logger from commit `37080ec` lives).
5. **Re-evaluate the over-fetch.** Two tiers might be cleaner: a small "hot" cache keyed by what the user actually selected (smaller payloads, more cache fragmentation), and a "deep" cache for the canonical page render path.
6. **Generalize.** If this works for BomPage, the same cache table can serve other heavy resolvers (`commentary`, `image`, `chiasmus`). Build it as a helper from day one rather than inlining in BomPage.
7. **Pair with DataLoader.** The backend handler inventory flagged that no resolvers currently use DataLoader (`src/library/dataloaders/` has a userLoader but it's unused). Field-level caching and DataLoader solve different problems (page-level vs. per-row N+1) and should compose cleanly.

## Open questions

- Are there pages with personalized content that would *not* cache safely by `(slug, lang)`? If so, the cache key needs another dimension (e.g. user role / membership).
- Cache size: how big does `bom_cache` get? At ~100 KB per page * a few thousand pages * a few languages, this is order-of MB to tens of MB. Manageable, but worth bounding.

## Appendix A: `bom_cache` Sequelize model (verbatim, from `cc82af6`)

`src/database/models/bom_cache.ts`:

```ts
import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

export default class _bom_cache extends ModelBase {
    public static initModel(sequelize: Sequelize): typeof _bom_cache {
        this.init(
            {
                key: {
                    type: DataTypes.STRING(255),
                    allowNull: false,
                    primaryKey: true,
                },
                hash: {
                    type: DataTypes.STRING(32),
                    allowNull: false,
                },
                timestamp: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                content: {
                    type: DataTypes.JSON,
                    allowNull: false,
                },
            },
            {
                sequelize,
                tableName: 'bom_cache',
                timestamps: false,
                charset: 'utf8mb4',
                collate: 'utf8mb4_unicode_ci',
                indexes: [
                    { name: 'PRIMARY', unique: true, using: 'BTREE', fields: [{ name: 'key' }] },
                    { name: 'hash', using: 'BTREE', fields: [{ name: 'hash' }] },
                    { name: 'timestamp', using: 'BTREE', fields: [{ name: 'timestamp' }] },
                ],
            },
        );
        return this;
    }
}
```

Registration in `src/config/database.ts`:

```ts
import BomCache from '../database/models/bom_cache';
// …
export const models: Models = {
    BomCache: BomCache.initModel(sequelize),
    // … other models
};
```

And in `src/database/typings/Models.d.ts`:

```ts
import BomCache from '../models/bom_cache';
export interface Models {
    BomCache: typeof BomCache;
    // …
}
```

## Appendix B: Cache-aware `BomPage.page` resolver (verbatim, from `cc82af6`)

This is the structural change to `src/resolvers/BomPage.ts`'s `page` resolver. The `console.log` calls should be replaced with the project's structured logger, and the cache-write should likely be moved out of the request path (background) for prod, but the shape is correct.

```ts
page: async (root: any, args: any, context: any, info: any) => {
    const lang = context.lang ? context.lang : null;
    const slugs = getSlugTip(args.slug);

    // ───── Try field-level cache first for full page subtree ─────
    if ('slug' in args && args.slug) {
        const slugStr = Array.isArray(args.slug) ? args.slug[0] : String(args.slug);
        try {
            const crypto = require('crypto');
            const cacheData = { slug: [slugStr], lang: lang || 'en' };
            const hash = crypto.createHash('md5').update(JSON.stringify(cacheData)).digest('hex');
            const cacheKey = `page.${slugStr}`;

            const cached = await Models.BomCache.findOne({ where: { key: cacheKey, hash } });
            if (cached) {
                const content = cached.getDataValue('content');
                // Mark cached objects so child resolvers can passthrough.
                const mark = (obj: any): any => {
                    if (Array.isArray(obj)) return obj.map(mark);
                    if (obj && typeof obj === 'object') {
                        const copy: any = { ...obj, __fromCache: true };
                        Object.keys(copy).forEach(k => {
                            if (copy[k] && typeof copy[k] === 'object') copy[k] = mark(copy[k]);
                        });
                        return copy;
                    }
                    return obj;
                };
                return mark(content);
            }
        } catch (e) {
            console.error('Cache error:', e);
        }
    }

    // ───── Cache miss: full eager-load query (intentionally over-fetches) ─────
    if ('slug' in args) {
        const result = await Models.BomPage.findAll({
            include: [
                includeWhere(Models.BomSlug, "slug", slugs, "pageSlug", []),
                includeTranslation('title', lang),
                includeModel(true, Models.BomSection, 'sections', [
                    includeTranslation('title', lang),
                    includeModel(true, Models.BomText, 'sectionText', [
                        includeTranslation("heading", lang),
                    ].filter(x => !!x)),
                    includeModel(true, Models.BomSectionrow, 'rows', [
                        includeModel(true, Models.BomConnection, 'connection', [
                            includeTranslation('text', lang),
                        ].filter(x => !!x)),
                        includeModel(true, Models.BomCapsulation, 'capsulation', [
                            includeTranslation({ [Op.or]: ['description', 'reference'] }, lang),
                        ].filter(x => !!x)),
                        includeModel(true, Models.BomNarration, 'narration', [
                            includeTranslation('description', lang),
                            includeModel(true, Models.BomTimeline, 'timeline'),
                            includeModel(true, Models.BomText, 'text', [
                                includeTranslation({ [Op.or]: ['heading', 'content'] }, lang),
                                includeModel(true, Models.BomText, 'quotes', [
                                    includeTranslation({ [Op.or]: ['heading', 'content'] }, lang),
                                ].filter(x => !!x)),
                            ].filter(x => !!x)),
                        ]),
                    ].filter(x => !!x)),
                ].filter(x => !!x)),
            ].filter(x => !!x),
            // … plus the existing `order` clause from the original resolver
        });

        // ───── Save to cache for future hits ─────
        try {
            const slugStr = Array.isArray(args.slug) ? args.slug[0] : String(args.slug);
            const crypto = require('crypto');
            const cacheData = { slug: [slugStr], lang: lang || 'en' };
            const hash = crypto.createHash('md5').update(JSON.stringify(cacheData)).digest('hex');
            const cacheKey = `page.${slugStr}`;
            const timestamp = Math.floor(Date.now() / 1000);
            await Models.BomCache.upsert({ key: cacheKey, hash, timestamp, content: result });
        } catch (e) {
            console.error('Cache save error:', e);
        }

        return result;
    }

    return Models.BomPage.findAll({});
},
```

The original commit also touched downstream resolvers (`Page` field resolvers further down the file) to handle both Sequelize model instances and plain cached objects — every nested resolver now had to do `if (parent.__fromCache) return parent.field; else return parent.getDataValue('field');` style branching. That's the *cost* of the cache-and-pass-through approach; a cleaner design would normalize the resolver input shape before dispatch.
