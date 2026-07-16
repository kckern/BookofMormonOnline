/** peopleplaces domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import { parseVerseIdFromNote, sortXrels, type XrelRow } from './objects.js';

export interface PeopleRow {
  slug: string;
  guid: string | null;
  name: string | null;
  title: string | null;
  classification: string | null;
  identification: string | null;
  unit: string | null;
  date: string | null;
  description: string | null;
  weight: number | null;
}

export interface PlaceFullRow {
  guid: string;
  slug: string;
  name: string;
  aka: string;
  info: string;
  label: string | null;
  icon: string | null;
  occupants: string;
  type: string;
  location: string;
  description: string;
  w: number;
  h: number;
  ax: number;
  ay: number;
  weight: number;
}

export interface IndexRow {
  guid: string | null;
  pkey: number;
  type: string;
  slug: string;
  ref: string;
  verse_id: string;
  verse_id_end: string;
  text: string;
}

export interface RelationRow {
  uid: number;
  src: string | null;
  srcrel: string | null;
  dst: string | null;
  dstrel: string | null;
}

export interface RelLabelRow {
  label_id: string; // stripped of 'rel_' prefix
  label_text: string;
}

export interface MapRow {
  slug: string;
  name: string;
  guid: string;
}

export interface RelationResult {
  relation: string;
  personSlug: string;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function peopleplacesLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  /** People rows keyed by slug (PK). */
  const peopleBySlug = new DataLoader<string, PeopleRow | null>(async (slugs) => {
    const rows = await db
      .selectFrom('bom_people')
      .select([
        'slug', 'guid', 'name', 'title', 'classification', 'identification',
        'unit', 'date', 'description', 'weight',
      ])
      .where('slug', 'in', [...slugs])
      .execute();
    const bySlug = new Map(rows.map((r) => [r.slug, r as PeopleRow]));
    return slugs.map((s) => bySlug.get(s) ?? null);
  });

  /** All people rows for a batch query (returns array per "batch key" — we use a list key). */
  const peopleBySlugs = async (slugs: string[]): Promise<PeopleRow[]> => {
    if (!slugs.length) return [];
    const rows = await db
      .selectFrom('bom_people')
      .select([
        'slug', 'guid', 'name', 'title', 'classification', 'identification',
        'unit', 'date', 'description', 'weight',
      ])
      .where('slug', 'in', slugs)
      .orderBy('weight', 'asc')
      .execute();
    // Return in input slug order (legacy used ORDER BY weight for the main query,
    // but the slug IN list controls which rows come back; we preserve weight order
    // since legacy did ORDER BY weight).
    return rows as PeopleRow[];
  };

  /** Place rows keyed by slug. */
  const placesBySlugLoader = new DataLoader<string, PlaceFullRow | null>(async (slugs) => {
    const rows = await db
      .selectFrom('bom_places')
      .selectAll()
      .where('slug', 'in', [...slugs])
      .execute();
    const bySlug = new Map(rows.map((r) => [r.slug, r as PlaceFullRow]));
    return slugs.map((s) => bySlug.get(s) ?? null);
  });

  const placesBySlugs = async (slugs: string[]): Promise<PlaceFullRow[]> => {
    if (!slugs.length) return [];
    const rows = await db
      .selectFrom('bom_places')
      .selectAll()
      .where('slug', 'in', slugs)
      .orderBy('weight', 'asc')
      .execute();
    return rows as PlaceFullRow[];
  };

  /** ALL people, weight-ordered (legacy person resolver returns the full list when no slug). */
  const allPeople = async (): Promise<PeopleRow[]> => {
    const rows = await db
      .selectFrom('bom_people')
      .select([
        'slug', 'guid', 'name', 'title', 'classification', 'identification',
        'unit', 'date', 'description', 'weight',
      ])
      .orderBy('weight', 'asc')
      .execute();
    return rows as PeopleRow[];
  };

  /** ALL places, weight-ordered (legacy place resolver returns the full list when no slug). */
  const allPlaces = async (): Promise<PlaceFullRow[]> => {
    const rows = await db
      .selectFrom('bom_places')
      .selectAll()
      .orderBy('weight', 'asc')
      .execute();
    return rows as PlaceFullRow[];
  };

  /**
   * Index rows for a given entity slug + type.
   * Legacy orders by verse_id ASC (via the indexSort = ['index','verse_id'] ordering
   * applied to the parent bom_people/bom_places query). Secondary sort by pkey for
   * stable ordering when multiple entries share the same verse_id.
   */
  const indexBySlug = new DataLoader<{ slug: string; type: 'people' | 'place' }, IndexRow[], string>(
    async (keys) => {
      // Group by type to batch correctly (people vs place may mix in a request)
      const slugsByType = new Map<string, string[]>();
      for (const k of keys) {
        const existing = slugsByType.get(k.type) ?? [];
        existing.push(k.slug);
        slugsByType.set(k.type, existing);
      }
      const allRows: IndexRow[] = [];
      for (const [type, slugs] of slugsByType) {
        const rows = await db
          .selectFrom('bom_index')
          .selectAll()
          .where('slug', 'in', [...new Set(slugs)])
          .where('type', '=', type)
          .orderBy('verse_id', 'asc')
          .orderBy('pkey', 'asc')
          .execute();
        allRows.push(...(rows as IndexRow[]));
      }
      const grouped = groupBy(allRows, (r) => `${r.type}:${r.slug}`);
      return keys.map((k) => grouped.get(`${k.type}:${k.slug}`) ?? []);
    },
    { cacheKeyFn: (k) => `${k.type}:${k.slug}` },
  );

  /**
   * Per-request peoplerel labels map: { relation_key → label_text }.
   * Fetched once on first use; translated for non-English langs.
   * NOT module-level state — this is per-request.
   */
  let relLabelsPromise: Promise<Map<string, string>> | null = null;
  const getRelLabels = (): Promise<Map<string, string>> => {
    if (relLabelsPromise) return relLabelsPromise;
    relLabelsPromise = (async () => {
      const rows = await db
        .selectFrom('bom_label')
        .select(['guid', 'label_id', 'label_text'])
        .where('type', '=', 'peoplerel')
        .execute();
      const map = new Map<string, string>();
      if (lang && lang !== 'en') {
        const guids = rows.map((r) => r.guid);
        const transRows = await db
          .selectFrom('bom_translation')
          .select(['guid', 'value'])
          .where('lang', '=', lang)
          .where('refkey', '=', 'label_text')
          .where('guid', 'in', guids)
          .execute();
        const transMap = new Map(transRows.map((r) => [r.guid, String(r.value)]));
        for (const row of rows) {
          const key = row.label_id.replace(/^rel_/, '');
          map.set(key, transMap.get(row.guid) ?? row.label_text);
        }
      } else {
        for (const row of rows) {
          const key = row.label_id.replace(/^rel_/, '');
          map.set(key, row.label_text);
        }
      }
      return map;
    })();
    return relLabelsPromise;
  };

  /**
   * Relations for a person slug. Returns src rels first, then dst rels.
   * Both filtered to only rows where the rel key is non-empty.
   */
  const relationsBySlug = new DataLoader<string, RelationResult[]>(async (slugs) => {
    // Load both directions
    const [srcRows, dstRows] = await Promise.all([
      db
        .selectFrom('bom_people_rels')
        .select(['uid', 'src', 'srcrel', 'dst', 'dstrel'])
        .where('src', 'in', [...slugs])
        .where('srcrel', 'is not', null)
        .where('srcrel', '!=', '')
        .orderBy('uid', 'asc')
        .execute(),
      db
        .selectFrom('bom_people_rels')
        .select(['uid', 'src', 'srcrel', 'dst', 'dstrel'])
        .where('dst', 'in', [...slugs])
        .where('dstrel', 'is not', null)
        .where('dstrel', '!=', '')
        .orderBy('uid', 'asc')
        .execute(),
    ]);
    const labels = await getRelLabels();
    const srcBySrc = groupBy(srcRows, (r) => r.src ?? null);
    const dstByDst = groupBy(dstRows, (r) => r.dst ?? null);

    return slugs.map((slug) => {
      const results: RelationResult[] = [];
      for (const rel of (srcBySrc.get(slug) ?? [])) {
        if (!rel.srcrel || !rel.dst) continue;
        const labelText = labels.get(rel.srcrel) ?? rel.srcrel;
        results.push({ relation: labelText, personSlug: rel.dst });
      }
      for (const rel of (dstByDst.get(slug) ?? [])) {
        if (!rel.dstrel || !rel.src) continue;
        const labelText = labels.get(rel.dstrel) ?? rel.dstrel;
        results.push({ relation: labelText, personSlug: rel.src });
      }
      return results;
    });
  });

  /**
   * Maps for a place (via bom_places_coords join to bom_map).
   * Keyed by place guid.
   * Legacy's belongsToMany eager-load has no explicit ORDER BY; MySQL returns rows
   * in bom_map's primary-key (slug) order — alphabetical by slug.
   */
  const mapsByPlaceGuid = new DataLoader<string, MapRow[]>(async (placeGuids) => {
    const rows = await db
      .selectFrom('bom_places_coords as c')
      .innerJoin('bom_map as m', 'm.slug', 'c.map')
      .select(['c.guid as place_guid', 'm.slug', 'm.name', 'm.guid as map_guid'])
      .where('c.guid', 'in', [...placeGuids])
      .orderBy('m.slug', 'asc')
      .execute();
    const grouped = new Map<string, MapRow[]>();
    for (const r of rows) {
      const existing = grouped.get(r.place_guid) ?? [];
      existing.push({ slug: r.slug, name: r.name, guid: r.map_guid });
      grouped.set(r.place_guid, existing);
    }
    return placeGuids.map((g) => grouped.get(g) ?? []);
  });

  /**
   * Lookup by verse_id (string) → text_guid.
   * Legacy's BomIndex.hasOne(BomLookup, {sourceKey:'verse_id', foreignKey:'verse_id'})
   * in a Sequelize batch include overwrites with later rows (LAST by id wins).
   * We reproduce this by taking the MAX(id) row per verse_id.
   */
  const lookupTextGuidByVerseId = new DataLoader<string, string | null>(async (verseIds) => {
    const rows = await db
      .selectFrom('bom_lookup')
      .select(['verse_id', 'text_guid'])
      .where('verse_id', 'in', [...verseIds])
      .orderBy('id', 'desc')
      .execute();
    // Keep last-seen (highest id) per verse_id — since we ORDER BY id DESC, first-seen is highest.
    const byVerseId = new Map<string, string>();
    for (const r of rows) {
      if (!byVerseId.has(r.verse_id)) byVerseId.set(r.verse_id, r.text_guid);
    }
    return verseIds.map((v) => byVerseId.get(v) ?? null);
  });

  /**
   * bom_text page + link by guid — for Index.slug resolution.
   */
  const textPageLinkByGuid = new DataLoader<string, { page: string | null; link: number | null } | null>(
    async (guids) => {
      const rows = await db
        .selectFrom('bom_text')
        .select(['guid', 'page', 'link'])
        .where('guid', 'in', [...guids])
        .execute();
      const byGuid = new Map(rows.map((r) => [r.guid, { page: r.page, link: r.link }]));
      return guids.map((g) => byGuid.get(g) ?? null);
    },
  );

  /**
   * Reverse-direction xrels for a person or place.
   *
   * bom_xrels is object-anchored (every row today has src_type='object');
   * people and places appear only as DESTINATIONS. So an entity's
   * relationships are the rows where it is the dst, mapped into the same
   * XrelRow shape the object side uses — with the OTHER party (the source)
   * in the dst_* fields and direction='dst' so the UI can render
   * name-before-verb ("Synagogues — taught-by" on a person popup).
   * Source names resolve by src_type across all three entity tables, so
   * future non-object sources keep working.
   */
  const xrelsByDstEntity = new DataLoader<{ type: 'people' | 'place'; slug: string }, XrelRow[], string>(
    async (keys) => {
      const types = [...new Set(keys.map((k) => k.type))];
      const slugs = [...new Set(keys.map((k) => k.slug))];
      const rawRows = await db
        .selectFrom('bom_xrels')
        .select(['rel', 'srcweight', 'src_type', 'src_slug', 'dst_type', 'dst_slug', 'note'])
        .where('dst_type', 'in', types)
        .where('dst_slug', 'in', slugs)
        .execute();

      if (!rawRows.length) return keys.map(() => []);

      const peopleSlugs: string[] = [];
      const placeSlugs: string[] = [];
      const objectSlugs: string[] = [];
      for (const r of rawRows) {
        if (r.src_type === 'people') peopleSlugs.push(r.src_slug);
        else if (r.src_type === 'place') placeSlugs.push(r.src_slug);
        else if (r.src_type === 'object') objectSlugs.push(r.src_slug);
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

      const byDst = new Map<string, XrelRow[]>();
      for (const r of rawRows) {
        let srcName: string = r.src_slug;
        let srcTitle: string | null = null;
        if (r.src_type === 'people') {
          const p = peopleMap.get(r.src_slug);
          if (p) { srcName = p.name ?? r.src_slug; srcTitle = p.title ?? null; }
        } else if (r.src_type === 'place') {
          const p = placeMap.get(r.src_slug);
          if (p) { srcName = p.name ?? r.src_slug; srcTitle = p.info ?? null; }
        } else if (r.src_type === 'object') {
          const o = objectMap.get(r.src_slug);
          if (o) { srcName = o.name ?? r.src_slug; srcTitle = o.subtitle ?? null; }
        }
        const key = `${r.dst_type}|${r.dst_slug}`;
        const list = byDst.get(key) ?? [];
        list.push({
          rel: r.rel,
          srcweight: r.srcweight ?? null,
          dst_type: r.src_type,
          dst_slug: r.src_slug,
          dst_name: srcName,
          dst_title: srcTitle,
          note: r.note ?? null,
          verse_id: parseVerseIdFromNote(r.note ?? null),
          direction: 'dst' as const,
        });
        byDst.set(key, list);
      }

      return keys.map((k) => {
        const rows = byDst.get(`${k.type}|${k.slug}`) ?? [];
        sortXrels(rows);
        return rows;
      });
    },
    { cacheKeyFn: (k) => `${k.type}|${k.slug}` }
  );

  return {
    peopleBySlug,
    peopleBySlugs,
    allPeople,
    placesBySlugLoader,
    placesBySlugs,
    allPlaces,
    indexBySlug,
    getRelLabels,
    relationsBySlug,
    mapsByPlaceGuid,
    lookupTextGuidByVerseId,
    textPageLinkByGuid,
    xrelsByDstEntity,
  };
}
