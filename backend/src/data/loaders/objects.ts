/** objects domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import { lookupReference } from 'scripture-guide';

export interface ObjectRow {
  guid: string;
  slug: string;
  name: string | null;
  subtitle: string | null;
  category: string;
  specificity: string;
  usage: string;
  era: string;
  provenance: string;
  aliases: string | null;
  tags: string | null;
  description: string | null;
  verse_id: number | null;
  weight: number;
}

/**
 * Extended IndexRow for the objects domain.
 * Matches the IndexRow from peopleplaces for all shared fields, plus
 * a precomputed slug so the per-lookup-row slug is embedded at fetch time.
 * This is needed because there can be multiple bom_lookup rows for one
 * bom_index verse_id, and the Sequelize hasOne JOIN in legacy produces one
 * result row per (bom_index, bom_lookup) pair with different resolved slugs.
 */
export interface ObjectIndexRow {
  guid: string | null;
  pkey: number;
  type: string;
  slug: string;           // bom_index.slug (the entity slug, e.g., 'interpreters')
  ref: string;
  verse_id: string;
  verse_id_end: string;
  text: string;
  _resolvedSlug: string;  // precomputed from bom_lookup → bom_text → bom_slug chain
}

export interface XrelRow {
  rel: string;
  srcweight: number | null;
  dst_type: string;
  dst_slug: string;
  dst_name: string;
  dst_title: string | null;
  note: string | null;
  verse_id: number | null;
}

function groupBy<T>(rows: readonly T[], key: (r: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return map;
}

/**
 * Parse a verse_id from an xrel note string.
 * e.g., "Slew Amalickiah on Christmas Eve (Alma 51:34)" → 35154
 * Returns null when no parseable scripture reference is found.
 */
function parseVerseIdFromNote(note: string | null): number | null {
  if (!note) return null;
  const match = note.match(/\b(?:[1-4]\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:-\d+)?/);
  if (!match) return null;
  try {
    const result = lookupReference(match[0]);
    const verseIds: number[] = (result?.verse_ids as number[]) || [];
    if (Array.isArray(verseIds) && verseIds.length > 0) return verseIds[0] ?? null;
    return null;
  } catch (e) {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function objectsLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  /**
   * Fetch all object rows for a batch of slugs, ordered by weight DESC.
   * Legacy: findAll({ where: { slug }, order: [['weight', 'DESC']] })
   */
  const objectsBySlugs = async (slugs: string[]): Promise<ObjectRow[]> => {
    if (!slugs.length) return [];
    const rows = await db
      .selectFrom('bom_objects')
      .selectAll()
      .where('slug', 'in', slugs)
      .orderBy('weight', 'desc')
      .execute();
    return rows as unknown as ObjectRow[];
  };

  /**
   * Fetch the full object list (no slug filter), ordered by weight DESC.
   * Legacy returns all objects when `object`/`objectList` is queried with no
   * slug; the homepage preloads them for popup lookups. Returning [] here would
   * leave the `objectList` key empty → stripEmptyDeep drops it → the frontend's
   * positional response-keying (BoMOnlineAPI.structureResults) shifts and breaks
   * tokenSignIn → the whole app falls into the "no-wifi" failure screen.
   */
  const allObjects = async (): Promise<ObjectRow[]> => {
    const rows = await db
      .selectFrom('bom_objects')
      .selectAll()
      .orderBy('weight', 'desc')
      .execute();
    return rows as unknown as ObjectRow[];
  };

  /**
   * Index entries for a given object slug.
   *
   * Legacy behaviour (BomObjects.ts index resolver): Sequelize does
   *   BomIndex.findAll({ include: [BomLookup (hasOne via verse_id) → BomText → BomSlug] })
   * When there are multiple bom_lookup rows for the same verse_id, the SQL JOIN
   * multiplies the result, producing one parent row per (bom_index, bom_lookup) pair.
   * Each pair resolves to a different slug path (downfall/117 vs moroni/41 for Ether 4:5).
   *
   * We replicate this by joining bom_index → bom_lookup → bom_text and returning one
   * ObjectIndexRow per JOIN row (ordered by verse_id ASC, lookup.id ASC). The
   * full slug path is built via core.slugPathByLink (which traverses bom_slug ancestors)
   * so multi-level paths like "reign-of-judges/helaman/19" resolve correctly.
   * The _resolvedSlug field carries the precomputed full slug path.
   */
  const objectIndexBySlug = new DataLoader<string, ObjectIndexRow[]>(async (entitySlugs) => {
    // Join bom_index → bom_lookup (via verse_id) → bom_text
    // One result row per (bom_index row, bom_lookup row) pair.
    const joinRows = await db
      .selectFrom('bom_index as i')
      .leftJoin('bom_lookup as l', 'l.verse_id', 'i.verse_id')
      .leftJoin('bom_text as t', 't.guid', 'l.text_guid')
      .select([
        'i.guid as i_guid',
        'i.pkey as i_pkey',
        'i.type as i_type',
        'i.slug as i_slug',
        'i.ref as i_ref',
        'i.verse_id as i_verse_id',
        'i.verse_id_end as i_verse_id_end',
        'i.text as i_text',
        't.page as t_page',
        't.link as t_link',
        'l.id as lookup_id',
      ])
      .where('i.type', '=', 'object')
      .where('i.slug', 'in', [...entitySlugs])
      .orderBy('i.verse_id', 'asc')
      .orderBy('i.pkey', 'asc')
      .orderBy('l.id', 'asc')
      .execute();

    // Collect all unique page guids to batch slug path resolution
    const pageGuids = [...new Set(joinRows.map((r) => r.t_page).filter((p): p is string => p !== null))];
    const pagePathMap = pageGuids.length
      ? await core.slugPathByLink.loadMany(pageGuids)
      : [];
    const pagePaths = new Map<string, string | null>();
    for (let i = 0; i < pageGuids.length; i++) {
      const key = pageGuids[i];
      const val = pagePathMap[i];
      if (key !== undefined) {
        pagePaths.set(key, val instanceof Error ? null : (val ?? null));
      }
    }

    // Group by entity slug
    const byEntitySlug = new Map<string, ObjectIndexRow[]>();
    for (const r of joinRows) {
      const entitySlug = r.i_slug;
      const list = byEntitySlug.get(entitySlug) ?? [];
      // Resolve the full slug path via the ancestor-traversing slugPathByLink
      let resolvedSlug = 'contents';
      if (r.t_page && r.t_link !== null) {
        const pagePath = pagePaths.get(r.t_page);
        if (pagePath) resolvedSlug = `${pagePath}/${r.t_link}`;
      }
      list.push({
        guid: r.i_guid,
        pkey: r.i_pkey,
        type: r.i_type,
        slug: entitySlug,
        ref: r.i_ref,
        verse_id: r.i_verse_id,
        verse_id_end: r.i_verse_id_end,
        text: r.i_text,
        _resolvedSlug: resolvedSlug,
      });
      byEntitySlug.set(entitySlug, list);
    }

    return entitySlugs.map((s) => byEntitySlug.get(s) ?? []);
  });

  /**
   * Xrels for a given object slug.
   * Resolves dst_name/dst_title from bom_people/bom_places/bom_objects.
   * Sorts by verse_id ASC NULLS LAST, then srcweight ASC, then dst_slug ASC.
   */
  const xrelsBySlug = new DataLoader<string, XrelRow[]>(async (slugs) => {
    const rawRows = await db
      .selectFrom('bom_xrels')
      .select(['rel', 'srcweight', 'dst_type', 'dst_slug', 'note', 'src_slug'])
      .where('src_type', '=', 'object')
      .where('src_slug', 'in', [...slugs])
      .execute();

    if (!rawRows.length) return slugs.map(() => []);

    // Collect unique slugs per dst_type
    const peopleSlugs: string[] = [];
    const placeSlugs: string[] = [];
    const objectSlugs: string[] = [];
    for (const r of rawRows) {
      if (r.dst_type === 'people') peopleSlugs.push(r.dst_slug);
      else if (r.dst_type === 'place') placeSlugs.push(r.dst_slug);
      else if (r.dst_type === 'object') objectSlugs.push(r.dst_slug);
    }

    const [people, places, objects] = await Promise.all([
      peopleSlugs.length
        ? db.selectFrom('bom_people').select(['slug', 'name', 'title']).where('slug', 'in', [...new Set(peopleSlugs)]).execute()
        : [],
      placeSlugs.length
        ? db.selectFrom('bom_places').select(['slug', 'name', 'info']).where('slug', 'in', [...new Set(placeSlugs)]).execute()
        : [],
      objectSlugs.length
        ? db.selectFrom('bom_objects').select(['slug', 'name', 'subtitle']).where('slug', 'in', [...new Set(objectSlugs)]).execute()
        : [],
    ]);

    const peopleMap = new Map(people.map((p) => [p.slug, p]));
    const placeMap = new Map(places.map((p) => [p.slug, p]));
    const objectMap = new Map(objects.map((o) => [o.slug, o]));

    // Group raw rows by src_slug
    const bySrc = groupBy(rawRows, (r) => r.src_slug);

    return slugs.map((slug) => {
      const rows = bySrc.get(slug) ?? [];
      const resolved: XrelRow[] = rows.map((r) => {
        let dst_name: string = r.dst_slug;
        let dst_title: string | null = null;
        if (r.dst_type === 'people') {
          const p = peopleMap.get(r.dst_slug);
          if (p) { dst_name = p.name ?? r.dst_slug; dst_title = p.title ?? null; }
        } else if (r.dst_type === 'place') {
          const p = placeMap.get(r.dst_slug);
          if (p) { dst_name = p.name ?? r.dst_slug; dst_title = p.info ?? null; }
        } else if (r.dst_type === 'object') {
          const o = objectMap.get(r.dst_slug);
          if (o) { dst_name = o.name ?? r.dst_slug; dst_title = o.subtitle ?? null; }
        }
        // dst_type === 'group': falls through with dst_name = dst_slug, dst_title = null
        return {
          rel: r.rel,
          srcweight: r.srcweight ?? null,
          dst_type: r.dst_type,
          dst_slug: r.dst_slug,
          dst_name,
          dst_title,
          note: r.note ?? null,
          verse_id: parseVerseIdFromNote(r.note ?? null),
        };
      });

      // Sort: verse_id ASC NULLS LAST, srcweight ASC (null treated as 50), dst_slug ASC
      resolved.sort((a, b) => {
        if (a.verse_id == null && b.verse_id == null) {
          // both null: fall through
        } else if (a.verse_id == null) return 1;
        else if (b.verse_id == null) return -1;
        else if (a.verse_id !== b.verse_id) return a.verse_id - b.verse_id;
        const aw = a.srcweight ?? 50;
        const bw = b.srcweight ?? 50;
        if (aw !== bw) return aw - bw;
        return a.dst_slug.localeCompare(b.dst_slug);
      });

      return resolved;
    });
  });

  return {
    objectsBySlugs,
    allObjects,
    objectIndexBySlug,
    xrelsBySlug,
  };
}
