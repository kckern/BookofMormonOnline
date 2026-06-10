/** feedsmisc domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type { SectionRow } from '../../data/loaders.js';

/**
 * getSlugTip: mirrors legacy getSlugTip — takes the last path segment as the
 * bom_slug lookup value.  Gotcha #7 in the porting guide.
 */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

export const feedsmiscResolvers: Resolvers = {
  Query: {
    /**
     * text(slug: [String]): [TextBlock]
     *
     * Legacy (BomPage.ts:102-150):
     *  1. Parse link numbers: s.match(/\d+$/).pop()
     *  2. Parse slug tips: s.replace(/\/\d+$/,'').split('/').pop()
     *  3. Dedupe link numbers
     *  4. JOIN bom_text (WHERE link IN linkNums) + bom_slug (WHERE slug IN tips)
     *  5. Re-map results back to arg order by "slugTip/linkNum" composite key
     *
     * Scalar-or-array arg (gotcha #12): always normalise to array.
     */
    text: (_root, args, ctx) => {
      const c = ctx as AppContext;
      if (!args.slug) return null;
      const slugs = (Array.isArray(args.slug) ? args.slug : [args.slug]).filter(
        (s): s is string => s !== null && s !== undefined,
      );
      if (!slugs.length) return [];
      return Promise.all(slugs.map((s) => c.loaders.textBySlugPath.load(s))).then((rows) =>
        rows.filter((r): r is NonNullable<typeof r> => r !== null),
      ) as any;
    },

    /**
     * section(slug: [String]): [Section]
     *
     * Legacy (BomPage.ts:80-100):
     *  - getSlugTip(args.slug)
     *  - findAll BomSection WHERE sectionSlug JOIN + includes rows/narration
     *
     * Scalar-or-array arg (gotcha #12).
     */
    section: (_root, args, ctx) => {
      const c = ctx as AppContext;
      if (!args.slug) return null;
      const slugs = (Array.isArray(args.slug) ? args.slug : [args.slug]).filter(
        (s): s is string => s !== null && s !== undefined,
      );
      if (!slugs.length) return [];
      // Normalise to slug-tip form then load
      const normalised = slugs.map((s) => {
        const tip = getSlugTip(s);
        // Reconstruct as "parentSlug/tip" if original had a parent, to preserve
        // key uniqueness; but the loader uses only the tip for the DB lookup.
        // Pass the original path so the loader can parse it correctly.
        return s;
      });
      return Promise.all(normalised.map((s) => c.loaders.sectionBySlugPath.load(s))).then(
        (rows) => rows.filter((r): r is NonNullable<typeof r> => r !== null),
      ) as any;
    },
  },

  Section: {
    /**
     * Section.page: load the parent bom_page for this section.
     * Legacy (BomPage.ts:430-437): findOne WHERE guid = item.getDataValue('parent').
     * Not in coreResolvers (core only wires title/slug/rows for the page tree);
     * needed here for sectionInFeed's { page { title } } selection.
     */
    page: (parent, _args, ctx) => {
      const s = parent as SectionRow;
      if (!s.parent) return null;
      return (ctx as AppContext).loaders.pageByGuid.load(s.parent) as any;
    },
  },
};
