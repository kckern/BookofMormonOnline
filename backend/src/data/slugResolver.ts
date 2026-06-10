/**
 * Slug paths — batched replacement for the legacy per-entity recursive CTE
 * (src/resolvers/_common.ts getSlug): a bom_slug row is found by `link` (the
 * entity guid), then parent guids are walked upward; the path is ancestor
 * slugs joined with '/' down to the entity's own slug.
 *
 * Legacy ran one recursive SQL query PER entity; this loads each parent
 * generation in one batched query (content tree depth is ~3).
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';

interface SlugRow {
  guid: string;
  link: string;
  parent: string;
  slug: string;
}

const MAX_DEPTH = 10;

export class SlugResolver {
  constructor(private readonly db: Kysely<DB>) {}

  /** link (entity guid) → full slug path, e.g. "jaredites/jared-at-the-tower". */
  async pathsForLinks(links: readonly string[]): Promise<Map<string, string>> {
    return this.paths('link', links);
  }

  /** bom_slug row guid → full slug path (legacy getSlug('guid', ...) — used by Conn/Caps). */
  async pathsForGuids(guids: readonly string[]): Promise<Map<string, string>> {
    return this.paths('guid', guids);
  }

  private async paths(key: 'link' | 'guid', vals: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(vals)].filter(Boolean);
    if (!unique.length) return new Map();

    const selfRows = (await this.db
      .selectFrom('bom_slug')
      .select(['guid', 'link', 'parent', 'slug'])
      .where(key, 'in', unique)
      .execute()) as SlugRow[];

    // Load ancestor generations breadth-first, batched.
    const byGuid = new Map<string, SlugRow>(selfRows.map((r) => [r.guid, r]));
    let parents = [...new Set(selfRows.map((r) => r.parent).filter((p) => p && !byGuid.has(p)))];
    for (let depth = 0; parents.length && depth < MAX_DEPTH; depth += 1) {
      const rows = (await this.db
        .selectFrom('bom_slug')
        .select(['guid', 'link', 'parent', 'slug'])
        .where('guid', 'in', parents)
        .execute()) as SlugRow[];
      for (const r of rows) byGuid.set(r.guid, r);
      parents = [...new Set(rows.map((r) => r.parent).filter((p) => p && !byGuid.has(p)))];
    }

    const firstByKey = new Map<string, SlugRow>();
    for (const r of selfRows) if (!firstByKey.has(r[key])) firstByKey.set(r[key], r);

    const paths = new Map<string, string>();
    for (const val of unique) {
      const row = firstByKey.get(val);
      if (!row) continue;
      const segments = [row.slug];
      let cursor = row.parent ? byGuid.get(row.parent) : undefined;
      for (let depth = 0; cursor && depth < MAX_DEPTH; depth += 1) {
        segments.unshift(cursor.slug);
        cursor = cursor.parent ? byGuid.get(cursor.parent) : undefined;
      }
      paths.set(val, segments.join('/'));
    }
    return paths;
  }
}
