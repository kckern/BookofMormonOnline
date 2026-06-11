/**
 * ported_misc loaders — read-only helpers for the ported "misc" resolvers.
 *
 * Currently exposes getAllMapStories: every row of bom_map_story together with
 * its ordered moves (bom_map_move), shaped to match the existing maps-domain
 * MapStoryRow / MapMoveRow contracts so the MapStory + MapMove field resolvers
 * in src/graphql/resolvers/maps.ts (translations, nested startPlace/endPlace/
 * people/verse_ids) handle the leaf fields with no duplication.
 *
 * Pure function over a Kysely<DB> handle — read-only, sandbox-safe.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { MapStoryRow, MapMoveRow } from './maps.js';

/** A story plus its ordered moves, in the shape the maps MapStory resolver expects. */
export type MapStoryWithMoves = MapStoryRow & { _moves: MapMoveRow[] };

/**
 * getAllMapStories — every bom_map_story, each with its moves ordered by seq.
 *
 * The green-field SDL contract for the top-level `mapstory` field is the FULL
 * LIST of map stories (no args), unlike the legacy `mapstory(slug)` findOne in
 * src/resolvers/BomPeoplePlace.ts. Translations for travelers/description (and
 * story title/description) are applied downstream by the MapStory/MapMove field
 * resolvers via ctx.loaders.translation, so this loader returns base values only.
 *
 * Place coords (startPlaceLat/Lng, endPlaceLat/Lng) are NOT scoped to a single
 * map here — the field has no map context — so they are left null. The maps-domain
 * MapMove.startPlace/endPlace resolvers still emit { guid, slug, lat:null, lng:null },
 * which is the correct best-effort for a map-agnostic story list.
 */
export async function getAllMapStories(db: Kysely<DB>): Promise<MapStoryWithMoves[]> {
  const stories = await db
    .selectFrom('bom_map_story')
    .select(['guid', 'slug', 'title', 'description'])
    .orderBy('guid', 'asc')
    .execute();

  if (!stories.length) return [];

  const moveRows = await db
    .selectFrom('bom_map_move')
    .select([
      'parent as storyGuid',
      'guid',
      'seq',
      'start',
      'end',
      'travelers',
      'description',
      'duration',
      'ref',
    ])
    .where(
      'parent',
      'in',
      stories.map((s) => s.guid),
    )
    .orderBy('parent', 'asc')
    .orderBy('seq', 'asc')
    .execute();

  const movesByStory = new Map<string, MapMoveRow[]>();
  for (const r of moveRows) {
    const move: MapMoveRow = {
      storyGuid: r.storyGuid,
      guid: r.guid,
      seq: r.seq,
      start: r.start,
      end: r.end,
      travelers: r.travelers,
      description: r.description,
      duration: r.duration ?? null,
      ref: r.ref,
      // No single-map context for the top-level list → place coords resolve to null.
      startPlaceGuid: '',
      startPlaceLat: '',
      startPlaceLng: '',
      endPlaceGuid: '',
      endPlaceLat: '',
      endPlaceLng: '',
    };
    const list = movesByStory.get(r.storyGuid) ?? [];
    list.push(move);
    movesByStory.set(r.storyGuid, list);
  }

  return stories.map((s) => ({
    guid: s.guid,
    slug: s.slug,
    title: s.title,
    description: s.description,
    _moves: movesByStory.get(s.guid) ?? [],
  }));
}
