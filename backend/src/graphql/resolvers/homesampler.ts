/**
 * homesampler — aggregate seeded random samples for the /home sampler page.
 * Design: docs/plans/2026-07-15-home-sampler-redesign-design.md
 *
 * Determinism: ORDER BY MD5(CONCAT(<pk>, ':', <seed>)) — stable for a given
 * seed regardless of storage-engine scan order (unlike seeded RAND()).
 *
 * Extensibility: add a field to schema/HomeSampler.graphql, a sampler here,
 * run codegen — nothing else changes.
 */
import { sql } from 'kysely';
import { generateReference, lookupReference } from 'scripture-guide';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { findUserByToken } from '../../data/loaders/userauth.js';
import { parseVerseIdFromNote } from '../../data/loaders/matters.js';
import { canonicalSelector } from '../../media/fax/canonical.js';
import { imageScanMeta } from '../../media/fax/resolve.js';
import { getHomeSamplerCache } from '../homeSamplerCacheStore.js';
import { currentBucket, seedForBucket } from '../homeSamplerCache.js';

// 24 people = 1 featured + 11 face cards + 12 view-all mosaic thumbs (3×4);
// 17 places = 5 cards + a full 3×4 mosaic.
const PEOPLE_COUNT = 24;
const PLACES_COUNT = 17;
const MIN_COMMENTARY_CHARS = 500;
const MIN_PERSON_DESC_CHARS = 40;

const seededOrder = (column: string, seed: number) =>
  sql`MD5(CONCAT(${sql.ref(column)}, ':', ${seed}))`;

const samplePeople = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_people')
    .select([
      'slug', 'guid', 'name', 'title', 'classification', 'identification',
      'unit', 'date', 'description', 'weight',
    ])
    .where('description', 'is not', null)
    .where(sql<boolean>`CHAR_LENGTH(description) > ${MIN_PERSON_DESC_CHARS}`)
    .orderBy(seededOrder('slug', seed))
    .limit(PEOPLE_COUNT)
    .execute();

const samplePlaces = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_places')
    .selectAll()
    .where('name', 'is not', null)
    .orderBy(seededOrder('slug', seed))
    .limit(PLACES_COUNT)
    .execute();

const sampleFax = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.loaders.faxByFilter.load('');
  // ANY facsimile we hold with page images — not just the verse-indexed ones.
  // Pages carry scripture refs only for indexed editions (sampleFaxPages
  // degrades gracefully for the rest).
  // ROBUSTNESS: the loader's order is weight-only with no tiebreak and is NOT
  // stable across calls; sort by slug so the modulo pick is deterministic.
  const sorted = rows
    .filter((r) => !r.hide && !r.com && Number(r.pages) > 0)
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  return sorted.length ? sorted[seed % sorted.length] : null;
};

// Compact reference for the full verse span a fax page covers. generateReference
// only produces a proper range ("Alma 26:1-30:4") from a CONTIGUOUS id list, so
// fill first→last; [first,last] alone yields "Alma 26:1; 30:4".
const pageRangeRef = (first: number, last: number): string => {
  if (!last || last <= first) return generateReference([first]);
  // guard against a pathological span blowing up the array (real fax pages span
  // a chapter or two); fall back to endpoints if it's implausibly large
  if (last - first > 600) return generateReference([first, last]);
  const ids: number[] = [];
  for (let v = first; v <= last; v++) ids.push(v);
  return generateReference(ids);
};

// Two seeded pages OF THE SAMPLED FAX. For verse-indexed editions the pages
// carry a scripture reference; for the rest we show representative
// mid-document pages with no ref (the edition may simply not be indexed).
const sampleFaxPages = async (ctx: AppContext, seed: number) => {
  const fax = (await sampleFax(ctx, seed)) as { slug?: string; pages?: number } | null;
  if (!fax?.slug) return [];
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax_index')
    .select(({ fn }) => [
      'page',
      fn.min<string>('verse_id').as('firstVerse'),
      fn.max<string>('verse_id').as('lastVerse'),
    ])
    .where('version', '=', String(fax.slug))
    .groupBy('page')
    .orderBy('page')
    .execute();
  if (rows.length) {
    const start = seed % rows.length;
    const picks = [rows[start], rows[(start + 1) % rows.length]]
      .filter((r, i, a) => r && a.findIndex((x) => x?.page === r.page) === i);
    // `page` is the printed folio (bom_xtras_fax_index.page, the canonical route
    // identity). The thumbnail asset is keyed by the scan image-file number, which
    // differs by the per-edition offset: imageFile = folio + offset.
    const { offset } = await imageScanMeta(String(fax.slug));
    return picks.map((r) => ({
      page: Number(r!.page),
      imageFile: Number(r!.page) + offset,
      // the full verse SPAN the page covers (first→last indexed verse), rendered
      // as a compact range like "Alma 26:1-30:4"
      ref: pageRangeRef(Number(r!.firstVerse), Number(r!.lastVerse)),
    }));
  }
  // Un-indexed edition: two mid-document pages so the tile still shows content.
  const total = Number(fax.pages) || 0;
  if (total < 2) return [];
  const mid = Math.min(total - 1, Math.max(2, Math.floor(total * 0.4) + (seed % 7)));
  const pages = [mid, Math.min(total, mid + 1)].filter((v, i, a) => a.indexOf(v) === i);
  // Un-indexed editions have no folio index; `page` is already the image-file
  // number and the viewer treats their slugs as image-file (no offset), so the
  // thumbnail key equals the page number.
  return pages.map((p) => ({ page: p, imageFile: p, ref: null }));
};

// A few OTHER editions (beyond the sampled one) — the fax tile lists them as
// entry points so the sampler reads as "we hold a collection". Only editions we
// actually hold page scans for (fax=1) and that aren't commercial reprints
// (com=0): the tile deep-links into the viewer, so a cover with no scans behind
// it is a dead end and paywalled editions don't belong in a free sampler.
const sampleFaxMore = async (ctx: AppContext, seed: number) => {
  const current = (await sampleFax(ctx, seed)) as { slug?: string } | null;
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax')
    .select(['slug', 'title', 'pages'])
    .where('hide', '=', 0)
    .where('lang', '=', 'en')
    .where('slug', 'is not', null)
    .where('fax', '=', 1) // we hold page scans for it (viewer has something to show)
    .where('com', '=', 0) // exclude commercial / in-copyright reprints
    .where(sql<boolean>`pages > 0`)
    .orderBy(seededOrder('slug', seed))
    .execute();
  // a small RANDOM sample of other editions (the tile is a sampler, not the
  // whole /fax catalog) — four covers alongside the featured edition's pages
  return rows
    .filter((r) => String(r.slug) !== String(current?.slug))
    .slice(0, 4)
    .map((r) => ({ slug: r.slug, title: r.title, pages: Number(r.pages) || null }));
};

// The image's bom_text.heading is sometimes a scripture ref ("1 Nephi 13:40–41")
// and sometimes a descriptive title ("The Messiah to come to the Promised Land").
// Emit a STANDARD scripture reference: prefer the heading when it parses (keeps
// the verse range), else fall back to the passage's first verse. `min_verse_id`
// is the only verse column bom_text carries.
const standardArtRef = (heading: string | null, minVerseId: number | null): string | null => {
  if (heading) {
    const ids = lookupReference(heading)?.verse_ids || [];
    // guard against a bare book name ("Alma") exploding into the whole book
    if (ids.length && ids.length <= 20) return generateReference(ids);
  }
  return minVerseId ? generateReference([Number(minVerseId)]) : null;
};

// Standalone artwork for image tiles — landscape-ish pieces read best in a
// tile, so prefer wider-than-tall; carry title/artist for the caption.
const sampleArt = async (ctx: AppContext, seed: number) => {
  // JOIN the piece's location to bom_text so we can show the scripture it
  // illustrates (heading) and deep-link into that passage.
  const rows = await ctx.db
    .selectFrom('bom_xtras_image')
    .leftJoin('bom_text', 'bom_text.guid', 'bom_xtras_image.location_guid')
    .select([
      'bom_xtras_image.id as id',
      'bom_xtras_image.title as title',
      'bom_xtras_image.artist as artist',
      'bom_xtras_image.width as width',
      'bom_xtras_image.height as height',
      'bom_text.heading as ref',
      'bom_text.min_verse_id as minVerseId',
    ])
    .where('bom_xtras_image.file', 'is not', null)
    .where(sql<boolean>`bom_xtras_image.width > 0 AND bom_xtras_image.height > 0`)
    .orderBy(seededOrder('bom_xtras_image.id', seed))
    .limit(8)
    .execute();
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title || null,
    artist: r.artist || null,
    width: Number(r.width) || null,
    height: Number(r.height) || null,
    ref: standardArtRef(r.ref ?? null, r.minVerseId != null ? Number(r.minVerseId) : null),
  }));
};

// Book of Mormon witness statements (Harris, Cowdery, the Whitmers, the Three
// Witnesses…) from the 'witnesses' history archive. Returns the principal, a
// short statement, and a source line. No portrait assets exist for these
// figures, so the tile renders a monogram — see docs if that changes.
// principal → the Witnesses-view slug (portraits live at
// /history/witnesses/people/<slug>.jpg, deep link at /history/witnesses/<slug>)
const WITNESS_SLUG: Record<string, string> = {
  'Martin Harris': 'martin-harris',
  'Oliver Cowdery': 'oliver-cowdery',
  'David Whitmer': 'david-whitmer',
  'John Whitmer': 'john-whitmer',
  'Hyrum Smith': 'hyrum-smith',
  'Samuel H. Smith': 'samuel-smith',
};
const WITNESS_PRINCIPALS = Object.keys(WITNESS_SLUG);
const sampleWitnesses = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_history')
    .select(['slug', 'principal', 'author', 'citation', 'metadata'])
    .where('archive', '=', 'witnesses')
    .where('principal', 'in', WITNESS_PRINCIPALS)
    // Only rows with an editorially-prepared money quote are quotable. A row
    // without one has no attributable statement and must never reach this tile —
    // teaser/transcript are catalog prose, not testimony. (attribution handoff)
    .where(sql<boolean>`JSON_EXTRACT(metadata,'$.money_quote') IS NOT NULL`)
    .orderBy(seededOrder('slug', seed))
    .limit(40)
    .execute();
  // one statement per principal → variety, not three Whitmers in a row
  const byPrincipal = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!byPrincipal.has(String(r.principal))) byPrincipal.set(String(r.principal), r);
  }
  return [...byPrincipal.values()].slice(0, 3).map((r) => {
    let reference: string | null = null;
    let moneyQuote: string | null = null;
    let speaker: string | null = null;
    let isWitnessVoice: boolean | null = null;
    try {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata as Record<string, unknown> | null);
      reference = (meta?.reference as string) || null;
      // The card leads with the editorially-prepared money quote and its real
      // speaker — NEVER teaser/transcript (which would fabricate an attribution).
      moneyQuote = (meta?.money_quote as string) || null;
      speaker = (meta?.quote_speaker as string) || null;
      isWitnessVoice = (meta?.quote_is_witness_voice as boolean) ?? null;
    } catch { /* metadata may be absent/invalid */ }
    return {
      slug: r.slug,
      witnessSlug: WITNESS_SLUG[String(r.principal)] || null,
      principal: r.principal,
      moneyQuote,
      speaker,
      isWitnessVoice,
      source: reference || r.citation || r.author || null,
    };
  });
};

// One facsimile page anchored to the verse it depicts — the inverse framing of
// the fax tile ("the page for THIS verse", not "this edition"). Seeded over the
// whole verse index across visible editions.
const sampleFaxVerse = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax_index as i')
    .innerJoin('bom_xtras_fax as f', 'f.slug', 'i.version')
    .select(['i.version as version', 'i.page as page', 'i.verse_id as verseId', 'f.title as title', 'f.format as format'])
    .where('f.hide', '=', 0)
    .where('i.verse_id', 'is not', null)
    .orderBy(sql`MD5(CONCAT(${sql.ref('i.version')}, ':', ${sql.ref('i.page')}, ':', ${seed}))`)
    .limit(1)
    .execute();
  const r = rows[0];
  if (!r) return null;
  const verseId = Number(r.verseId);

  // Every edition that has a box for this verse (one row per edition, min page).
  const edRows = await ctx.db
    .selectFrom('bom_xtras_fax_index as i')
    .innerJoin('bom_xtras_fax as f', 'f.slug', 'i.version')
    .select(['i.version as version', 'f.title as title'])
    .select((eb) => eb.fn.min('i.page').as('page'))
    .where('i.verse_id', '=', String(verseId))
    .where('f.hide', '=', 0)
    .groupBy(['i.version', 'f.title'])
    .orderBy(sql`MD5(CONCAT(${sql.ref('i.version')}, ':', ${seed}))`)
    .execute();

  // Sampled edition first, then up to 3 seeded others (max 4).
  const ordered = [
    ...edRows.filter((e) => String(e.version) === String(r.version)),
    ...edRows.filter((e) => String(e.version) !== String(r.version)),
  ].slice(0, 4);
  const editions = ordered.map((e) => ({
    version: String(e.version),
    title: e.title ?? null,
    page: Number(e.page),
  }));

  return {
    version: String(r.version),
    title: r.title ?? null,
    format: r.format || 'jpg',
    page: Number(r.page),
    verseId,
    ref: generateReference([verseId]),
    selector: canonicalSelector([verseId]),
    editions,
  };
};

// A verse plus its footnote cross-references. The crossref table has no topical
// titles — the "title" of each link is its reference string, regenerated via
// generateReference (stored dst_ref shorthand is inconsistent). We sample over
// all type='xref' rows: the `significant` column (-1/0 for xrefs) is not an
// importance ranking, so we don't filter on it. GROUP BY + HAVING needs raw sql
// (kysely's builder types fight aggregates here).
const sampleCrossRefs = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ src_verse_id: number }>`
    SELECT src_verse_id FROM lds_scriptures_crossref
    WHERE \`type\` = 'xref'
    GROUP BY src_verse_id HAVING COUNT(DISTINCT dst_verse_id) >= 2
    ORDER BY MD5(CONCAT(src_verse_id, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const src = Number(hub.rows[0]?.src_verse_id);
  if (!src) return null;
  const rows = await ctx.db
    .selectFrom('lds_scriptures_crossref')
    .select('dst_verse_id')
    .where('src_verse_id', '=', src)
    .where('type', '=', 'xref')
    .orderBy(seededOrder('dst_verse_id', seed))
    .limit(8)
    .execute();
  const dsts = [...new Set(rows.map((r) => Number(r.dst_verse_id)))]
    .filter((v) => v > 0 && v !== src)
    .slice(0, 4);
  if (dsts.length < 2) return null;
  return {
    srcVerseId: src,
    srcRef: generateReference([src]),
    refs: dsts.map((v) => ({ verseId: v, ref: generateReference([v]) })),
  };
};

// Entity display-name lookup for relationship hubs/edges. Column meanings per
// type mirror xrelsBySlug in loaders/matters.ts: people name/title,
// places name/info, matters name/subtitle.
const entityNames = async (
  ctx: AppContext,
  wanted: { type: string; slug: string }[],
): Promise<Map<string, { name: string; title: string | null }>> => {
  const slugsOf = (t: string) => [...new Set(wanted.filter((w) => w.type === t).map((w) => w.slug))];
  const [people, places, matters] = await Promise.all([
    slugsOf('people').length
      ? ctx.db.selectFrom('bom_people').select(['slug', 'name', 'title']).where('slug', 'in', slugsOf('people')).execute()
      : [],
    slugsOf('place').length
      ? ctx.db.selectFrom('bom_places').select(['slug', 'name', 'info']).where('slug', 'in', slugsOf('place')).execute()
      : [],
    slugsOf('matter').length
      ? ctx.db.selectFrom('bom_matters').select(['slug', 'name', 'subtitle']).where('slug', 'in', slugsOf('matter')).execute()
      : [],
  ]);
  const map = new Map<string, { name: string; title: string | null }>();
  for (const p of people) if (p.name) map.set(`people:${p.slug}`, { name: p.name, title: p.title ?? null });
  for (const p of places) if (p.name) map.set(`place:${p.slug}`, { name: p.name, title: p.info ?? null });
  for (const o of matters) if (o.name) map.set(`matter:${o.slug}`, { name: o.name, title: o.subtitle ?? null });
  return map;
};

// Entity types this sampler can resolve to a display name (see entityNames).
// bom_xrels also carries src_type/dst_type='theology', but bom_theology has no
// loader or view yet, so those rows are excluded rather than rendered as a bare
// slug. Widen this list when the theology domain lands.
const SAMPLEABLE_TYPES = ['people', 'place', 'matter'] as const;

// One well-connected hub entity and up to 4 of its typed relations. The hub is
// seeded over (src_type, src_slug) pairs with >=2 RESOLVABLE edges; GROUP BY
// needs raw sql. Counting only resolvable edges here keeps the hub pick in sync
// with the edge query below — otherwise a hub whose edges are all theology
// passes the HAVING and then falls out at the <2 check, returning null for that
// seed. Edges whose dst still can't be named are dropped (a bare slug reads as
// a bug on the front door); if that leaves <2, return null.
const sampleRelationship = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ src_type: string; src_slug: string }>`
    SELECT src_type, src_slug FROM bom_xrels
    WHERE src_type IN (${sql.join(SAMPLEABLE_TYPES.map((t) => sql.lit(t)))})
      AND dst_type IN (${sql.join(SAMPLEABLE_TYPES.map((t) => sql.lit(t)))})
    GROUP BY src_type, src_slug HAVING COUNT(*) >= 2
    ORDER BY MD5(CONCAT(src_type, ':', src_slug, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const h = hub.rows[0];
  if (!h) return null;
  const edgeRows = await ctx.db
    .selectFrom('bom_xrels')
    .select(['rel', 'dst_type', 'dst_slug', 'note'])
    .where('src_type', '=', h.src_type)
    .where('src_slug', '=', h.src_slug)
    .where('dst_type', 'in', [...SAMPLEABLE_TYPES])
    .orderBy(seededOrder('dst_slug', seed))
    .limit(6)
    .execute();
  const names = await entityNames(ctx, [
    { type: h.src_type, slug: h.src_slug },
    ...edgeRows.map((e) => ({ type: e.dst_type, slug: e.dst_slug })),
  ]);
  const hubName = names.get(`${h.src_type}:${h.src_slug}`);
  if (!hubName) return null;
  const edges = edgeRows
    .map((e) => {
      const dst = names.get(`${e.dst_type}:${e.dst_slug}`);
      if (!dst) return null;
      const verseId = parseVerseIdFromNote(e.note ?? null);
      return {
        rel: e.rel,
        dstType: e.dst_type,
        dstSlug: e.dst_slug,
        dstName: dst.name,
        dstTitle: dst.title,
        note: e.note ?? null,
        ref: verseId ? generateReference([verseId]) : null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, 4);
  if (edges.length < 2) return null;
  return {
    hubType: h.src_type,
    hubSlug: h.src_slug,
    hubName: hubName.name,
    hubTitle: hubName.title,
    edges,
  };
};

// One scripture journey for the map-story tile: seeded story pick among stories
// whose moves ALL have start+end coords on the FARMS 'internal' map (the tile
// renders that projection — a partially-coordinated story would draw a broken
// path). Join shape mirrors storiesByMapSlug in loaders/maps.ts.
const INTERNAL_MAP = 'internal';
const sampleMapStory = async (ctx: AppContext, seed: number) => {
  const hub = await sql<{ guid: string }>`
    SELECT s.guid AS guid
    FROM bom_map_story s
    INNER JOIN bom_map_move m ON m.parent = s.guid
    INNER JOIN bom_places sp ON sp.slug = m.start
    INNER JOIN bom_places_coords spc ON spc.guid = sp.guid AND spc.map = ${INTERNAL_MAP}
    INNER JOIN bom_places ep ON ep.slug = m.end
    INNER JOIN bom_places_coords epc ON epc.guid = ep.guid AND epc.map = ${INTERNAL_MAP}
    GROUP BY s.guid HAVING COUNT(*) >= 2
    ORDER BY MD5(CONCAT(s.guid, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
  const guid = hub.rows[0]?.guid;
  if (!guid) return null;
  const rows = await ctx.db
    .selectFrom('bom_map_move as m')
    .innerJoin('bom_map_story as s', 's.guid', 'm.parent')
    .innerJoin('bom_places as sp', 'sp.slug', 'm.start')
    .innerJoin('bom_places_coords as spc', (join) =>
      join.onRef('spc.guid', '=', 'sp.guid').on('spc.map', '=', INTERNAL_MAP),
    )
    .innerJoin('bom_places as ep', 'ep.slug', 'm.end')
    .innerJoin('bom_places_coords as epc', (join) =>
      join.onRef('epc.guid', '=', 'ep.guid').on('epc.map', '=', INTERNAL_MAP),
    )
    .select([
      's.slug as storySlug', 's.title as storyTitle', 's.description as storyDescription',
      'm.guid as moveGuid', 'm.seq', 'm.start', 'm.end', 'm.travelers',
      'm.description as moveDescription', 'm.duration', 'm.ref',
      'sp.name as startName', 'ep.name as endName',
      'spc.lat as startLat', 'spc.lng as startLng',
      'epc.lat as endLat', 'epc.lng as endLng',
    ])
    .where('s.guid', '=', guid)
    .orderBy('m.seq', 'asc')
    .execute();
  if (rows.length < 2) return null;
  const first = rows[0]!;
  // Travelers via the existing batched loader (bom_map_move_people → bom_people).
  // 234 of 238 moves have rows; the rest legitimately yield [] and the tile
  // renders a card with no avatars rather than failing.
  const people = await ctx.loaders.peopleByMoveGuid.loadMany(rows.map((r) => String(r.moveGuid)));
  return {
    slug: first.storySlug,
    title: first.storyTitle,
    description: first.storyDescription ?? null,
    moves: rows.map((r, i) => {
      const p = people[i];
      return {
        seq: Number(r.seq),
        start: r.start,
        end: r.end,
        startName: r.startName ?? null,
        endName: r.endName ?? null,
        travelers: r.travelers ?? null,
        // loadMany surfaces per-key errors as Error instances — never throw the
        // whole tile away because one move's travelers failed to load.
        people: Array.isArray(p) ? p.map((x) => ({ slug: x.slug, name: x.name })) : [],
        description: r.moveDescription ?? null,
        duration: r.duration ?? null,
        ref: r.ref ?? null,
        startLat: Number(r.startLat),
        startLng: Number(r.startLng),
        endLat: Number(r.endLat),
        endLng: Number(r.endLng),
      };
    }),
  };
};

const countRows = (table: 'bom_people' | 'bom_places') => async (ctx: AppContext) => {
  const r = await ctx.db
    .selectFrom(table)
    .select(({ fn }) => fn.countAll<number>().as('n'))
    .executeTakeFirst();
  return Number(r?.n ?? 0);
};

// Variety rule shared by commentaries + notes: distinct source AND distinct
// author, non-overlapping verse spans; first n that qualify from a seeded pool.
type VariedRow = {
  source: string | null;
  _author: string | null;
  verse_id: number | null;
  verse_range: number | null;
};
function pickVaried<T extends VariedRow>(rows: T[], n: number): T[] {
  const spanOf = (r: T) => {
    const start = Number(r.verse_id) || 0;
    return [start, start + Math.max(1, Number(r.verse_range) || 1) - 1] as const;
  };
  const picked: T[] = [];
  for (const r of rows) {
    if (picked.length === n) break;
    if (picked.some((p) => p.source === r.source || (p._author && p._author === r._author))) continue;
    const [s1, e1] = spanOf(r);
    if (picked.some((p) => { const [s2, e2] = spanOf(p); return s1 <= e2 && s2 <= e1; })) continue;
    picked.push(r);
  }
  return picked;
}

// Three commentaries per page, guaranteed VARIETY: distinct sources and
// non-overlapping passages (seeded pool of 30, first 3 that qualify).
// ROBUSTNESS: filter on CHAR_LENGTH(text) — the exact measure the test asserts
// (text.length > 500) — rather than the stored `length` column. Sources are
// restricted to the request language and to G-rated publications (R-rated
// sources exist for the research views, not the front door).
// ctx.lang mirrors the endpoint path (/en, /fr…); non-language paths like
// /graphql or /dev must not silently filter out every source.
const sampleCommentaries = async (ctx: AppContext, seed: number) => {
  const lang = !ctx.lang || !/^[a-z]{2,3}$/.test(ctx.lang) || ctx.lang === 'dev' ? 'en' : ctx.lang;
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .innerJoin('bom_xtras_source', 'bom_xtras_source.source_id', 'bom_xtras_commentary.source')
    .selectAll('bom_xtras_commentary')
    // one author can publish under several source_ids (e.g. Royal Skousen) —
    // variety means distinct AUTHORS, so carry source_name into the dedupe
    .select('bom_xtras_source.source_name as _author')
    .where(sql<boolean>`CHAR_LENGTH(bom_xtras_commentary.text) > ${MIN_COMMENTARY_CHARS}`)
    // Use != 1 (not = 0) so MySQL skips the is_note index and keeps the fast
    // hash-join plan; `= 0` triggers an index scan on 24 k rows, making this
    // query ~20× slower. is_note ∈ {-1, 0, 1} so `!= 1` still correctly
    // excludes all notes while preserving the original join performance.
    .where('bom_xtras_commentary.is_note', '!=', 1)
    .where('bom_xtras_source.source_lang', '=', lang)
    .where('bom_xtras_source.source_rating', '=', 'G')
    .orderBy(seededOrder('bom_xtras_commentary.id', seed))
    .limit(30)
    .execute();
  return pickVaried(rows, 3);
};

const sampleCommentary = async (ctx: AppContext, seed: number) =>
  (await sampleCommentaries(ctx, seed))[0] ?? null;

// Short scholarly annotations — the is_note=1 rows the commentary sampler
// EXCLUDES. Same source-rating/lang gates and variety rule; notes are short
// (avg 133 chars) so the tile stacks two. Reuses the Commentary GraphQL type
// (reference/publication/preview resolvers all apply).
const sampleNotes = async (ctx: AppContext, seed: number) => {
  const lang = !ctx.lang || !/^[a-z]{2,3}$/.test(ctx.lang) || ctx.lang === 'dev' ? 'en' : ctx.lang;
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .innerJoin('bom_xtras_source', 'bom_xtras_source.source_id', 'bom_xtras_commentary.source')
    .selectAll('bom_xtras_commentary')
    .select('bom_xtras_source.source_name as _author')
    // `is_note + 0 = 1` (arithmetic on the column), not `is_note = 1`: a bare
    // equality makes MySQL choose the is_note index and scan+MD5-sort all 7.7k
    // note rows (~1.6s per request); the arithmetic suppresses index use and
    // keeps the fast source hash-join plan (~115ms) — same trick the commentary
    // sampler relies on with `!= 1`. Measured 13× faster.
    .where(sql<boolean>`bom_xtras_commentary.is_note + 0 = 1`)
    .where(sql<boolean>`CHAR_LENGTH(bom_xtras_commentary.text) > 40`)
    .where('bom_xtras_source.source_lang', '=', lang)
    .where('bom_xtras_source.source_rating', '=', 'G')
    .orderBy(seededOrder('bom_xtras_commentary.id', seed))
    .limit(10)
    .execute();
  return pickVaried(rows, 2);
};

const sampleContents = async (ctx: AppContext, seed: number) => {
  const divisions = await ctx.services.contents.divisions(null);
  return divisions.length ? divisions[seed % divisions.length] : null;
};

// One random section, served as a Section parent — the existing Section field
// resolvers (slug, rows→narration) do the rest. Powers the narration tile.
const sampleSection = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_section')
    .selectAll()
    .where('title', 'is not', null)
    .orderBy(seededOrder('guid', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

// The sampled section's next sibling (same page, next weight) — the narration
// tile appends it when the first section leaves room.
const sampleSectionNext = async (ctx: AppContext, seed: number) => {
  const current = (await sampleSection(ctx, seed)) as { parent: string | null; weight: number | null } | null;
  if (!current?.parent || current.weight == null) return null;
  const rows = await ctx.db
    .selectFrom('bom_section')
    .selectAll()
    .where('parent', '=', current.parent)
    .where('weight', '>', current.weight)
    .orderBy('weight', 'asc')
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

// One featured historical document from an archive: a teaser + an editorially
// prepared money quote (same bar as the witness tile). requireThumb gates on a
// renderable thumbnail (reception/translation have them; joseph-smith does not).
// The quote fields are parsed from metadata onto the row so the
// HistoricalDocument resolvers see them.
const sampleArchiveDoc =
  (archive: string, requireThumb: boolean) =>
  async (ctx: AppContext, seed: number) => {
    let qb = ctx.db
      .selectFrom('bom_xtras_history')
      .selectAll()
      .where('archive', '=', archive)
      .where(sql<boolean>`teaser IS NOT NULL AND CHAR_LENGTH(teaser) > 30`)
      .where(sql<boolean>`JSON_EXTRACT(metadata,'$.money_quote') IS NOT NULL`);
    if (requireThumb) qb = qb.where('aspect', 'is not', null);
    const rows = await qb.orderBy(seededOrder('id', seed)).limit(1).execute();
    const row = rows[0];
    if (!row) return null;
    let money_quote: string | null = null;
    let mini_quote: string | null = null;
    let quote_speaker: string | null = null;
    let quote_is_witness_voice: boolean | null = null;
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata as Record<string, unknown> | null);
      money_quote = (meta?.money_quote as string) ?? null;
      mini_quote = (meta?.miniquote as string) ?? null;
      quote_speaker = (meta?.quote_speaker as string) ?? null;
      quote_is_witness_voice = (meta?.quote_is_witness_voice as boolean) ?? null;
    } catch { /* metadata may be absent/invalid */ }
    return { ...row, money_quote, mini_quote, quote_speaker, quote_is_witness_voice };
  };

// Pinned to reception: the /history/:slug view only loads that archive.
// translation and joseph-smith-statements archives have no thumbnails in the DB,
// so requireThumb is false for both.
const sampleHistory = sampleArchiveDoc('reception', true);
const sampleTranslation = sampleArchiveDoc('translation', false);
const sampleJosephSmith = sampleArchiveDoc('joseph-smith-statements', false);

// One full text block (scripture + narration + page/section context — the
// feed's TextInFeed shape). Substantive content only.
const sampleText = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_text')
    .selectAll()
    .where('heading', 'is not', null)
    .where(sql<boolean>`CHAR_LENGTH(content) > 300`)
    .orderBy(seededOrder('guid', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

const samplers: Record<string, (ctx: AppContext, seed: number) => Promise<unknown>> = {
  people: samplePeople,
  places: samplePlaces,
  fax: sampleFax,
  commentary: sampleCommentary,
  commentaries: sampleCommentaries,
  notes: sampleNotes,
  contents: sampleContents,
  section: sampleSection,
  sectionNext: sampleSectionNext,
  history: sampleHistory,
  translation: sampleTranslation,
  josephSmith: sampleJosephSmith,
  text: sampleText,
  faxPages: sampleFaxPages,
  faxMore: sampleFaxMore,
  faxVerse: sampleFaxVerse,
  crossrefs: sampleCrossRefs,
  relationship: sampleRelationship,
  mapstory: sampleMapStory,
  art: sampleArt,
  witnesses: sampleWitnesses,
  peopleCount: countRows('bom_people'),
  placesCount: countRows('bom_places'),
};

// The current user's most recent bookmark (recent reading position). Users can
// have several messenger_users rows; pick the bookmark with the max timestamp.
const myBookmark = async (ctx: AppContext, token: string | null) => {
  if (!token) return null;
  const user = await findUserByToken(ctx.db, token);
  if (!user?.user) return null;
  const rows = await ctx.db
    .selectFrom('messenger_users')
    .select('metadata')
    .where('bom_user_id', '=', user.user)
    .execute();
  let best: { slug?: string; pagetitle?: string; heading?: string; latest?: number } | null = null;
  for (const row of rows) {
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata as Record<string, unknown> | null);
      const rawBm = meta?.['bookmark'];
      const bm = typeof rawBm === 'string' ? JSON.parse(rawBm) : rawBm;
      if (bm?.slug && (!best || (bm.latest || 0) > (best.latest || 0))) best = bm;
    } catch { /* skip malformed */ }
  }
  if (!best?.slug) return null;
  return {
    slug: best.slug,
    // page slug for progress/section lookup: strip a trailing "/<textIndex>"
    pageSlug: String(best.slug).replace(/\/\d+$/, ''),
    pagetitle: best.pagetitle ?? null,
    heading: best.heading ?? null,
    latest: best.latest ?? null,
  };
};

// Normalize a request language the same way the samplers do (sampleCommentaries /
// sampleNotes filter on source_lang). The cache key MUST use this so two paths
// that both fall back to 'en' share one cached window.
const normalizeLang = (lang: string | null | undefined): string =>
  !lang || !/^[a-z]{2,3}$/.test(lang) || lang === 'dev' ? 'en' : lang;

// Run every sampler under one seed and assemble the payload. This is the
// expensive body (~25 seeded queries) the cache exists to memoize.
const computeSampler = async (ctx: AppContext, seed: number) => {
  const entries = await Promise.all(
    Object.entries(samplers).map(async ([key, fn]) => {
      try {
        return [key, await fn(ctx, seed)] as const;
      } catch (error) {
        console.error(`homesampler ${key} error:`, error);
        return [key, null] as const;
      }
    }),
  );
  return { seed, ...Object.fromEntries(entries) };
};

export const homesamplerResolvers: Resolvers = {
  Query: {
    mybookmark: async (_root, args, ctx: AppContext) => myBookmark(ctx, (args.token ?? null) as string | null) as never,
    homesampler: async (_root, args, ctx: AppContext) => {
      const argSeed = args.seed as number | null | undefined;
      const hasSeed = typeof argSeed === 'number' && Number.isInteger(argSeed) && argSeed > 0;
      const lang = normalizeLang(ctx.lang);

      // Front-door (no seed) → the shared, deterministic window seed so every
      // visitor gets one cacheable homepage that cycles as 6h buckets advance.
      // Explicit seed (manual refresh / infinite-scroll batch) → that seed;
      // deterministic batch seeds share a cache entry, random refresh seeds miss
      // and are later evicted.
      const bucket = currentBucket(Date.now());
      const seed = hasSeed ? (argSeed as number) : seedForBucket(bucket);
      const key = hasSeed
        ? `homesampler:v1:${lang}:seed:${seed}`
        : `homesampler:v1:${lang}:${bucket}`;

      // A cache fault must never fail the request — fall back to a fresh compute.
      try {
        return (await getHomeSamplerCache().getOrCompute(key, () =>
          computeSampler(ctx, seed),
        )) as never;
      } catch {
        return (await computeSampler(ctx, seed)) as never;
      }
    },
  },
};
