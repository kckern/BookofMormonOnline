/** maps domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { lookupReference } from 'scripture-guide';
import type { MapFullRow, MapPlaceRow, MapStoryRow, MapMoveRow, MovePersonRow } from '../../data/loaders/maps.js';

// ── helpers ────────────────────────────────────────────────────────────────────

const translated = async (
  ctx: AppContext,
  guid: string,
  refkey: string,
  base: string | null,
): Promise<string | null> => (await ctx.loaders.translation.load({ guid, refkey })) ?? base;

/** getSlugTip: incoming slug args may be paths — take the last segment. */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

// ── resolvers ──────────────────────────────────────────────────────────────────

export const mapsResolvers: Resolvers = {
  Query: {
    /**
     * maps(slug?: [String]): [Map]
     *
     * maplist: called with no slug arg → returns all maps ordered by priority.
     * map: called with slug arg → returns matching maps ordered by priority,
     *   with places available as a nested field resolver.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maps: async (_root, args, ctx: AppContext): Promise<any> => {
      if (args.slug && args.slug.length > 0 && args.slug.some((s) => s !== null)) {
        const slugs = (args.slug as (string | null)[])
          .filter((s): s is string => s !== null)
          .map(getSlugTip);
        return ctx.loaders.mapBySlugs(slugs);
      }
      return ctx.loaders.allMaps.load('all');
    },

    /**
     * mapstories(map: [String]!): [MapStory]
     *
     * Returns stories whose moves have both startPlace and endPlace with coordinates
     * for the given map slug. Moves without both coords are excluded (INNER JOIN).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapstories: async (_root, args, ctx: AppContext): Promise<any> => {
      const mapSlugs = (args.map as (string | null)[])
        .filter((s): s is string => s !== null)
        .map(getSlugTip);
      if (!mapSlugs.length) return [];
      // Legacy uses a single map slug — take the first.
      const mapSlug = mapSlugs[0] as string;
      const groups = await ctx.loaders.storiesByMapSlug(mapSlug);
      return groups
        .filter((g) => g.moves.length > 0)
        .map((g) => ({ ...g.story, _moves: g.moves }));
    },
  },

  // ── Map field resolvers ─────────────────────────────────────────────────────

  Map: {
    slug: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.slug ?? null;
    },
    name: async (parent, _args, ctx: AppContext) => {
      const m = parent as unknown as MapFullRow;
      return translated(ctx, m.guid, 'name', m.name);
    },
    desc: async (parent, _args, ctx: AppContext) => {
      const m = parent as unknown as MapFullRow;
      return translated(ctx, m.guid, 'desc', m.desc);
    },
    group: (parent) => {
      const m = parent as unknown as MapFullRow;
      // Legacy: empty string group → null (stripped by null-strip compat)
      return m.group || null;
    },
    centerx: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.centerx ?? null;
    },
    centery: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.centery ?? null;
    },
    minzoom: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.minzoom ?? null;
    },
    maxzoom: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.maxzoom ?? null;
    },
    zoom: (parent) => {
      const m = parent as unknown as MapFullRow;
      return m.zoom ?? null;
    },
    tiles: (parent) => {
      const m = parent as unknown as MapFullRow;
      // DB stores as tinyint 0/1; coerce to boolean
      return m.tiles ? true : null;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    places: async (parent, _args, ctx: AppContext): Promise<any> => {
      const m = parent as unknown as MapFullRow;
      return ctx.loaders.placesByMapSlug.load(m.slug);
    },
  },

  // ── MapStory field resolvers ────────────────────────────────────────────────

  MapStory: {
    slug: (parent) => {
      const s = parent as unknown as MapStoryRow & { _moves: MapMoveRow[] };
      return s.slug ?? null;
    },
    guid: (parent) => {
      const s = parent as unknown as MapStoryRow & { _moves: MapMoveRow[] };
      return s.guid ?? null;
    },
    title: async (parent, _args, ctx: AppContext) => {
      const s = parent as unknown as MapStoryRow & { _moves: MapMoveRow[] };
      return translated(ctx, s.guid, 'title', s.title);
    },
    description: async (parent, _args, ctx: AppContext) => {
      const s = parent as unknown as MapStoryRow & { _moves: MapMoveRow[] };
      return translated(ctx, s.guid, 'description', s.description);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moves: (parent): any => {
      const s = parent as unknown as MapStoryRow & { _moves: MapMoveRow[] };
      return (s._moves ?? []).map((m) => ({ ...m }));
    },
  },

  // ── MapMove field resolvers ─────────────────────────────────────────────────

  MapMove: {
    guid: (parent) => {
      return (parent as unknown as MapMoveRow).guid ?? null;
    },
    seq: (parent) => {
      return (parent as unknown as MapMoveRow).seq ?? null;
    },
    start: (parent) => {
      return (parent as unknown as MapMoveRow).start ?? null;
    },
    end: (parent) => {
      return (parent as unknown as MapMoveRow).end ?? null;
    },
    duration: (parent) => {
      return (parent as unknown as MapMoveRow).duration ?? null;
    },
    travelers: async (parent, _args, ctx: AppContext) => {
      const m = parent as unknown as MapMoveRow;
      return translated(ctx, m.guid, 'travelers', m.travelers);
    },
    description: async (parent, _args, ctx: AppContext) => {
      const m = parent as unknown as MapMoveRow;
      return translated(ctx, m.guid, 'description', m.description);
    },
    verse_ids: (parent) => {
      const m = parent as unknown as MapMoveRow;
      if (!m.ref) return null;
      const result = lookupReference(m.ref);
      if (!result || !Array.isArray(result.verse_ids)) return null;
      return result.verse_ids;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    people: async (parent, _args, ctx: AppContext): Promise<any> => {
      const m = parent as unknown as MapMoveRow;
      return ctx.loaders.peopleByMoveGuid.load(m.guid);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startPlace: (parent): any => {
      const m = parent as unknown as MapMoveRow;
      return {
        guid: m.startPlaceGuid,
        slug: m.start,
        lat: m.startPlaceLat,
        lng: m.startPlaceLng,
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    endPlace: (parent): any => {
      const m = parent as unknown as MapMoveRow;
      return {
        guid: m.endPlaceGuid,
        slug: m.end,
        lat: m.endPlaceLat,
        lng: m.endPlaceLng,
      };
    },
  },

  // ── Place field resolvers (maps domain: coordinate + appearance fields) ─────
  //
  // Place.lat/lng/minZoom/maxZoom come from the coords join — not the base row.
  // Place.name/info/label also handle the map-context places.
  // Place.name and Place.info are handled in core resolvers.ts and peopleplaces.ts;
  // they merge shallowly so we override here for the maps context where the parent
  // is a MapPlaceRow (which always has guid) — the core already handles this case.
  //
  // We do need to add lat/lng/minZoom/maxZoom and h/w/ax/ay/icon.

  Place: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lat: (parent): any => {
      const p = parent as unknown as Partial<MapPlaceRow> & { lat?: string | number | null };
      if (p.lat === undefined || p.lat === null) return null;
      return Number(p.lat);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lng: (parent): any => {
      const p = parent as unknown as Partial<MapPlaceRow> & { lng?: string | number | null };
      if (p.lng === undefined || p.lng === null) return null;
      return Number(p.lng);
    },
    minZoom: (parent) => {
      const p = parent as unknown as Partial<MapPlaceRow> & { min?: number | null };
      return p.min ?? null;
    },
    maxZoom: (parent) => {
      const p = parent as unknown as Partial<MapPlaceRow> & { max?: number | null };
      return p.max ?? null;
    },
    icon: (parent) => {
      return (parent as unknown as Partial<MapPlaceRow>).icon ?? null;
    },
    h: (parent) => {
      return (parent as unknown as Partial<MapPlaceRow>).h ?? null;
    },
    w: (parent) => {
      return (parent as unknown as Partial<MapPlaceRow>).w ?? null;
    },
    ax: (parent) => {
      return (parent as unknown as Partial<MapPlaceRow>).ax ?? null;
    },
    ay: (parent) => {
      return (parent as unknown as Partial<MapPlaceRow>).ay ?? null;
    },
    // Override name/info/label for map-context places (MapPlaceRow has guid always).
    // The core and peopleplaces resolvers handle these too, but they merge shallowly
    // so the last-registered wins. Since mergeResolverMaps spreads left-to-right and
    // mapsResolvers is merged after peopleplacesResolvers, these take precedence.
    name: async (parent, _args, ctx: AppContext) => {
      const p = parent as unknown as Partial<MapPlaceRow> & { guid?: string | null; name?: string | null };
      if (!p.guid) return p.name ?? null;
      return translated(ctx, p.guid, 'name', p.name ?? null);
    },
    info: async (parent, _args, ctx: AppContext) => {
      const p = parent as unknown as Partial<MapPlaceRow> & { guid?: string | null; info?: string | null };
      if (!p.guid) return p.info ?? null;
      return translated(ctx, p.guid, 'info', p.info ?? null);
    },
    label: async (parent, _args, ctx: AppContext) => {
      const p = parent as unknown as Partial<MapPlaceRow> & { guid?: string | null; label?: string | null };
      if (!p.guid) return p.label ?? null;
      return translated(ctx, p.guid, 'label', p.label ?? null);
    },
  },

  // ── People field resolvers (maps domain: move people) ──────────────────────
  // People.name is already handled in core and peopleplaces resolvers by slug.
  // MovePersonRow carries {slug, name} — same pattern.
  People: {
    name: async (parent, _args, ctx: AppContext) => {
      const p = parent as unknown as MovePersonRow;
      return translated(ctx, p.slug, 'name', p.name ?? null);
    },
  },
};
