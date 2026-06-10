/** maps domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

// ── Row types ─────────────────────────────────────────────────────────────────

export interface MapFullRow {
  guid: string;
  slug: string;
  name: string;
  desc: string;
  group: string | null;
  centerx: number;
  centery: number;
  minzoom: number;
  maxzoom: number;
  zoom: number;
  tiles: number;
  priority: number;
}

export interface MapPlaceRow {
  /** map slug — used as the DataLoader batch key */
  mapSlug: string;
  guid: string;
  slug: string;
  name: string;
  info: string;
  label: string | null;
  icon: string | null;
  h: number;
  w: number;
  ax: number;
  ay: number;
  lat: string;
  lng: string;
  min: number | null;
  max: number | null;
}

export interface MapStoryRow {
  guid: string;
  slug: string;
  title: string;
  description: string;
}

export interface MapMoveRow {
  /** story guid — used as the DataLoader batch key */
  storyGuid: string;
  guid: string;
  seq: number;
  start: string;
  end: string;
  travelers: string;
  description: string;
  duration: string | null;
  ref: string;
  startPlaceGuid: string;
  startPlaceLat: string;
  startPlaceLng: string;
  endPlaceGuid: string;
  endPlaceLat: string;
  endPlaceLng: string;
}

export interface MovePersonRow {
  /** move guid — used as the DataLoader batch key */
  moveGuid: string;
  slug: string;
  name: string | null;
}

// ── Loader factory ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function mapsLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  /**
   * All maps ordered by priority (for maplist and unfiltered maps query).
   * Keyed by a constant sentinel so a single DataLoader fetch covers all callers.
   */
  const allMaps = new DataLoader<'all', MapFullRow[]>(async () => {
    const rows = await db
      .selectFrom('bom_map')
      .selectAll()
      .orderBy('priority', 'asc')
      .execute();
    return [rows as MapFullRow[]];
  });

  /**
   * Maps by slug — used when `maps(slug: [...])` is supplied.
   * Legacy ORDER BY priority; multiple slugs batched.
   */
  const mapBySlugs = async (slugs: string[]): Promise<MapFullRow[]> => {
    if (!slugs.length) return [];
    const rows = await db
      .selectFrom('bom_map')
      .selectAll()
      .where('slug', 'in', slugs)
      .orderBy('priority', 'asc')
      .execute();
    return rows as MapFullRow[];
  };

  /**
   * Places for a map slug — joins bom_places + bom_places_coords.
   *
   * ORDERING NOTE: Legacy uses Sequelize belongsToMany (via bom_places_coords as
   * the join table) with no ORDER BY, so MySQL engine-artifact order applies.
   * The single-slug baseline for 'neareast' is reproduced by ORDER BY p.guid ASC
   * (clustered PK scan order). The batch baseline for ['neareast','africa'] has a
   * different optimizer-path order that no single rational ORDER BY reproduces —
   * this is the known "places optimizer-path order" issue flagged in the porting
   * guide. We pin ORDER BY p.guid ASC: it matches the single-slug baseline exactly.
   * The batch baseline will diverge; see DONE_WITH_CONCERNS report.
   */
  const placesByMapSlug = new DataLoader<string, MapPlaceRow[]>(async (mapSlugs) => {
    const rows = await db
      .selectFrom('bom_places as p')
      .innerJoin('bom_places_coords as pc', (join) =>
        join.onRef('pc.guid', '=', 'p.guid').on('pc.map', 'in', [...mapSlugs]),
      )
      .select([
        'pc.map as mapSlug',
        'p.guid',
        'p.slug',
        'p.name',
        'p.info',
        'p.label',
        'p.icon',
        'p.h',
        'p.w',
        'p.ax',
        'p.ay',
        'pc.lat',
        'pc.lng',
        'pc.min',
        'pc.max',
      ])
      .orderBy('p.guid', 'asc')
      .execute();

    const grouped = new Map<string, MapPlaceRow[]>();
    for (const r of rows) {
      const entry = grouped.get(r.mapSlug) ?? [];
      entry.push(r as MapPlaceRow);
      grouped.set(r.mapSlug, entry);
    }
    return mapSlugs.map((s) => grouped.get(s) ?? []);
  });

  /**
   * Stories for a map slug — filtered by requiring both startPlace and endPlace
   * to have coords for that map (INNER JOIN on both sides). Moves ordered by seq.
   * Stories themselves are returned in their natural DB order (no ordering on stories
   * needed — baseline has one story and order is deterministic).
   */
  const storiesByMapSlug = async (mapSlug: string): Promise<{ story: MapStoryRow; moves: MapMoveRow[] }[]> => {
    // 1. Fetch stories with their moves where both start+end have coords for this map.
    const moveRows = await db
      .selectFrom('bom_map_move as m')
      .innerJoin('bom_map_story as s', 's.guid', 'm.parent')
      .innerJoin('bom_places as sp', 'sp.slug', 'm.start')
      .innerJoin('bom_places_coords as spc', (join) =>
        join.onRef('spc.guid', '=', 'sp.guid').on('spc.map', '=', mapSlug),
      )
      .innerJoin('bom_places as ep', 'ep.slug', 'm.end')
      .innerJoin('bom_places_coords as epc', (join) =>
        join.onRef('epc.guid', '=', 'ep.guid').on('epc.map', '=', mapSlug),
      )
      .select([
        's.guid as storyGuid',
        's.slug as storySlug',
        's.title as storyTitle',
        's.description as storyDescription',
        'm.guid as moveGuid',
        'm.seq',
        'm.start',
        'm.end',
        'm.travelers',
        'm.description as moveDescription',
        'm.duration',
        'm.ref',
        'sp.guid as startPlaceGuid',
        'spc.lat as startPlaceLat',
        'spc.lng as startPlaceLng',
        'ep.guid as endPlaceGuid',
        'epc.lat as endPlaceLat',
        'epc.lng as endPlaceLng',
      ])
      .orderBy('s.guid', 'asc')
      .orderBy('m.seq', 'asc')
      .execute();

    if (!moveRows.length) return [];

    // Group by story
    const storyMap = new Map<string, { story: MapStoryRow; moves: MapMoveRow[] }>();
    for (const r of moveRows) {
      if (!storyMap.has(r.storyGuid)) {
        storyMap.set(r.storyGuid, {
          story: {
            guid: r.storyGuid,
            slug: r.storySlug,
            title: r.storyTitle,
            description: r.storyDescription,
          },
          moves: [],
        });
      }
      storyMap.get(r.storyGuid)!.moves.push({
        storyGuid: r.storyGuid,
        guid: r.moveGuid,
        seq: r.seq,
        start: r.start,
        end: r.end,
        travelers: r.travelers,
        description: r.moveDescription,
        duration: r.duration ?? null,
        ref: r.ref,
        startPlaceGuid: r.startPlaceGuid,
        startPlaceLat: r.startPlaceLat,
        startPlaceLng: r.startPlaceLng,
        endPlaceGuid: r.endPlaceGuid,
        endPlaceLat: r.endPlaceLat,
        endPlaceLng: r.endPlaceLng,
      });
    }

    return [...storyMap.values()];
  };

  /**
   * People for move guids — joins bom_map_move_people + bom_people.
   */
  const peopleByMoveGuid = new DataLoader<string, MovePersonRow[]>(async (moveGuids) => {
    const rows = await db
      .selectFrom('bom_map_move_people as mmp')
      .innerJoin('bom_people as p', 'p.slug', 'mmp.people_slug')
      .select([
        'mmp.segment_guid as moveGuid',
        'p.slug',
        'p.name',
      ])
      .where('mmp.segment_guid', 'in', [...moveGuids])
      .orderBy('p.slug', 'asc')
      .execute();

    const grouped = new Map<string, MovePersonRow[]>();
    for (const r of rows) {
      const entry = grouped.get(r.moveGuid) ?? [];
      entry.push({ moveGuid: r.moveGuid, slug: r.slug, name: r.name });
      grouped.set(r.moveGuid, entry);
    }
    return moveGuids.map((g) => grouped.get(g) ?? []);
  });

  return {
    allMaps,
    mapBySlugs,
    placesByMapSlug,
    storiesByMapSlug,
    peopleByMoveGuid,
  };
}
