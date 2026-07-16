/** scriptureextras domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

// ─── Row shapes ─────────────────────────────────────────────────────────────

export interface ChiasmusLineRow {
  guid: string | null;
  chiasmus_id: string | null;
  i: number | null;
  verse_id: number | null;
  verses: number | null;
  line_key: string | null;
  line_text: string | null;
  highlights: string | null;
  label: string | null;
  title: string | null;
}

export interface ChiasmusRow {
  chiasmus_id: string;
  reference: string;
  scheme: string;
  title: string | null;
  /** Earliest verse_id — lets the client sort/classify without re-parsing the
   * generated reference string for every chiasm (the index list has hundreds). */
  start_verse_id: number | null;
  /** Lines are populated only when includeLines=true (chiasm query). */
  lines: ChiasmusLineRow[];
}

export interface CommentaryRow {
  id: number;
  verse_id: number | null;
  verse_range: number;
  location_guid: string;
  title: string;
  text: string;
  is_note: number;
}

export interface ImageRow {
  id: number;
  file: string;
  title: string;
  artist: string;
  location_guid: string | null;
}

export interface ObjectRow {
  guid: string;
  slug: string;
  name: string;
  subtitle: string | null;
  category: string;
}

export interface PassageNotesRefRow {
  verse_id: number;
  type: string;
  significant: number;
  ref: string;
}

export interface PeopleItem {
  slug: string;
  name: string | null;
  title: string | null;
}

export interface PlaceItem {
  guid: string;
  slug: string;
  name: string | null;
  info: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Chiasmus reduce ─────────────────────────────────────────────────────────

/**
 * Reduce a flat list of chiasmus line rows (ordered by `i`) into ChiasmusRow
 * objects.
 *
 * `allLines` — ALL lines for the chiasmus_ids involved (needed for scheme
 *              computation across all lines, not just matched ones).
 * `matchedLines` — lines that matched the filter (verse_ids IN / id IN);
 *                  determines insertion order of result.
 * `generateRefFn` — caller supplies lang-bound generateReference.
 * `includeLines` — true for chiasm (full lines), false for chiasmus/passagenotes.
 *
 * For passagenotes, scheme = first matched line_key only (legacy code set
 * acc[chiasmus_id].scheme = item.line_key and only assigned once via
 * `if (!acc[chiasmus_id])`).
 */
export function reduceChiasmusLines(
  allLines: ChiasmusLineRow[],
  matchedLines: ChiasmusLineRow[],
  generateRefFn: (verseIds: number[]) => string,
  includeLines: boolean,
  passageNoteScheme: boolean,
): ChiasmusRow[] {
  // Build a map: chiasmus_id → all lines belonging to it
  const linesByChiasm = groupBy(allLines, (r) => r.chiasmus_id ?? null);

  const seen = new Set<string>();
  const result: ChiasmusRow[] = [];

  for (const line of matchedLines) {
    const cid = line.chiasmus_id;
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);

    const chiasmLines = linesByChiasm.get(cid) ?? [];

    // Scheme: passagenotes uses only first matched line_key; chiasm/chiasmus uses all
    const scheme = passageNoteScheme
      ? (line.line_key ?? '')
      : chiasmLines.map((l) => l.line_key ?? '').join('');

    // Reference: from unique verse_ids spanning all lines of this chiasmus
    const verseIds: number[] = [];
    const seenVerseIds = new Set<number>();
    for (const l of chiasmLines) {
      if (l.verse_id == null) continue;
      for (let i = 0; i < (l.verses ?? 1); i++) {
        const vid = l.verse_id + i;
        if (!seenVerseIds.has(vid)) {
          seenVerseIds.add(vid);
          verseIds.push(vid);
        }
      }
    }

    const firstLine = chiasmLines[0];
    const title = firstLine?.title ?? null;

    const row: ChiasmusRow = {
      chiasmus_id: cid,
      reference: generateRefFn(verseIds),
      scheme,
      title,
      start_verse_id: verseIds.length ? Math.min(...verseIds) : null,
      lines: includeLines
        ? chiasmLines.map((l) => ({ ...l }))
        : [],
    };
    result.push(row);
  }
  return result;
}

// ─── scriptureextrasLoaders factory ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function scriptureextrasLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  // ─── Chiasmus: fetch all lines (optionally filtered by chiasmus_id) ─────────

  const fetchChiasmusLines = async (ids?: string[]): Promise<ChiasmusLineRow[]> => {
    let rows: ChiasmusLineRow[];
    if (ids && ids.length > 0) {
      // When filtering by specific chiasmus_ids, NO ORDER BY so MySQL uses
      // natural table (insertion) order — that is the order legacy reduce saw.
      rows = (await db
        .selectFrom('bom_xtras_chiasmus')
        .selectAll()
        .where('chiasmus_id', 'in', ids)
        .execute()) as ChiasmusLineRow[];
    } else {
      // Full-table scan: no ORDER BY — natural InnoDB insertion order, which is
      // the exact order legacy's findAll(config) iterated and thus what determines
      // chiasm ordering in the reduce output.
      rows = (await db
        .selectFrom('bom_xtras_chiasmus')
        .selectAll()
        .execute()) as ChiasmusLineRow[];
    }

    if (lang && lang !== 'en' && rows.length > 0) {
      const guids = rows.map((r) => r.guid).filter((g): g is string => g !== null);
      if (guids.length > 0) {
        const transRows = await db
          .selectFrom('bom_translation')
          .select(['guid', 'refkey', 'value'])
          .where('lang', '=', lang)
          .where('refkey', 'in', ['line_text', 'highlights', 'label', 'title'])
          .where('guid', 'in', guids)
          .execute();
        const transMap = new Map<string, Map<string, string>>();
        for (const t of transRows) {
          if (!transMap.has(t.guid)) transMap.set(t.guid, new Map());
          transMap.get(t.guid)!.set(t.refkey, String(t.value));
        }
        rows = rows.map((r) => {
          if (!r.guid) return r;
          const tmap = transMap.get(r.guid);
          if (!tmap) return r;
          return {
            ...r,
            line_text:  tmap.get('line_text')  ?? r.line_text,
            highlights: tmap.get('highlights') ?? r.highlights,
            label:      tmap.get('label')      ?? r.label,
            title:      tmap.get('title')      ?? r.title,
          };
        });
      }
    }
    return rows;
  };

  // ─── Commentary ─────────────────────────────────────────────────────────────

  const fetchCommentary = async (verseIds: number[]): Promise<CommentaryRow[]> => {
    if (!verseIds.length) return [];
    // No ORDER BY: legacy findAll had no order; MySQL uses PK (id) clustered scan.
    // LIMIT 100 matches legacy resolver.
    return db
      .selectFrom('bom_xtras_commentary')
      .select(['id', 'verse_id', 'verse_range', 'location_guid', 'title', 'text', 'is_note'])
      .where('verse_id', 'in', verseIds)
      .where('is_note', '!=', 1)
      .limit(100)
      .execute() as Promise<CommentaryRow[]>;
  };

  // ─── text_guids from verse_ids (INTEGER comparison — legacy compat) ─────────

  /**
   * Fetch distinct text_guids for a set of verse_ids.
   *
   * CRITICAL compat: legacy Sequelize passes INTEGER verse_ids into bom_lookup's
   * STRING verse_id column. MySQL uses a different index access path (integer
   * coercion scan) that produces a DIFFERENT row order than the string-IN version.
   * We replicate by using raw SQL with integer (unquoted) placeholders.
   *
   * The order matters because it determines the order in which loadPeopleFromTextGuid
   * is called, which concatenates onto the people result.
   */
  const fetchTextGuidsForVerseIds = async (verseIds: number[]): Promise<string[]> => {
    if (!verseIds.length) return [];
    const { rows } = await sql<{ text_guid: string }>`
      SELECT text_guid FROM bom_lookup WHERE verse_id IN (${sql.join(verseIds)})
    `.execute(db);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of rows) {
      if (!seen.has(r.text_guid)) {
        seen.add(r.text_guid);
        result.push(r.text_guid);
      }
    }
    return result;
  };

  // ─── People ─────────────────────────────────────────────────────────────────

  /**
   * Legacy `loadPeopleFromVerseIds`: bom_index (type=people, range overlap) →
   * bom_people (PK slug order, no ORDER BY).
   */
  const loadPeopleFromVerseIds = async (verseIds: number[]): Promise<PeopleItem[]> => {
    if (!verseIds.length) return [];
    const minV = String(Math.min(...verseIds));
    const maxV = String(Math.max(...verseIds));

    const indexRows = await db
      .selectFrom('bom_index')
      .select(['slug'])
      .where('type', '=', 'people')
      .where('verse_id', '<=', maxV)
      .where('verse_id_end', '>=', minV)
      .execute();

    const uniqueSlugs = [...new Set(indexRows.map((r) => r.slug))];
    if (!uniqueSlugs.length) return [];

    const rows = await db
      .selectFrom('bom_people')
      .select(['slug', 'name', 'title'])
      .where('slug', 'in', uniqueSlugs)
      .execute();

    if (!core.translator.active) return rows as PeopleItem[];

    const [nameMap, titleMap] = await Promise.all([
      core.translator.forGuids(rows.map((r) => r.slug), 'name'),
      core.translator.forGuids(rows.map((r) => r.slug), 'title'),
    ]);
    return rows.map((r) => ({
      slug: r.slug,
      name: nameMap.get(r.slug) ?? r.name,
      title: titleMap.get(r.slug) ?? r.title,
    }));
  };

  /**
   * Legacy `loadPeopleFromTextGuid`: join bom_lookup → bom_index on verse_id
   * (using the text_guid's verse_ids) → bom_people.
   *
   * Note: we load the lookup verse_ids as STRING (they are strings in bom_lookup)
   * and join to bom_index.verse_id (also STRING). The dedup produces slug insertion
   * order from the join result; bom_people returns in PK (slug) order.
   */
  const loadPeopleFromTextGuid = async (textGuid: string): Promise<PeopleItem[]> => {
    const lookupRows = await db
      .selectFrom('bom_lookup')
      .select(['verse_id'])
      .where('text_guid', '=', textGuid)
      .execute();
    if (!lookupRows.length) return [];

    const verseIds = lookupRows.map((r) => r.verse_id); // strings
    const indexRows = await db
      .selectFrom('bom_index')
      .select(['slug'])
      .where('type', '=', 'people')
      .where('verse_id', 'in', verseIds)
      .execute();

    const uniqueSlugs = [...new Set(indexRows.map((r) => r.slug))];
    if (!uniqueSlugs.length) return [];

    const rows = await db
      .selectFrom('bom_people')
      .select(['slug', 'name', 'title'])
      .where('slug', 'in', uniqueSlugs)
      .execute();

    if (!core.translator.active) return rows as PeopleItem[];

    const [nameMap, titleMap] = await Promise.all([
      core.translator.forGuids(rows.map((r) => r.slug), 'name'),
      core.translator.forGuids(rows.map((r) => r.slug), 'title'),
    ]);
    return rows.map((r) => ({
      slug: r.slug,
      name: nameMap.get(r.slug) ?? r.name,
      title: titleMap.get(r.slug) ?? r.title,
    }));
  };

  // ─── Places ─────────────────────────────────────────────────────────────────

  const loadPlacesFromVerseIds = async (verseIds: number[]): Promise<PlaceItem[]> => {
    if (!verseIds.length) return [];
    const minV = String(Math.min(...verseIds));
    const maxV = String(Math.max(...verseIds));

    const indexRows = await db
      .selectFrom('bom_index')
      .select(['slug'])
      .where('type', '=', 'place')
      .where('verse_id', '<=', maxV)
      .where('verse_id_end', '>=', minV)
      .execute();

    const uniqueSlugs = [...new Set(indexRows.map((r) => r.slug))];
    if (!uniqueSlugs.length) return [];

    const rows = await db
      .selectFrom('bom_places')
      .select(['guid', 'slug', 'name', 'info'])
      .where('slug', 'in', uniqueSlugs)
      .execute();

    if (!core.translator.active) return rows as PlaceItem[];

    const [nameMap, infoMap] = await Promise.all([
      core.translator.forGuids(rows.map((r) => r.guid), 'name'),
      core.translator.forGuids(rows.map((r) => r.guid), 'info'),
    ]);
    return rows.map((r) => ({
      guid: r.guid,
      slug: r.slug,
      name: nameMap.get(r.guid) ?? r.name,
      info: infoMap.get(r.guid) ?? r.info,
    }));
  };

  // ─── Objects ─────────────────────────────────────────────────────────────────

  const loadObjectsFromVerseIds = async (verseIds: number[]): Promise<ObjectRow[]> => {
    if (!verseIds.length) return [];
    const minV = String(Math.min(...verseIds));
    const maxV = String(Math.max(...verseIds));

    const indexRows = await db
      .selectFrom('bom_index')
      .select(['slug'])
      .where('type', '=', 'object')
      .where('verse_id', '<=', maxV)
      .where('verse_id_end', '>=', minV)
      .execute();

    const uniqueSlugs = [...new Set(indexRows.map((r) => r.slug))];
    if (!uniqueSlugs.length) return [];

    return db
      .selectFrom('bom_objects')
      .select(['guid', 'slug', 'name', 'subtitle', 'category'])
      .where('slug', 'in', uniqueSlugs)
      .execute() as Promise<ObjectRow[]>;
  };

  const loadObjectsFromTextGuid = async (textGuid: string): Promise<ObjectRow[]> => {
    const lookupRows = await db
      .selectFrom('bom_lookup')
      .select(['verse_id'])
      .where('text_guid', '=', textGuid)
      .execute();
    if (!lookupRows.length) return [];

    const verseIds = lookupRows.map((r) => r.verse_id);
    const indexRows = await db
      .selectFrom('bom_index')
      .select(['slug'])
      .where('type', '=', 'object')
      .where('verse_id', 'in', verseIds)
      .execute();

    const uniqueSlugs = [...new Set(indexRows.map((r) => r.slug))];
    if (!uniqueSlugs.length) return [];

    return db
      .selectFrom('bom_objects')
      .select(['guid', 'slug', 'name', 'subtitle', 'category'])
      .where('slug', 'in', uniqueSlugs)
      .execute() as Promise<ObjectRow[]>;
  };

  // ─── Images ──────────────────────────────────────────────────────────────────

  /**
   * Fetch images for given text_guids (location_guid match), ordered by id.
   * Translation: image title uses `id` (as string) as bom_translation.guid.
   */
  const fetchImages = async (textGuids: string[]): Promise<ImageRow[]> => {
    if (!textGuids.length) return [];

    const rows = await db
      .selectFrom('bom_xtras_image')
      .select(['id', 'file', 'title', 'artist', 'location_guid'])
      .where('location_guid', 'in', textGuids)
      .orderBy('id', 'asc')
      .execute();

    if (!core.translator.active || !rows.length) return rows as ImageRow[];

    const guids = rows.map((r) => String(r.id));
    const titleMap = await core.translator.forGuids(guids, 'title');
    return rows.map((r) => ({
      ...r,
      title: titleMap.get(String(r.id)) ?? r.title,
    })) as ImageRow[];
  };

  // ─── Refs ─────────────────────────────────────────────────────────────────────

  const fetchRefsForVerseIds = async (verseIds: number[]): Promise<PassageNotesRefRow[]> => {
    if (!verseIds.length) return [];
    const { rows } = await sql<{
      verse_id: number;
      type: string;
      significant: number;
      ref: string;
    }>`SELECT dst_verse_id AS verse_id, \`type\`, significant, dst_ref AS ref
       FROM \`scripture.guide\`.scripture_references
       WHERE src_verse_id IN (${sql.join(verseIds)})
         AND \`type\` = 'xref'
         AND significant IN (0, 1, -1)`.execute(db);

    // organizeRelatedScriptures: dedupe by verse_id, keep first occurrence
    const seen = new Set<number>();
    return rows.filter((r) =>
      seen.has(r.verse_id) ? false : (seen.add(r.verse_id), true),
    );
  };

  // ─── Chiasmus lines by verse_id (for passagenotes sub-chiasm) ────────────────

  /**
   * Fetch chiasmus lines whose verse_id is IN the given list.
   * Used by passagenotes.chiasmus to get only lines touching the verse range,
   * then we fetch all lines for those chiasmus_ids separately for scheme/reference.
   * Returns in `i` order. No translation — translations are applied by
   * fetchChiasmusLines when we reload the full chiasmus.
   */
  const fetchChiasmusLinesForVerseIds = async (
    verseIds: number[],
  ): Promise<ChiasmusLineRow[]> => {
    if (!verseIds.length) return [];
    // No ORDER BY: natural table order, matching legacy findAll behavior.
    return db
      .selectFrom('bom_xtras_chiasmus')
      .selectAll()
      .where('verse_id', 'in', verseIds)
      .execute() as Promise<ChiasmusLineRow[]>;
  };

  return {
    fetchChiasmusLines,
    fetchChiasmusLinesForVerseIds,
    fetchCommentary,
    fetchTextGuidsForVerseIds,
    loadPeopleFromVerseIds,
    loadPeopleFromTextGuid,
    loadPlacesFromVerseIds,
    loadObjectsFromVerseIds,
    loadObjectsFromTextGuid,
    fetchImages,
    fetchRefsForVerseIds,
  };
}
