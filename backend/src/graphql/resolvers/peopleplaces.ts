/** peopleplaces domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { generateReference } from 'scripture-guide';
import type { PeopleRow, PlaceFullRow, IndexRow, RelationResult, MapRow } from '../../data/loaders/peopleplaces.js';

/** getSlugTip: incoming slug args may be paths — take the last segment. */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

/** Resolve translated value via core translation loader. */
const translated = async (ctx: AppContext, guid: string, refkey: string, base: string | null): Promise<string | null> =>
  (await ctx.loaders.translation.load({ guid, refkey })) ?? base;

export const peopleplacesResolvers: Resolvers = {
  Query: {
    /**
     * person / personList (alias) — fetch bom_people by slug(s).
     * Returns array ordered by bom_people.weight ASC (legacy ORDER BY weight).
     */
    person: async (_root, args, ctx) => {
      const slugs = (args.slug ?? [])
        .filter((s): s is string => s !== null)
        .map(getSlugTip);
      if (!slugs.length) return [];
      return ctx.loaders.peopleBySlugs(slugs) as unknown as never[];
    },

    /**
     * place / placeList (alias) — fetch bom_places by slug(s).
     * Returns array ordered by bom_places.weight ASC.
     */
    place: async (_root, args, ctx) => {
      const slugs = (args.slug ?? [])
        .filter((s): s is string => s !== null)
        .map(getSlugTip);
      if (!slugs.length) return [];
      return ctx.loaders.placesBySlugs(slugs) as unknown as never[];
    },
  },

  People: {
    /**
     * name/title/description — bom_people translates by SLUG (PK is slug,
     * not guid; legacy hasMany(BomTranslation, {foreignKey:'guid'}) defaulted to PK).
     */
    name: (parent, _args, ctx) => {
      const p = parent as unknown as PeopleRow;
      return translated(ctx, p.slug, 'name', p.name);
    },
    title: (parent, _args, ctx) => {
      const p = parent as unknown as PeopleRow;
      return translated(ctx, p.slug, 'title', p.title);
    },
    description: (parent, _args, ctx) => {
      const p = parent as unknown as PeopleRow;
      return translated(ctx, p.slug, 'description', p.description);
    },

    /**
     * relations — src rels first, then dst rels; each filtered to non-empty rel keys.
     * Labels fetched per-request (not module-level cache).
     */
    relations: async (parent, _args, ctx) => {
      const p = parent as unknown as PeopleRow;
      const results: RelationResult[] = await ctx.loaders.relationsBySlug.load(p.slug);
      if (!results.length) return [];
      // Resolve person rows for each relation
      const personSlugs = results.map((r) => r.personSlug);
      const personRows = await Promise.all(personSlugs.map((s) => ctx.loaders.peopleBySlug.load(s)));
      const relationsWithPeople: { relation: string; person: PeopleRow }[] = [];
      for (let i = 0; i < results.length; i++) {
        const person = personRows[i];
        const result = results[i];
        if (!person || !result) continue;
        relationsWithPeople.push({
          relation: result.relation,
          person,
        });
      }
      return relationsWithPeople as unknown as never[];
    },

    /**
     * index — bom_index rows for this person (type='people'), sorted by verse_id.
     */
    index: async (parent, _args, ctx) => {
      const p = parent as unknown as PeopleRow;
      const rows = await ctx.loaders.indexBySlug.load({ slug: p.slug, type: 'people' });
      return rows as unknown as never[];
    },
  },

  Place: {
    /**
     * name/info — bom_places translates by GUID (PK is guid).
     */
    name: (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      return p.guid ? translated(ctx, p.guid, 'name', p.name) : (p.name ?? null);
    },
    info: (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      return p.guid ? translated(ctx, p.guid, 'info', p.info) : (p.info ?? null);
    },
    label: (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      return p.guid ? translated(ctx, p.guid, 'label', p.label ?? null) : (p.label ?? null);
    },
    description: (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      return p.guid ? translated(ctx, p.guid, 'description', p.description) : (p.description ?? null);
    },

    /**
     * maps — bom_places_coords join to bom_map, ordered by map.priority.
     */
    maps: async (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      if (!p.guid) return [];
      const maps: MapRow[] = await ctx.loaders.mapsByPlaceGuid.load(p.guid);
      return maps as unknown as never[];
    },

    /**
     * index — bom_index rows for this place (type='place'), sorted by verse_id.
     */
    index: async (parent, _args, ctx) => {
      const p = parent as unknown as PlaceFullRow;
      const rows = await ctx.loaders.indexBySlug.load({ slug: p.slug, type: 'place' });
      return rows as unknown as never[];
    },
  },

  /**
   * Map type — name translation by guid.
   * The MapRow carries guid from the mapsByPlaceGuid loader.
   */
  Map: {
    name: async (parent, _args, ctx) => {
      const m = parent as unknown as MapRow;
      if (!m.guid) return m.name ?? null;
      return translated(ctx, m.guid, 'name', m.name ?? null);
    },
  },

  Index: {
    /**
     * slug — resolves via: bom_index.verse_id → bom_lookup.text_guid → bom_text.page + link
     *         → slugPathByLink(page) + '/' + link
     * Falls back to 'contents' if the chain is broken (null-safe per legacy).
     */
    slug: async (parent, _args, ctx) => {
      const idx = parent as unknown as IndexRow;
      const textGuid = await ctx.loaders.lookupTextGuidByVerseId.load(idx.verse_id);
      if (!textGuid) return 'contents';
      const textRow = await ctx.loaders.textPageLinkByGuid.load(textGuid);
      if (!textRow || !textRow.page) return 'contents';
      const pagePath = await ctx.loaders.slugPathByLink.load(textRow.page);
      if (!pagePath) return 'contents';
      return `${pagePath}/${textRow.link}`;
    },

    /**
     * ref — verse_id..verse_id_end range → generateReference(lang).
     * Uses per-call lang from ctx (never global state).
     */
    ref: (parent, _args, ctx) => {
      const idx = parent as unknown as IndexRow;
      const lang = (ctx.lang ?? 'en') as Parameters<typeof generateReference>[1];
      const from = parseInt(idx.verse_id, 10);
      const to = parseInt(idx.verse_id_end, 10);
      const range = [...new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i))];
      return generateReference(range, lang);
    },

    /**
     * text — translated by bom_index.guid, refkey='text', base=bom_index.text.
     */
    text: async (parent, _args, ctx) => {
      const idx = parent as unknown as IndexRow;
      if (!idx.guid) return idx.text ?? null;
      return translated(ctx, idx.guid, 'text', idx.text ?? null);
    },
  },
};
