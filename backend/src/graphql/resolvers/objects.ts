/** objects domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type { ObjectRow, ObjectIndexRow } from '../../data/loaders/objects.js';
import type { IndexRow } from '../../data/loaders/peopleplaces.js';
import { generateReference } from 'scripture-guide';

/** getSlugTip: incoming slug args may be paths — take the last segment. */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

/** Resolve translated value via core translation loader. */
const translated = async (ctx: AppContext, guid: string, refkey: string, base: string | null): Promise<string | null> =>
  (await ctx.loaders.translation.load({ guid, refkey })) ?? base;

export const objectsResolvers: Resolvers = {
  Query: {
    /**
     * object / objectList (alias) — fetch bom_objects by slug(s).
     * Returns array ordered by bom_objects.weight DESC (legacy ORDER BY weight DESC).
     * objectList is a GQL alias for object (q("objectList: object", ...)) — same resolver.
     */
    object: async (_root, args, ctx) => {
      const slugs = (args.slug ?? [])
        .filter((s): s is string => s !== null)
        .map(getSlugTip);
      if (!slugs.length) return [];
      return ctx.loaders.objectsBySlugs(slugs) as unknown as never[];
    },
  },

  Object: {
    /**
     * name/subtitle/description — translated by BomObjects.guid
     * (legacy: hasMany(BomTranslation, { foreignKey:'guid', sourceKey:'guid' }))
     */
    name: (parent, _args, ctx) => {
      const o = parent as unknown as ObjectRow;
      if (!o.guid) return o.name ?? null;
      return translated(ctx, o.guid, 'name', o.name);
    },
    subtitle: (parent, _args, ctx) => {
      const o = parent as unknown as ObjectRow;
      if (!o.guid) return o.subtitle ?? null;
      return translated(ctx, o.guid, 'subtitle', o.subtitle);
    },
    description: (parent, _args, ctx) => {
      const o = parent as unknown as ObjectRow;
      if (!o.guid) return o.description ?? null;
      return translated(ctx, o.guid, 'description', o.description);
    },

    /**
     * index — bom_index rows for this object (type='object'), joined with bom_lookup.
     *
     * Uses a custom JOIN-based loader (objectIndexBySlug) that replicates legacy
     * Sequelize hasOne JOIN behavior: when multiple bom_lookup rows exist for the
     * same verse_id, legacy produces one result per (bom_index, bom_lookup) pair,
     * each with a different resolved slug path. This loader returns ObjectIndexRow[]
     * with precomputed _resolvedSlug for each pair.
     */
    index: async (parent, _args, ctx) => {
      const o = parent as unknown as ObjectRow;
      const rows = await ctx.loaders.objectIndexBySlug.load(o.slug);
      return rows as unknown as never[];
    },

    /**
     * xrels — cross-entity relations from bom_xrels.
     * Resolves dst_name/dst_title from bom_people/bom_places/bom_objects.
     * Sorted: verse_id ASC NULLS LAST, srcweight ASC, dst_slug ASC.
     */
    xrels: async (parent, _args, ctx) => {
      const o = parent as unknown as ObjectRow;
      const rows = await ctx.loaders.xrelsBySlug.load(o.slug);
      return rows as unknown as never[];
    },
  },

  /**
   * Index type resolvers — override to handle ObjectIndexRow._resolvedSlug.
   *
   * When an IndexRow comes from the objects domain (ObjectIndexRow with _resolvedSlug),
   * the slug is already computed from the JOIN; use it directly. For peopleplaces
   * IndexRows (without _resolvedSlug), fall through to the verse_id-based lookup
   * chain (identical to peopleplaces.ts Index.slug logic). This file is merged last
   * in resolvers.ts, so this definition wins the merge for the Index type.
   *
   * ref and text delegate to the same logic as peopleplaces — generateReference and
   * translation — so peopleplaces behavior is fully preserved for both domains.
   */
  Index: {
    slug: async (parent, _args, ctx) => {
      const row = parent as unknown as ObjectIndexRow | IndexRow;
      // ObjectIndexRow carries a precomputed slug from the bom_lookup JOIN
      if ('_resolvedSlug' in row) {
        return (row as ObjectIndexRow)._resolvedSlug;
      }
      // Fallback: peopleplaces IndexRow — verse_id → bom_lookup → bom_text → bom_slug
      const idx = row as IndexRow;
      const textGuid = await ctx.loaders.lookupTextGuidByVerseId.load(idx.verse_id);
      if (!textGuid) return 'contents';
      const textRow = await ctx.loaders.textPageLinkByGuid.load(textGuid);
      if (!textRow || !textRow.page) return 'contents';
      const pagePath = await ctx.loaders.slugPathByLink.load(textRow.page);
      if (!pagePath) return 'contents';
      return `${pagePath}/${textRow.link}`;
    },

    ref: (parent, _args, ctx) => {
      const idx = parent as unknown as IndexRow;
      const lang = (ctx.lang ?? 'en') as Parameters<typeof generateReference>[1];
      const from = parseInt(idx.verse_id, 10);
      const to = parseInt(idx.verse_id_end, 10);
      const range = [...new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i))];
      return generateReference(range, lang);
    },

    text: async (parent, _args, ctx) => {
      const idx = parent as unknown as IndexRow;
      if (!idx.guid) return idx.text ?? null;
      return translated(ctx, idx.guid, 'text', idx.text ?? null);
    },
  },
};
